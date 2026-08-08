import { cn, useFocusBoundary } from "@logue/ui";
import type { ReactNode } from "react";

/**
 * A centred modal. It traps focus and closes on Escape or a backdrop press, so
 * a route only has to decide what goes inside it.
 */
export function Dialog({
  open,
  onClose,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const dialogRef = useFocusBoundary<HTMLDivElement>({ open, onClose, trap: true });
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(24,25,23,0.24)] p-6"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "grid w-full max-w-[520px] gap-4.5 rounded-xl border border-line-strong bg-surface p-5 shadow-[0_18px_56px_rgba(30,31,29,0.18)]",
          "[&_h2]:mt-1.5 [&_h2]:text-[20px]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
