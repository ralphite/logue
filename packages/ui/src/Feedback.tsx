import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <LoaderCircle
      size={size}
      className={cn("shrink-0 animate-[logue-spin_0.8s_linear_infinite]", className)}
    />
  );
}

/** Recording is the pulsing dot itself; the word lives in the a11y tree. */
export function RecordingDot({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Recording"
      className={cn(
        "size-2 shrink-0 animate-[logue-pulse_1.4s_ease-in-out_infinite] rounded-full bg-danger",
        className,
      )}
    />
  );
}

export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("text-xs leading-normal text-danger", className)}>
      {children}
    </p>
  );
}

/** The same wait everywhere, so loading never looks like a different product. */
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-muted" role="status">
      <Spinner /> {label}
    </div>
  );
}

/**
 * A failure floating beside the surface that caused it.
 *
 * Injected surfaces cannot push layout around, so their errors hover; using the
 * same component everywhere keeps them from drifting into hand-rolled colors.
 */
export function ErrorBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "absolute w-max max-w-64 rounded-lg border border-danger-line bg-surface px-2 py-1.5 text-xs leading-normal text-danger shadow-[0_6px_18px_rgb(15_15_15/10%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Something the person has to read, in the flow of the surface that caused it.
 *
 * There were seven spellings of this across the three packages — two of them
 * with colours typed in by hand — so the same failure looked like a different
 * product depending on where it happened. One shape, three tones:
 *
 * - `danger`  — it failed, and there is something to do about it.
 * - `warning` — it worked, and something about it is worth knowing.
 * - `quiet`   — a fact, in the register of the surface around it.
 *
 * Actions belong in `action` so they sit on the line, never as a paragraph of
 * their own underneath.
 */
export function Notice({
  children,
  tone = "danger",
  action,
  className,
}: {
  children: ReactNode;
  tone?: "danger" | "warning" | "quiet";
  action?: ReactNode;
  className?: string;
}) {
  const tones = {
    danger: "border-danger-line bg-danger-soft text-danger",
    warning: "border-line bg-surface-muted text-warning",
    quiet: "border-line bg-surface-muted text-ink",
  };
  return (
    <div
      role={tone === "quiet" ? "status" : "alert"}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs leading-[1.45]",
        tones[tone],
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

/**
 * One line and one action — never a paragraph explaining what could be here.
 *
 * The same shape in a list, a pane and a dialog. There were three of them,
 * each with its own padding and alignment, so "nothing here" looked like a
 * different kind of nothing depending on where you found it.
 */
export function Empty({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 px-4 py-6 text-xs leading-relaxed text-muted", className)}>
      <span>{children}</span>
      {action}
    </div>
  );
}

/**
 * A key, drawn as a key.
 *
 * `<kbd>` was in the markup already and styled as ordinary grey text, so the
 * one thing on screen that is literally a physical object looked like a word.
 * One cap per key, quiet enough to sit inside a sentence.
 */
export function Keys({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center rounded-[4px] border border-line-strong",
        "bg-surface px-1 py-px font-sans text-[10.5px] leading-[1.5] text-ink-soft",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
