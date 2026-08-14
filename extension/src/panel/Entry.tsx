import { Check, Copy, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { ACTS, ActBadge, Button, IconButton, Notice, Recording, Spinner } from "@logue/ui";
import { audioUrl, type Skill } from "../api";
import type { Entry } from "../entries";
import { offered, type Take } from "../takes";

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
}: {
  entry: Entry;
  server: string;
  skills?: Skill[];
  onApply: (takeId: string, skill: Skill) => void;
  onRetry: () => void;
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
        {entry.quote && (
          <p className="mt-1.5 border-l-2 border-line-strong pl-2 text-[11.5px] leading-[1.5] text-muted">
            {entry.quote.length > 220 ? `${entry.quote.slice(0, 220)}…` : entry.quote}
          </p>
        )}

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

        {entry.take && <TakeText take={entry.take} skills={skills} onApply={onApply} />}

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
}: {
  take: Take;
  skills?: Skill[];
  onApply: (takeId: string, skill: Skill) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [all, setAll] = useState(false);
  const usable = offered(skills, take);
  // Two, and the rest behind the ⋯ — a 400-pixel row fits two names.
  const shown = all ? usable : usable.slice(0, 2);

  return (
    <div>
      {take.from && <div className="mt-1 text-[10.5px] font-[600] text-ai">{take.from}</div>}
      <p className="mt-1 text-[12.5px] leading-[1.55] whitespace-pre-wrap text-ink">{take.text}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
