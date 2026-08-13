import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./cn";

export interface DropdownOption<V extends string = string> {
  value: V;
  label: string;
}

/**
 * A dropdown that looks chosen rather than issued.
 *
 * The native control's popup belongs to the operating system; everything else
 * on the screen belongs to the product, and the mismatch reads as a seam.
 * This one opens the same quiet float every menu here opens: 24px rows, a
 * check on the current value, arrows and Enter, Escape and outside-press to
 * leave. The trigger is the standard 28px control with the standard chevron.
 */
export function Dropdown<V extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: V;
  onChange: (value: V) => void;
  options: readonly DropdownOption<V>[];
  /** What this chooses — read by screen readers, shown by nothing. */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  const current = options.find((one) => one.value === value);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((one) => one.value === value)));
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && root.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    // The chosen row starts visible: a list opened to the wrong scroll
    // position asks the person to find their own current answer.
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (index: number) => {
    const one = options[index];
    if (one) onChange(one.value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "Escape") setOpen(false);
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((was) => Math.min(options.length - 1, was + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((was) => Math.max(0, was - 1));
    } else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(options.length - 1);
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    }
  };

  return (
    <div ref={root} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
        className="flex h-control w-full items-center rounded-[7px] border border-control-line bg-surface bg-[image:var(--logue-chevron)] bg-[length:12px] bg-[position:right_9px_center] bg-no-repeat pr-[26px] pl-2.5 text-left text-[12px] font-[500] text-ink-soft hover:bg-panel"
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ""}</span>
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          role="listbox"
          aria-label={label}
          className="logue-scroll logue-float absolute top-[calc(100%+4px)] left-0 z-popover max-h-72 w-max max-w-72 min-w-full p-1"
        >
          {options.map((one, index) => (
            <button
              key={one.value}
              type="button"
              role="option"
              data-index={index}
              aria-selected={one.value === value}
              // Selection happens on the pointer going down, the way native
              // menus commit — a click that has to finish inside the row is
              // a click that can silently miss.
              onPointerDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
              onPointerEnter={() => setActive(index)}
              className={cn(
                "flex h-6 w-full items-center gap-2 rounded-sm px-2 text-left text-xs whitespace-nowrap outline-none",
                index === active ? "bg-surface-muted text-ink" : "text-ink-soft",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{one.label}</span>
              {one.value === value && (
                <svg viewBox="0 0 24 24" aria-hidden className="h-[11px] w-[11px] shrink-0 text-ink-soft">
                  <path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
