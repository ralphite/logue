import { Bookmark, Check, MessageSquarePlus, Mic, Sparkles, X } from "lucide-react";
import type { CSSProperties, SyntheticEvent } from "react";
import { Button, ErrorBubble, IconButton, RecordingDot, Spinner } from "@logue/ui";
import { FloatingBar, type Draggable } from "./FloatingBar";
import type { Skill } from "../api";

/** Pressing the toolbar must not collapse the selection it acts on. */
const keepSelection = (event: SyntheticEvent) => event.preventDefault();

export type SelectionPhase = "idle" | "starting" | "recording" | "saving" | "saved";

/**
 * The toolbar over a selection: keep it, say something about it, or run a
 * Skill on it. The icons keep a row; the Skills stand in one column, one
 * per line, all of them — he circled the row-of-two and drew this shape
 * ("we need the skills to show like this"), so nothing hides behind a menu
 * here any more. The icon row takes whichever end of the column is nearest
 * the selected words ("the 3 buttons should be close to the selected text").
 */
export function SelectionBar({
  phase,
  style,
  error,
  skills,
  writing,
  note,
  onNote,
  onOpenNote,
  onSaveNote,
  onSave,
  onVoice,
  onAccept,
  onCancel,
  onSkill,
  onMove,
  onResetPosition,
  moved,
  iconsAtBottom = false,
}: Draggable & {
  phase: SelectionPhase;
  style?: CSSProperties;
  error?: string;
  skills: Skill[];
  writing: boolean;
  note: string;
  onNote: (value: string) => void;
  onOpenNote: () => void;
  onSaveNote: () => void;
  onSave: () => void;
  onVoice: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onSkill: (skillId: string) => void;
  /**
   * The icon row hugs the selection — "the 3 buttons should be close to the
   * selected text". With the toolbar above the selection the icons take the
   * column's bottom edge and the Skills stack away from them; flipped below,
   * the icons top the column.
   */
  iconsAtBottom?: boolean;
}) {
  // Only the resting toolbar stacks: recording, starting and saving offer no
  // Skills, and a wide toolbar saying "Starting mic…" is noise.
  const resting = phase === "idle" || phase === "saved";

  // The three pieces of the resting toolbar, assembled in whichever order
  // hugs the selection. The DOM order follows the visual order, so Tab walks
  // the column the way the eye does — a CSS-only reversal left keyboard
  // focus jumping backwards through a panel that read top-to-bottom. The
  // keys let React move the pieces instead of rebuilding them when the
  // order flips, so a focused button keeps its focus.
  const iconRow = (
    <div key="icons" className="flex items-center gap-0.5">
      <IconButton label="Voice comment" className="text-accent hover:bg-accent-soft" onClick={onVoice}>
        <Mic size={15} />
      </IconButton>
      <IconButton label="Write comment" onClick={onOpenNote}>
        <MessageSquarePlus size={15} />
      </IconButton>
      {/*
        The confirmation lands on the button that earned it rather than
        replacing the toolbar. Standing the whole bar down for a second and
        a half stranded the obvious next move — you keep a quote in order to
        say something about it.
      */}
      {phase === "saved" ? (
        <IconButton label="Saved" className="text-success" disabled>
          <Check size={15} />
        </IconButton>
      ) : (
        <IconButton label="Save selection" onClick={onSave}>
          <Bookmark size={15} />
        </IconButton>
      )}
    </div>
  );
  const hairline = <span key="hairline" aria-hidden className="mx-1 my-0.5 h-px bg-line" />;
  const skillColumn = (
    /* One column, every Skill on it, scrolling only when the window runs
       out — never an overflow menu on this surface. The line is the menus'
       line shape without their semantics: this list is always on screen,
       not a popup. */
    <div key="skills" role="group" aria-label="Skills" className="logue-scroll flex max-h-[min(60vh,320px)] flex-col overflow-y-auto">
      {skills.map((skill) => (
        <button
          key={skill.id}
          type="button"
          title={skill.name}
          // No spinner, no disabling: choosing a Skill stands the whole
          // toolbar down in the same commit (the run lives in the side
          // panel), so an in-line running state would never reach the
          // screen.
          onClick={() => onSkill(skill.id)}
          className="flex h-6 w-full shrink-0 items-center gap-2 rounded-sm px-2 text-left text-xs whitespace-nowrap text-ink-soft outline-none hover:bg-surface-muted hover:text-ink focus-visible:bg-surface-muted focus-visible:text-ink [&_svg]:shrink-0"
        >
          <Sparkles size={12} />
          {/* 80px cut "Accurate transcription" to "Accurate tr…" — a word
              broken mid-syllable on a surface that disappears when you
              move. Wide enough for the names people actually have, and
              still capped so one absurd name cannot own the toolbar. */}
          <span className="min-w-0 max-w-40 truncate">{skill.name}</span>
        </button>
      ))}
    </div>
  );

  if (writing) {
    return (
      <section
        style={style}
        aria-label="Comment on selection"
        className="logue-float fixed z-surface w-[min(320px,calc(100vw-16px))] p-1.5"
      >
        <IconButton label="Cancel" className="absolute top-1 right-1 z-10" onClick={onCancel}>
          <X size={14} />
        </IconButton>
        <textarea
          autoFocus
          value={note}
          onChange={(event) => onNote(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onCancel();
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSaveNote();
          }}
          placeholder="Comment on this selection…"
          aria-label="Comment"
          className="block min-h-16 w-full resize-y border-0 bg-transparent py-1 pr-7 pl-1 text-[13px] leading-[1.5] text-ink outline-0"
        />
        <div className="flex justify-end pt-0.5">
          <Button variant="primary" disabled={!note.trim() || phase === "saving"} onClick={onSaveNote}>
            {phase === "saving" ? <Spinner size={13} /> : null} Add <kbd>⌘↵</kbd>
          </Button>
        </div>
      </section>
    );
  }

  return (
    // The same shell the caret bar uses: same frame, same handle, same drag.
    // This one had no handle at all, which is how the two came apart.
    <FloatingBar
      label="Selection actions"
      style={style}
      onPointerDown={keepSelection}
      onMove={onMove}
      onResetPosition={onResetPosition}
      moved={moved}
      stacked={resting && skills.length > 0}
      stackedGlyphAt={iconsAtBottom ? "bottom" : "top"}
    >
      {phase === "recording" ? (
        <>
          <RecordingDot className="mx-1.5" />
          <Button variant="primary" onClick={onAccept} title="Accept (Enter)">
            Accept <kbd>↵</kbd>
          </Button>
          <IconButton label="Cancel" onClick={onCancel}>
            <X size={14} />
          </IconButton>
        </>
      ) : phase === "starting" || phase === "saving" ? (
        <>
          <Spinner className="mx-1 text-muted" />
          <span className="pr-1 text-xs text-muted" role="status">
            {phase === "starting" ? "Starting mic…" : "Saving…"}
          </span>
        </>
      ) : (
        // The icon row hugs the selection's side: at the bottom edge when
        // the toolbar stands above the words, so the three most-reached
        // buttons are the nearest thing to them.
        <div className="flex min-w-0 flex-col">
          {skills.length === 0
            ? iconRow
            : iconsAtBottom
              ? [skillColumn, hairline, iconRow]
              : [iconRow, hairline, skillColumn]}
        </div>
      )}

      {/* The shared bubble, not a hand-typed one: these colours were spelled
          out here as hex, so this failure looked like a different product
          from the same failure three inches away. */}
      {error && <ErrorBubble className="right-0 bottom-[calc(100%+6px)]">{error}</ErrorBubble>}
    </FloatingBar>
  );
}

