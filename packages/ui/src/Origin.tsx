import { Globe, Mic, Sparkles } from "lucide-react";
import { cn } from "./cn";

/**
 * Where a piece of content came from. Web evidence, what you said, and what a
 * model produced must never be mistaken for each other — this is the product's
 * central promise, so it gets a dedicated mark.
 */
export type Origin = "web" | "you" | "ai";

const marks: Record<Origin, { icon: typeof Globe; label: string; className: string }> = {
  web: { icon: Globe, label: "From the web", className: "text-muted" },
  you: { icon: Mic, label: "From you", className: "text-accent" },
  ai: { icon: Sparkles, label: "Generated", className: "text-[#8a6d3b]" },
};

export function OriginMark({ origin, detail, className }: { origin: Origin; detail?: string; className?: string }) {
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

/** A numbered Source behind a generated claim. Pressed means its panel is open. */
export function Citation({
  n,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { n: number }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-5 items-center rounded-full border border-accent-line bg-accent-soft px-1.5 text-[11px] font-[650] text-[#424ebc] align-baseline",
        "hover:bg-[#e4e6fc] aria-pressed:border-accent aria-pressed:bg-[#dfe1fb]",
        className,
      )}
      {...props}
    >
      {n}
    </button>
  );
}
