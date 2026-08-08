import { MoreHorizontal } from "lucide-react";
import {
  Children,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function RowActions({
  label,
  primary,
  children,
}: {
  label: string;
  primary: ReactNode;
  children?: ReactNode;
}) {
  const menuItems = Children.toArray(children);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="flex items-center gap-1.5" ref={rootRef}>
      {primary}
      {menuItems.length ? (
        <div className="relative">
          <button
            type="button"
            className="inline-flex size-[30px] items-center justify-center rounded-md border border-transparent text-muted hover:border-line hover:bg-surface-muted hover:text-ink focus-visible:border-line focus-visible:bg-surface-muted focus-visible:text-ink aria-expanded:border-line aria-expanded:bg-surface-muted aria-expanded:text-ink"
            aria-label={label}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <MoreHorizontal size={16} />
          </button>
          {open ? (
            <div className="absolute top-[calc(100%+5px)] right-0 z-20 grid w-[210px] gap-[5px] rounded-lg border border-line bg-surface p-[7px] shadow-[0_10px_30px_rgba(30,31,29,0.12)] [&>*]:w-full" role="group" aria-label={label}>
              {menuItems}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
