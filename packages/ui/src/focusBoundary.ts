import { useEffect, useLayoutEffect, useRef } from "react";

const focusableSelector = [
  "[data-autofocus]",
  "[autofocus]",
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(root: HTMLElement | null) {
  if (!root) return [];
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
  const preferred = root.querySelector<HTMLElement>(
    "[data-autofocus], [autofocus]",
  );
  return preferred
    ? [preferred, ...items.filter((item) => item !== preferred)]
    : items;
}

export function useFocusBoundary<T extends HTMLElement>({
  open,
  onClose,
  trap = false,
}: {
  open: boolean;
  onClose: () => void;
  trap?: boolean;
}) {
  const rootRef = useRef<T | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (open && !wasOpenRef.current) {
      returnFocusRef.current =
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      window.requestAnimationFrame(() => {
        const root = rootRef.current;
        (focusableElements(root)[0] ?? root)?.focus({ preventScroll: true });
      });
    } else if (!open && wasOpenRef.current) {
      const target = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (target?.isConnected) target.focus({ preventScroll: true });
      });
      returnFocusRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ownerDocument = rootRef.current?.ownerDocument ?? document;
    const onKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const activeInside = root.contains(ownerDocument.activeElement);
      if (event.key === "Escape" && (trap || activeInside)) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (!trap || event.key !== "Tab" || !activeInside) return;
      const items = focusableElements(root);
      if (!items.length) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && ownerDocument.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && ownerDocument.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    ownerDocument.addEventListener("keydown", onKeyDown, true);
    return () => ownerDocument.removeEventListener("keydown", onKeyDown, true);
  }, [open, trap]);

  return rootRef;
}
