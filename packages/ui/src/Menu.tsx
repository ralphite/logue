import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * The disclosure that keeps a surface calm: secondary actions live in here,
 * closed, until someone reaches for them. Closes on Escape, on outside press,
 * and after any item runs.
 */
export function Menu({
  trigger,
  children,
  align = "end",
  label,
}: {
  trigger: (props: { "aria-expanded": boolean; "aria-haspopup": "menu"; onClick: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && root.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-flex">
      {trigger({ "aria-expanded": open, "aria-haspopup": "menu", onClick: () => setOpen((v) => !v) })}
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          onClick={() => setOpen(false)}
          className={cn(
            "logue-float absolute top-[calc(100%+4px)] z-popover min-w-44 max-w-72 p-1",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  className,
  children,
  tone = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex h-control w-full items-center gap-2 rounded-sm px-2 text-left text-xs whitespace-nowrap disabled:opacity-45 [&_svg]:shrink-0",
        tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink-soft hover:bg-surface-muted hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
