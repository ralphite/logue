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
  ai: { icon: Sparkles, label: "Generated", className: "text-warning" },
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
      className={cn("inline-flex items-center gap-1 text-[11px]", mark.className, className)}
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
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { n: number; quote?: string }) {
  return (
    <button
      type="button"
      aria-label={`Source ${n}`}
      title={quote ? `Source ${n} — ${quote.slice(0, 300)}` : `Source ${n}`}
      className={cn(
        "inline-flex h-5 items-center rounded-full border border-accent-line bg-accent-soft px-1.5 text-meta font-[650] text-accent-ink align-baseline",
        "hover:bg-accent-hover-soft aria-pressed:border-accent aria-pressed:bg-accent-pressed",
        className,
      )}
      {...props}
    >
      {n}
    </button>
  );
}
