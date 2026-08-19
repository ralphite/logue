import { Check, Copy, MoreHorizontal, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  ACTS,
  ActBadge,
  Answer,
  Button,
  IconButton,
  Notice,
  OriginMark,
  Recording,
  Spinner,
  cn,
  originOf,
} from "@logue/ui";
import { audioUrl, type Skill } from "../api";
import type { Entry } from "../entries";
import { offered, type Take } from "../takes";

/**
 * How much of a text a row shows before it folds.
 *
 * A 4:14 dictation printed in full made one entry 1077 pixels tall — the whole
 * panel was one transcript, and its own Skills row was a thousand pixels below
 * the words it belonged to. Six lines is what the mock shows and what a list
 * of things that happened can be read as a list.
 */
const FOLD = 420;

/**
 * One thing that happened on this page.
 *
 * Every entry is the same shape, whether it was spoken, typed, quoted or
 * kept: a badge saying which act it was, the words, and the Skills that can
 * be run on them. Skills used to belong to dictation alone — so what you
 * could do with a sentence depended on how it had arrived, which is the
 * distinction his instruction removed.
 */
export function EntryRow({
  entry,
  server,
  skills,
  onApply,
  onRetry,
  onAsk,
  onAccept,
  onLeave,
}: {
  entry: Entry;
  server: string;
  skills?: Skill[];
  onApply: (takeId: string, skill: Skill) => void;
  onRetry: () => void;
  /** Ask about this entry — a Skill like the others, and on the same row. */
  onAsk: () => void;
  onAccept: () => void;
  onLeave: () => void;
}) {
  // The audio to play: on the Source once the words came back, or the capture
  // the Host kept when they did not. An entry that shows only its failure
  // reads as "the recording is gone".
  const captureId = entry.material?.capture_id ?? entry.captureId;

  return (
    <article className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 border-b border-line px-3 py-2.5">
      <ActBadge kind={entry.kind} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-[10.5px] font-[600] ${ACTS[entry.kind].ink}`}>{ACTS[entry.kind].label}</span>
          <span className="ml-auto text-[10.5px] tabular-nums text-muted">{at(entry.at)}</span>
        </div>

        {/* What it was said about, when it was said about something. */}
        {entry.quote && <Folded className="mt-1.5 border-l-2 border-line-strong pl-2 text-[11.5px] leading-[1.5] text-muted" text={entry.quote} />}

        {captureId && (
          <div className="mt-1.5">
            <Recording
              src={audioUrl(server, captureId)}
              seconds={entry.material?.capture_seconds ?? entry.seconds}
              shape={captureId}
            />
          </div>
        )}

        {entry.state === "working" && (
          <div className="mt-1.5 flex items-center gap-2">
            <Spinner size={13} className="text-muted" />
            <span className="flex-1 text-xs text-muted" role="status">
              {entry.message ?? "Keeping…"}
            </span>
          </div>
        )}

        {entry.state === "failed" && (
          <Notice
            className="mt-1.5"
            action={
              entry.captureId ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="font-[560] underline decoration-danger-line underline-offset-2"
                >
                  Try again
                </button>
              ) : undefined
            }
          >
            {entry.message}
          </Notice>
        )}

        {/* Something went wrong *after* the words were safe: a Skill that
            would not run, an answer that never came, a Document that would not
            take them. It was written onto the entry and shown by nothing —
            asking a busy model looked exactly like not having asked. */}
        {entry.state === "ready" && entry.message && (
          <Notice tone="warning" className="mt-1.5">
            {entry.message}
          </Notice>
        )}

        {entry.take && (
          <TakeText
            take={entry.take}
            skills={skills}
            onApply={onApply}
            // A saved page says which page. Everything else says what it says.
            summary={
              entry.kind === "saved"
                ? entry.material?.source?.title || entry.material?.source?.url || "This page"
                : undefined
            }
            // Asking stands at the head of the Skills row, on the text it is
            // about — not on a strip of its own below the entry, which drew a
            // second divider through every row.
            lead={
              entry.state === "ready" && !entry.take.running ? (
                <Button onClick={onAsk}>
                  <Sparkle /> Ask
                </Button>
              ) : undefined
            }
          />
        )}

        {/* Nothing has happened yet. A change is a proposal until someone says
            yes — the line between this and every other assistant. */}
        {entry.proposal && proposed(entry.proposal) && (
          <div className="mt-1.5 flex items-center gap-1 rounded-md border border-accent-line bg-accent-soft px-2 py-1.5">
            <span className="flex-1 text-xs text-ink">{proposed(entry.proposal)}</span>
            <Button variant="primary" onClick={onAccept}>
              Do it
            </Button>
            <IconButton label="Leave it" onClick={onLeave}>
              <X size={13} />
            </IconButton>
          </div>
        )}

        {/* The one fact an entry exists to report once it has one: the words
            are not only kept, they are somewhere. */}
        {entry.landed && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
            <Check size={11} className="text-success" />
            Added to {entry.landed.title}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * A text, and everything a Skill has made from it.
 *
 * The text and its rewrites are rendered by the same component, on purpose:
 * they are the same kind of thing. What a text came from is said by where it
 * sits — indented under the text it was made from — so nothing needs
 * numbering, and a second rewrite sits beside the first rather than after it.
 */
export function TakeText({
  take,
  skills,
  onApply,
  lead,
  summary,
}: {
  take: Take;
  skills?: Skill[];
  onApply: (takeId: string, skill: Skill) => void;
  /** Something that belongs at the head of this text's Skills row. */
  lead?: ReactNode;
  /**
   * What to show in place of the words themselves.
   *
   * A saved page *is* the whole article — that is what makes it worth citing
   * — and the row printed all of it, so pressing the bookmark dropped six
   * folded lines of someone else's prose into the list where the page's name
   * belonged. The Source keeps every word; the row says which page it was.
   */
  summary?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [all, setAll] = useState(false);
  const [cited, setCited] = useState<number>();
  const usable = offered(skills, take);
  // Three, and the rest behind the ⋯ — what the mock shows, and what a
  // 400-pixel row fits beside the copy button.
  const shown = all ? usable : usable.slice(0, lead ? 2 : 3);
  const source = cited === undefined ? undefined : take.sources?.[cited - 1];

  return (
    <div>
      {take.from && <div className="mt-1 text-[10.5px] font-[600] text-ai">{take.from}</div>}
      {summary ? (
        <div className="mt-1 truncate text-[12.5px] leading-[1.55] text-ink">{summary}</div>
      ) : (
      <Folded
        className="mt-1 text-[12.5px] leading-[1.55] whitespace-pre-wrap text-ink"
        text={take.text}
        // An answer's citations are chips that open what they stand on. Printed
        // as text, `[Source 1]` is a claim nobody can follow.
        render={
          take.sources
            ? (text) => <Answer text={text} open={cited} onCite={setCited} sources={take.sources} />
            : undefined
        }
      />
      )}
      {source && (
        <div className="mt-1.5 rounded-md bg-surface-muted p-2">
          <OriginMark origin={originOf(source.kind)} detail={source.source?.domain || "This Mac"} />
          <p className="mt-1 line-clamp-6 text-[11.5px] leading-[1.5] text-ink-soft">{source.content}</p>
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {lead}
        {shown.map((skill) => (
          <Button key={skill.id} disabled={Boolean(take.running)} onClick={() => onApply(take.id, skill)}>
            {take.running === skill.name && <Spinner size={11} />}
            {skill.name}
          </Button>
        ))}
        {!all && usable.length > shown.length && (
          <IconButton label="More Skills" onClick={() => setAll(true)}>
            <MoreHorizontal size={14} />
          </IconButton>
        )}
        <IconButton
          // Pushed to the end of the row: the Skills are a list that can wrap,
          // and copying is not one of them. Without this it wrapped onto a
          // line of its own and read as a control nobody had placed.
          className="ml-auto"
          label={copied ? "Copied" : "Copy"}
          onClick={() => {
            void navigator.clipboard.writeText(take.text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            });
          }}
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </IconButton>
      </div>
      {/* Where the answer will land, claimed while it is on its way. */}
      {take.running && (
        <div className="mt-2 border-l-2 border-accent-line pl-2.5">
          <div className="text-[10.5px] font-[600] text-ai">{take.running}</div>
          <div className="mt-1.5 grid gap-1.5">
            <span className="h-2 w-full animate-pulse rounded-full bg-surface-muted" />
            <span className="h-2 w-4/5 animate-pulse rounded-full bg-surface-muted" />
          </div>
        </div>
      )}
      {take.made.map((child) => (
        <div key={child.id} className="mt-2 border-l-2 border-accent-line pl-2.5">
          <TakeText take={child} skills={skills} onApply={onApply} />
        </div>
      ))}
    </div>
  );
}

/**
 * A passage of text that a list can hold: six lines, then "More".
 *
 * One rule for both texts a row shows. They had two, in opposite directions —
 * a quote cut at 220 characters with no way back, and a transcript printed
 * whole however long it ran.
 */
function Folded({
  text,
  className,
  render,
}: {
  text: string;
  className?: string;
  /** How to draw the words, when they are more than words. */
  render?: (text: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > FOLD || text.split("\n").length > 8;
  return (
    <div>
      <p className={cn(className, long && !open && "line-clamp-6")}>{render ? render(text) : text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="mt-0.5 text-[11px] font-[560] text-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
        >
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}

/**
 * What the agent is asking to be allowed to do, in the words the panel uses
 * for it elsewhere.
 *
 * Never "would change your workspace": agreeing to something unnamed is not
 * agreement. A proposal whose act we cannot name does not get a button.
 */
export function proposed(proposal: { tool: string; title?: string }): string {
  if (proposal.title) return `Would draft “${proposal.title}”`;
  const said: Record<string, string> = {
    draft_document: "Would draft a document",
    save_page: "Would save this page",
    add_to_project: "Would add this to a Project",
  };
  return said[proposal.tool] ?? "";
}

function Sparkle() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16l-1.8-4.2L5.5 10l4.7-1.3z" />
    </svg>
  );
}

/** The clock a panel row shows: today by time, older by date. */
function at(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  const now = new Date();
  const sameDay =
    when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth() && when.getDate() === now.getDate();
  return sameDay
    ? when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
    : when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
