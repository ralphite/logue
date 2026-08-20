import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { floatingStyle, usePlacement } from "./floating";

/**
 * The disclosure that keeps a surface calm: secondary actions live in here,
 * closed, until someone reaches for them.
 *
 * The behaviour is the platform menu's, on purpose: opening moves focus to
 * the first item, arrows walk the list and wrap, Enter runs, Escape and Tab
 * and an outside press leave — and focus goes back where it came from, so
 * the keyboard never falls off the page. The list flips upward when the
 * window ends before it does.
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
  const popup = useRef<HTMLDivElement>(null);
  // One placement rule for everything that floats over a trigger — fixed,
  // measured, clamped to the window. See `floating.ts`.
  const { at: placed } = usePlacement({ open, anchor: root, panel: popup, align });
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;

    const items = () =>
      [...(popup.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];

    // Focus enters the menu, the way every native menu works. Without this,
    // arrows scroll the page behind a list that looks focused and is not.
    items()[0]?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && root.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key === "Tab") {
        setOpen(false);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End")
        return;
      const all = items();
      if (all.length === 0) return;
      event.preventDefault();
      const focused = document.activeElement;
      const at = focused instanceof HTMLElement ? all.indexOf(focused) : -1;
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? all.length - 1
            : (at + (event.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
      all[next]?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      // Focus goes back where it came from — a menu that strands focus on
      // a removed node hands the next keystroke to the page at random.
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-flex">
      {trigger({ "aria-expanded": open, "aria-haspopup": "menu", onClick: () => setOpen((v) => !v) })}
      {open && (
        <div
          ref={popup}
          id={id}
          role="menu"
          aria-label={label}
          onClick={() => setOpen(false)}
          style={floatingStyle(placed)}
          className={cn("logue-scroll logue-float z-popover min-w-44 max-w-[min(18rem,calc(100vw-16px))] p-1")}
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
  icon,
  accelerator,
  submenu = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "danger";
  /**
   * The small glyph at the start of the line, beside the name.
   *
   * A slot rather than a child because the label span truncates: the CSS
   * reset makes an <svg> in flowing text a block of its own, which stacked
   * the glyph over the name and printed every item onto the next one.
   */
  icon?: ReactNode;
  /**
   * One letter that runs this item while the menu is open.
   *
   * Shown on the right, the way every menu worth using shows it. The letter
   * is also what the menu listens for — see ContextMenu — so a menu can be
   * operated without moving the pointer at all.
   */
  accelerator?: string;
  /** This one opens another list rather than doing something. */
  submenu?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-accelerator={accelerator}
      className={cn(
        // Tighter than a control: a menu is a list to scan, not a row of
        // buttons. Focus is a wash of the same grey as hover rather than a
        // ring — a heavy outline inside a small popover reads as an error.
        "flex h-6 w-full items-center gap-2 rounded-sm px-2 text-left text-xs whitespace-nowrap outline-none disabled:opacity-45 [&_svg]:shrink-0",
        tone === "danger"
          ? "text-danger hover:bg-danger-soft focus-visible:bg-danger-soft"
          : "text-ink-soft hover:bg-surface-muted hover:text-ink focus-visible:bg-surface-muted focus-visible:text-ink",
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden className="flex shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      {/* A glyph still in the children — a caller this kit cannot see —
          stays on the line instead of becoming a block above it. */}
      <span className="min-w-0 flex-1 truncate [&_svg]:mr-1.5 [&_svg]:inline-block [&_svg]:align-[-2px]">
        {children}
      </span>
      {accelerator && (
        <span className="shrink-0 font-mono text-[11px] text-muted uppercase">{accelerator}</span>
      )}
      {submenu && <span className="shrink-0 text-muted">›</span>}
    </button>
  );
}
