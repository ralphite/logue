import { Globe, Mic, Sparkles } from "lucide-react";
import { cn } from "./cn";

/**
 * Where a piece of content came from. Web evidence, what you said, and what a
 * model produced must never be mistaken for each other — this is the product's
 * central promise, so it gets a dedicated mark.
 */
export type Origin = "web" | "you" | "ai";

/**
 * What a Material's kind means for provenance. One rule, in one place: the
 * same Source must never read as "from the web" on one screen and "from you"
 * on another — that distinction is the product's central promise.
 */
const ORIGIN_OF_KIND: Record<string, Origin> = {
  selection: "web",
  page: "web",
  voice: "you",
  text: "you",
  derived: "ai",
};

export function originOf(kind: string): Origin {
  return ORIGIN_OF_KIND[kind] ?? "you";
}

export interface AnswerToken {
  /** Plain prose, or undefined when this token is a citation. */
  text?: string;
  /** The Source numbers named by a citation bracket, with their offsets. */
  cites?: { n: number; at: number }[];
  /** Character offset — a stable React key. */
  at: number;
}

/**
 * Splits generated text into prose and citations.
 *
 * Models write the bracket both ways — `[Source 3, 7]` and
 * `[Source 3, Source 7]` — so match it loosely and take every number inside. A
 * citation that fails to render is a claim the reader cannot check, which is
 * the one failure this product cannot have.
 */
export function readAnswer(text: string): AnswerToken[] {
  let at = 0;
  return text.split(/(\[Source[^\]]*\])/g).map((part) => {
    const token: AnswerToken = /^\[Source[^\]]*\]$/.test(part)
      ? {
          cites: [...part.matchAll(/\d+/g)].map((found) => ({
            n: Number(found[0]),
            at: at + (found.index ?? 0),
          })),
          at,
        }
      : { text: part, at };
    at += part.length;
    return token;
  });
}

const marks: Record<Origin, { icon: typeof Globe; label: string; className: string }> = {
  web: { icon: Globe, label: "From the web", className: "text-muted" },
  you: { icon: Mic, label: "From you", className: "text-accent" },
  // Neutral, deliberately: amber here made "a model wrote this" and "this
  // needs you" the same colour, and provenance is a fact, not an alarm. The
  // sparkle carries the identification.
  ai: { icon: Sparkles, label: "Generated", className: "text-ai" },
};

export function OriginMark({
  origin,
  detail,
  className,
}: {
  origin: Origin;
  detail?: string;
  className?: string;
}) {
  const mark = marks[origin];
  const Icon = mark.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", mark.className, className)}
      title={detail ? `${mark.label} · ${detail}` : mark.label}
    >
      <Icon size={11} />
      {detail && <span className="truncate">{detail}</span>}
    </span>
  );
}

/**
 * A numbered Source behind a generated claim.
 *
 * `quote` becomes the tooltip, so a citation can be checked without opening
 * anything — hovering is the difference between a label and evidence. Pressed
 * means its passage is open below.
 */
export function Citation({
  n,
  quote,
  outOfDate,
  missing,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  n: number;
  quote?: string;
  /**
   * This Source has been overruled by a later one (R13).
   *
   * Marked here rather than only on the Source's own page, because a citation
   * is where it does damage: an answer standing on something that stopped
   * being true reads exactly like an answer standing on something that is.
   */
  outOfDate?: boolean;
  /**
   * There is no such Source behind this number.
   *
   * A model asked for citations will sometimes name a Source that was never
   * given to it. Until this existed, `[Source 5]` with three Sources on the
   * table rendered in the same accent blue as the three that were real — the
   * one thing this product cannot do, because a citation nobody can follow is
   * indistinguishable from evidence right up until someone tries.
   */
  missing?: boolean;
}) {
  return (
    <button
      type="button"
      // Not pressable: there is nothing to open, and a chip that answers a
      // press by doing nothing reads as a chip that failed, not as a claim
      // with nothing behind it.
      disabled={missing}
      aria-label={
        missing ? `Source ${n}, not in this answer's Sources` : outOfDate ? `Source ${n}, out of date` : `Source ${n}`
      }
      title={
        missing
          ? `Source ${n} — this answer names a Source that is not among its own. Nothing stands behind this claim.`
          : (outOfDate ? `Source ${n} — out of date. ` : `Source ${n}`) + (quote ? ` — ${quote.slice(0, 300)}` : "")
      }
      // The pill is 20px because it sits inside a line of 13px text; the thing
      // you have to hit is 24px, the floor the audit set for every pointer
      // target. Padding makes the target, a negative margin gives the line its
      // height back — the same trick the low `Revision 2` / `Version 6` links
      // were fixed with, so a citation is not the one control below the floor.
      className={cn("group inline-flex h-6 -my-0.5 items-center align-baseline", className)}
      {...props}
    >
      <span
        className={cn(
          "inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5 text-xs font-[650]",
          missing
            ? // Dashed and struck through: this one is not a weaker citation,
              // it is not a citation. It has to be legible as broken at a
              // glance, from across the paragraph.
              "border-danger-line border-dashed bg-danger-soft text-danger line-through decoration-1"
            : outOfDate
              ? // Not the accent: the accent means "follow this". A citation
                // that is no longer current should not look like the others.
                "border-line bg-surface-muted text-muted group-hover:bg-surface group-aria-pressed:border-muted"
              : "border-accent-line bg-accent-soft text-accent-ink group-hover:bg-accent-hover-soft group-aria-pressed:border-accent group-aria-pressed:bg-accent-pressed",
        )}
      >
        {n}
        {outOfDate && !missing && <span aria-hidden="true">†</span>}
      </span>
    </button>
  );
}
