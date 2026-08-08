import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={cn("shrink-0 animate-[logue-spin_0.8s_linear_infinite]", className)} />;
}

/** Recording is the pulsing dot itself; the word lives in the a11y tree. */
export function RecordingDot({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Recording"
      className={cn("size-2 shrink-0 animate-[logue-pulse_1.4s_ease-in-out_infinite] rounded-full bg-danger", className)}
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

/** One line and one action — never a paragraph explaining what could be here. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-1 py-6 text-xs text-muted">
      <span>{children}</span>
      {action}
    </div>
  );
}
