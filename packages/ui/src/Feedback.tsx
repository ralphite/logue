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

/** Announces work and results to assistive tech without occupying the layout. */
export function LiveStatus({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </span>
  );
}

export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("text-xs leading-[1.45] text-danger", className)}>
      {children}
    </p>
  );
}

/** One line and one action — never a paragraph explaining what could be here. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-1 py-8 text-xs text-muted">
      <span>{children}</span>
      {action}
    </div>
  );
}
