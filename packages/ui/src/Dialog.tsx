import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "./Button";
import { cn } from "./cn";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * A modal that traps focus while open and returns it on close. The title row
 * is the only chrome: no subtitle, no description paragraph.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = "w-[min(420px,calc(100vw-32px))]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (restore instanceof HTMLElement) restore.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-popover grid place-items-center bg-[rgb(15_15_15/28%)] p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className={cn("logue-float p-3", width)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-[650] text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <div className="grid gap-2">{children}</div>
      </div>
    </div>
  );
}

/** Actions sit right, primary last — the same order as every dialog on macOS. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-1 flex items-center justify-end gap-1.5">{children}</div>;
}
