import { Bookmark, ChevronDown, Mic, X } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import { Dropdown, IconButton, Keys, Spinner, Tooltip, cn } from "@logue/ui";

/**
 * The one place anything is said to Logue on a page.
 *
 * There were three verbs across the top of this panel — Record, Keep, Ask —
 * and two boxes that could take a recording, each behaving differently. Which
 * one you were talking to was a hidden state, kept only so that a recording
 * could remember where to go. His instruction of 2026-08-13: one box.
 *
 * The rules it is built on, in order of how much they matter:
 *
 * 1. **Voice fills the box; it does not send.** Talking inserts words at the
 *    caret. What to do with them is a separate decision, which is what makes
 *    it possible to say a second sentence — the thing he asked for.
 * 2. **Sending keeps.** Not asks. Asking is a Skill you run on something you
 *    have kept, which is why it lives under each entry rather than up here.
 * 3. **A selection changes the scope, not the controls.** Select on the page
 *    and the passage arrives above the box; the quote goes in with whatever
 *    you say about it.
 */

export type Phase = "idle" | "starting" | "recording" | "working" | "error";

export interface ComposerHandle {
  /** Put words at the caret, the way a finished recording does. */
  insert: (text: string) => void;
  /** What is in the box right now. */
  text: () => string;
  /** Empty it — after a send that the box did not start. */
  clear: () => void;
  focus: () => void;
}

export interface Quote {
  text: string;
  anchor?: unknown;
}

/** How long a quote can be before the box folds it away. */
const FOLD = 600;

