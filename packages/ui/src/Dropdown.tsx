import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "./cn";

export interface DropdownOption<V extends string = string> {
  value: V;
  label: string;
}

/** How long a typed prefix keeps accumulating before it starts over. */
const TYPEAHEAD_MS = 600;

/**
 * A select that looks chosen rather than issued.
 *
 * The native control's popup belongs to the operating system; everything else
 * on the screen belongs to the product, and the mismatch reads as a seam.
 * The behaviour, though, is the native one's, kept deliberately: arrows move,
 * Enter and click choose, Escape and Tab and an outside press leave, typing
 * jumps to the option that starts that way, and the list flips upward when
 * the screen ends before it does. A dropdown is not the place to invent.
 */
export function Dropdown<V extends string>({
  value,
  onChange,
  options,
  label,
  disabled = false,
  className,
}: {
  value: V;
  onChange: (value: V) => void;
  options: readonly DropdownOption<V>[];
  /** What this chooses — read by screen readers, shown by nothing. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /** Which way the list opens: down until the window says otherwise. */
  const [side, setSide] = useState<"below" | "above">("below");
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef<{ prefix: string; at: number }>({ prefix: "", at: 0 });
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

  // Measured after it exists, flipped before anyone sees it wrong: a list
  // that would run off the bottom of the window opens upward instead.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = root.current?.getBoundingClientRect();
    const popup = list.current?.getBoundingClientRect();
    if (!anchor || !popup) return;
    setSide(
      anchor.bottom + popup.height + 8 > window.innerHeight && anchor.top - popup.height - 8 > 0
        ? "above"
        : "below",
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // The chosen row starts visible: a list opened to the wrong scroll
    // position asks the person to find their own current answer.
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (index: number) => {
    const one = options[index];
    if (one) onChange(one.value);
    setOpen(false);
  };

  /** Typing jumps to the option that starts that way — the native habit. */
  const seek = (key: string) => {
    const now = Date.now();
    const prefix = (now - typed.current.at < TYPEAHEAD_MS ? typed.current.prefix : "") + key.toLowerCase();
    typed.current = { prefix, at: now };
    const found = options.findIndex((one) => one.label.toLowerCase().startsWith(prefix));
    if (found >= 0) {
      if (open) setActive(found);
      else choose(found);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) seek(event.key);
      return;
    }
    if (event.key === "Escape") {
      // Ours to spend only while the list is open — a closed control lets
      // Escape mean whatever the surface around it says.
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") {
      // Tab moves on; a list left floating over the next field would be
      // a popup nobody is talking to.
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((was) => Math.min(options.length - 1, was + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((was) => Math.max(0, was - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      seek(event.key);
    }
  };

  return (
    <div ref={root} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
        onBlur={(event) => {
          // Focus left the control entirely — pointer choices inside the
          // list keep focus here, so this only fires on a real departure.
          if (!(event.relatedTarget instanceof Node) || !root.current?.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
        className={cn(
          "flex h-control w-full items-center rounded-[7px] border bg-surface bg-[image:var(--logue-chevron)] bg-[length:12px] bg-[position:right_9px_center] bg-no-repeat pr-[26px] pl-2.5 text-left text-[12px] font-[500] text-ink-soft",
          open ? "border-accent-line" : "border-control-line hover:bg-panel",
          "disabled:pointer-events-none disabled:bg-panel disabled:text-muted",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ""}</span>
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          role="listbox"
          aria-label={label}
          className={cn(
            "logue-scroll logue-float absolute left-0 z-popover max-h-72 w-max max-w-72 min-w-full p-1",
            side === "below" ? "top-[calc(100%+4px)]" : "bottom-[calc(100%+4px)]",
          )}
        >
          {options.map((one, index) => (
            <button
              key={one.value}
              type="button"
              role="option"
              id={`${id}-${index}`}
              data-index={index}
              tabIndex={-1}
              aria-selected={one.value === value}
              // The press must not move focus off the trigger — focus staying
              // put is what keeps the keyboard working after a mouse visit.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
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
