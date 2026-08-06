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
    <div className="v2-row-actions" ref={rootRef}>
      {primary}
      {menuItems.length ? (
        <div className="v2-row-actions-menu-wrap">
          <button
            type="button"
            className="v2-row-actions-trigger"
            aria-label={label}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <MoreHorizontal size={16} />
          </button>
          {open ? (
            <div className="v2-row-actions-menu" role="group" aria-label={label}>
              {menuItems}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