export function Composer({
  handle,
  quote,
  source,
  onDropQuote,
  project,
  projects,
  onProject,
  into,
  documents,
  onInto,
  phase,
  seconds,
  busy,
  onRecord,
  onDiscard,
  onInsert,
  onSend,
  onKeepPage,
  notice,
}: {
  handle?: RefObject<ComposerHandle | null>;
  /** The passage selected on the page, pushed by the content script. */
  quote?: Quote;
  /** Where that passage is from, in a line: the page it was selected on. */
  source?: string;
  onDropQuote: () => void;
  project: string;
  projects: { id: string; name: string }[];
  onProject: (next: string) => void;
  into?: { id: string; title: string };
  documents: { id: string; title: string }[];
  onInto: (next?: { id: string; title: string }) => void;
  phase: Phase;
  seconds: number;
  busy?: boolean;
  onRecord: () => void;
  /** Throw the recording away — nothing is kept, nothing is transcribed. */
  onDiscard: () => void;
  /** Stop, transcribe, and put the words in the box. */
  onInsert: () => void;
  /**
   * Send what is in the box. With a recording running: insert it, then send.
   *
   * Answers `false` when nothing was kept, so the words stay where they are.
   */
  onSend: () => void | boolean | Promise<void | boolean>;
  onKeepPage: () => void;
  /** Something the box itself has to say — a microphone that will not open. */
  notice?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const recording = phase === "recording" || phase === "starting";

  useImperativeHandle(
    handle,
    () => ({
      insert: (words: string) => {
        const field = box.current;
        const at = field?.selectionStart ?? text.length;
        // At the caret, joined the way a person would have typed it — the same
        // rule the on-page insertion has always used.
        setText((was) => {
          const before = was.slice(0, at);
          const after = was.slice(at);
          const joined = `${before}${before && !/\s$/.test(before) ? " " : ""}${words}${after}`;
          queueMicrotask(() => {
            const caret = before.length + (before && !/\s$/.test(before) ? 1 : 0) + words.length;
            field?.focus();
            field?.setSelectionRange(caret, caret);
          });
          return joined;
        });
      },
      text: () => text,
      clear: () => setText(""),
      focus: () => box.current?.focus(),
    }),
    [text],
  );

  /**
   * Sending empties the box — *after* it has been kept, never before.
   *
   * This cleared first and awaited nothing, so a send that failed (a Host that
   * was not running, most of all) took the words with it: the box was empty,
   * the entry that appeared had no text on it, and there was nowhere left to
   * read what had been typed. The words are the one thing this product must
   * not drop.
   */
  const send = () => {
    const words = text;
    void Promise.resolve(onSend()).then((ok) => {
      if (ok !== false) setText("");
      else if (text === "") setText(words);
    });
  };

  // The keys, while a recording is running. They are on the window because the
  // box does not hold focus during a recording — the microphone does.
  useEffect(() => {
    if (!recording) return;
    const onKey = (event: KeyboardEvent) => {
      // Not while something else is listening. Escape belongs to the menu that
      // is open, and Enter to the field being typed in — a recording thrown
      // away by closing a menu is a recording nobody chose to throw away.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") ||
          target.closest("[role='menu'], [role='dialog'], [role='listbox']"))
      ) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onDiscard();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.metaKey || event.ctrlKey) void onSend();
        else onInsert();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, onDiscard, onInsert, onSend]);

  const nothingToSend = !text.trim() && !quote;

  return (
    <div className="shrink-0 border-t border-line bg-panel p-2">
      {quote && (
        <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_20px] items-start gap-1.5 rounded-md border-l-2 border-line-strong bg-surface-muted px-2 py-1.5">
          {/* Where the passage is from. A quote with no source above it is
              indistinguishable from something the person typed. */}
          {source && <div className="col-span-2 mb-0.5 truncate text-[10.5px] font-[600] text-muted">{source}</div>}
          <p className="text-[12px] leading-[1.5] text-ink-soft">
            {open || quote.text.length <= FOLD ? quote.text : `${quote.text.slice(0, FOLD)}…`}
            {quote.text.length > FOLD && (
              <button
                type="button"
                onClick={() => setOpen((was) => !was)}
                className="ml-1 font-[560] text-muted underline decoration-line-strong underline-offset-2"
              >
                {open ? "Less" : "More"}
              </button>
            )}
          </p>
          <IconButton label="Drop the quote" className="size-[18px] min-w-0" onClick={onDropQuote}>
            <X size={12} />
          </IconButton>
        </div>
      )}

      {recording ? (
        // The box becomes the recorder, in place. Three controls, three keys:
        // throw it away, put the words in, put them in and send.
        <div className="flex items-center gap-2 rounded-[10px] border border-accent-line bg-surface px-2 py-1.5">
          <IconButton variant="default" label="Discard" onClick={onDiscard}>
            <X size={14} />
          </IconButton>
          <span
            aria-hidden
            className="size-[7px] shrink-0 animate-[logue-pulse_1.4s_ease-in-out_infinite] rounded-full bg-danger"
          />
          <span className="font-mono text-[11px] tabular-nums text-ink" role="status">
            {clock(seconds)}
          </span>
          <Waveform seconds={seconds} />
          <IconButton
            label="Insert the words"
            className="border border-accent-line bg-accent-soft text-accent-ink"
            onClick={onInsert}
          >
            <Check />
          </IconButton>
          <IconButton
            label="Insert and send"
            className="border-0 bg-accent text-white hover:bg-accent-hover"
            onClick={onSend}
          >
            <Up />
          </IconButton>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-2 rounded-[10px] border border-control-line bg-surface px-2 pt-1.5 pb-1.5",
            "focus-within:border-accent-line focus-within:ring-[3px] focus-within:ring-accent-soft",
          )}
        >
          <textarea
            ref={box}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!nothingToSend && !busy) send();
              }
              if (event.key === "Escape" && quote) {
                event.preventDefault();
                onDropQuote();
              }
            }}
            rows={2}
            placeholder={quote ? "Say something about this passage, or send it as it is" : "Type here, or press the mic and talk"}
            aria-label="What to send"
            className="min-h-[34px] w-full resize-none bg-transparent text-[13px] leading-[1.5] text-ink outline-0 placeholder:text-faint"
          />
          <div className="flex items-center gap-1.5">
            <Dropdown
              label="Project"
              className="w-[104px] shrink-0"
              value={project}
              onChange={onProject}
              options={[
                { value: "", label: "No Project" },
                ...projects.map((one) => ({ value: one.name, label: one.name })),
              ]}
            />
            {documents.length > 0 && (
              <Dropdown
                label="Document"
                className="min-w-0 flex-1"
                value={into?.id ?? ""}
                onChange={(next) => onInto(documents.find((one) => one.id === next))}
                options={[
                  { value: "", label: "Into · nowhere" },
                  ...documents.map((one) => ({ value: one.id, label: `Into · ${one.title || "Untitled"}` })),
                ]}
              />
            )}
            <span className="ml-auto flex items-center gap-1">
              <Tooltip label="Save this page">
                <IconButton variant="default" label="Save this page" disabled={busy} onClick={onKeepPage}>
                  <Bookmark size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Talk" keys="⌘⇧K">
                <IconButton
                  variant="default"
                  label="Talk"
                  disabled={phase === "working" && busy}
                  onClick={onRecord}
                >
                  <Mic size={14} />
                </IconButton>
              </Tooltip>
              <IconButton
                label="Send"
                disabled={nothingToSend || busy}
                className={cn(
                  "border-0 disabled:border-0",
                  nothingToSend || busy
                    ? "bg-surface-muted text-faint disabled:bg-surface-muted disabled:text-faint"
                    : "bg-accent text-white hover:bg-accent-hover",
                )}
                onClick={send}
              >
                {busy ? <Spinner size={13} /> : <Up />}
              </IconButton>
            </span>
          </div>
        </div>
      )}

      {notice}

      <p className="mt-1.5 flex items-center gap-2.5 px-0.5 text-[10.5px] text-muted">
        {recording ? (
          <>
            <span className="flex items-center gap-1">
              <Keys>esc</Keys> discard
            </span>
            <span className="flex items-center gap-1">
              <Keys>↵</Keys> insert
            </span>
            <span className="flex items-center gap-1">
              <Keys>⌘↵</Keys> insert and send
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <Keys>↵</Keys> send
            </span>
            <span className="flex items-center gap-1">
              <Keys>⇧↵</Keys> new line
            </span>
            {quote && (
              <span className="flex items-center gap-1">
                <Keys>esc</Keys> drop the quote
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}

/** Two glyphs the icon set does not carry at this weight. */
function Check() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l5 5L19 7" />
    </svg>
  );
}

function Up() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

/** The chevron the folded quote uses, so it matches the drawn dropdowns. */
export { ChevronDown };

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The bars, filling as the seconds pass.
 *
 * Not a rendering of the audio — nothing in the browser has that without
 * decoding it — but the elapsed part is accent and the rest is not, so the
 * bar says the same thing the clock says, in the shape of a recording.
 */
function Waveform({ seconds }: { seconds: number }) {
  const bars = 34;
  // A minute fills it. Past that the clock is the thing that keeps counting.
  const filled = Math.min(bars, Math.round((seconds / 60) * bars));
  return (
    <svg viewBox={`0 0 ${bars * 4} 20`} preserveAspectRatio="none" aria-hidden className="h-5 min-w-0 flex-1">
      {Array.from({ length: bars }, (_, index) => {
        const height = 4 + ((index * 7) % 11);
        return (
          <line
            key={index}
            x1={index * 4 + 2}
            x2={index * 4 + 2}
            y1={10 - height / 2}
            y2={10 + height / 2}
            strokeWidth="1.8"
            strokeLinecap="round"
            className={index < filled ? "stroke-accent" : "stroke-line-strong"}
          />
        );
      })}
    </svg>
  );
}
