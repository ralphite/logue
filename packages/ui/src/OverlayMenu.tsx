import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

export const PRODUCT_OVERLAY_LAYER = 2_147_483_000;

export type OverlayMenuPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";
export type OverlayMenuCloseReason = "outside" | "escape" | "tab" | "trigger";

export interface OverlayMenuTriggerProps {
  ref: (element: HTMLButtonElement | null) => void;
  "aria-controls": string | undefined;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

interface OverlayPosition {
  left: number;
  top: number;
  maxHeight: number;
  ready: boolean;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function menuItems(menu: HTMLElement | null) {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(
    '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
  ));
}

function focusNextToTrigger(trigger: HTMLButtonElement, menu: HTMLElement | null, backwards: boolean) {
  const root = trigger.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot)) return;
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !menu?.contains(element) && element.getAttribute("aria-hidden") !== "true");
  const triggerIndex = focusable.indexOf(trigger);
  const next = focusable[triggerIndex + (backwards ? -1 : 1)];
  if (next) next.focus({ preventScroll: true });
  else trigger.blur();
}

export function calculateOverlayMenuPosition({
  trigger,
  menu,
  placement,
  viewportWidth,
  viewportHeight,
  margin = 8,
  gap = 6,
}: {
  trigger: Pick<DOMRect, "left" | "right" | "top" | "bottom">;
  menu: Pick<DOMRect, "width" | "height">;
  placement: OverlayMenuPlacement;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  gap?: number;
}) {
  const wantsTop = placement.startsWith("top");
  const roomAbove = trigger.top - margin - gap;
  const roomBelow = viewportHeight - trigger.bottom - margin - gap;
  const useTop = wantsTop
    ? menu.height <= roomAbove || roomAbove >= roomBelow
    : !(menu.height <= roomBelow || roomBelow >= roomAbove);
  const availableHeight = Math.max(0, useTop ? roomAbove : roomBelow);
  const maxHeight = Math.max(0, Math.min(menu.height, availableHeight, viewportHeight - margin * 2));
  const naturalTop = useTop
    ? trigger.top - gap - Math.min(menu.height, maxHeight)
    : trigger.bottom + gap;
  const naturalLeft = placement.endsWith("end") ? trigger.right - menu.width : trigger.left;
  const maxLeft = Math.max(margin, viewportWidth - margin - menu.width);
  const maxTop = Math.max(margin, viewportHeight - margin - Math.min(menu.height, maxHeight));

  return {
    left: Math.min(Math.max(naturalLeft, margin), maxLeft),
    top: Math.min(Math.max(naturalTop, margin), maxTop),
    maxHeight,
  };
}

export function OverlayMenu({
  open,
  onOpenChange,
  trigger,
  triggerRef,
  children,
  ariaLabel,
  placement = "bottom-start",
  menuClassName = "min-w-48 rounded-lg border border-[#ddddda] bg-white p-1 shadow-[0_12px_32px_rgba(20,21,18,0.16)]",
  menuStyle,
  onMenuPointerDown,
}: {
  open: boolean;
  onOpenChange: (open: boolean, reason: OverlayMenuCloseReason) => void;
  trigger: (props: OverlayMenuTriggerProps) => ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
  ariaLabel: string;
  placement?: OverlayMenuPlacement;
  menuClassName?: string;
  menuStyle?: CSSProperties;
  onMenuPointerDown?: PointerEventHandler<HTMLDivElement>;
}) {
  const menuId = useId();
  const internalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<OverlayPosition>({ left: 8, top: 8, maxHeight: 320, ready: false });
  const focusAfterOpenRef = useRef<"first" | "last" | undefined>(undefined);

  const setTriggerElement = useCallback((element: HTMLButtonElement | null) => {
    internalTriggerRef.current = element;
    assignRef(triggerRef, element);
  }, [triggerRef]);

  const updatePosition = useCallback(() => {
    const triggerElement = internalTriggerRef.current;
    const menuElement = menuRef.current;
    if (!triggerElement || !menuElement) return;
    const next = calculateOverlayMenuPosition({
      trigger: triggerElement.getBoundingClientRect(),
      menu: menuElement.getBoundingClientRect(),
      placement,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setPosition({ ...next, ready: true });
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition((current) => ({ ...current, ready: false }));
      return;
    }
    updatePosition();
    const onViewportChange = () => updatePosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(onViewportChange);
    if (internalTriggerRef.current) observer?.observe(internalTriggerRef.current);
    if (menuRef.current) observer?.observe(menuRef.current);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      observer?.disconnect();
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open || !position.ready || !focusAfterOpenRef.current) return;
    const items = menuItems(menuRef.current);
    const next = focusAfterOpenRef.current === "last" ? items.at(-1) : items[0];
    focusAfterOpenRef.current = undefined;
    next?.focus({ preventScroll: true });
  }, [open, position.ready]);

  useLayoutEffect(() => {
    if (!open) return;
    const ownerDocument = internalTriggerRef.current?.ownerDocument ?? document;
    const onPointerDown = (event: PointerEvent) => {
      const path = event.composedPath();
      if (path.includes(internalTriggerRef.current as EventTarget) || path.includes(menuRef.current as EventTarget)) return;
      onOpenChange(false, "outside");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false, "escape");
        internalTriggerRef.current?.focus({ preventScroll: true });
      } else if (event.key === "Tab" && event.composedPath().includes(menuRef.current as EventTarget)) {
        event.preventDefault();
        if (internalTriggerRef.current) focusNextToTrigger(internalTriggerRef.current, menuRef.current, event.shiftKey);
        onOpenChange(false, "tab");
      }
    };
    ownerDocument.addEventListener("pointerdown", onPointerDown, true);
    ownerDocument.addEventListener("keydown", onKeyDown, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
      ownerDocument.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onOpenChange, open]);

  function openFromKeyboard(destination: "first" | "last") {
    if (open) {
      const items = menuItems(menuRef.current);
      const next = destination === "last" ? items.at(-1) : items[0];
      next?.focus({ preventScroll: true });
      return;
    }
    focusAfterOpenRef.current = destination;
    onOpenChange(true, "trigger");
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = menuItems(menuRef.current);
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(event.target as HTMLElement);
    if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items.at(-1)?.focus();
    else if (event.key === "ArrowDown") items[(currentIndex + 1 + items.length) % items.length]?.focus();
    else items[(currentIndex - 1 + items.length) % items.length]?.focus();
  }

  const triggerNode = trigger({
    ref: setTriggerElement,
    "aria-controls": open ? menuId : undefined,
    "aria-expanded": open,
    "aria-haspopup": "menu",
    onClick: () => onOpenChange(!open, "trigger"),
    onKeyDown: (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openFromKeyboard("first");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        openFromKeyboard("last");
      }
    },
  });
  const triggerRoot = internalTriggerRef.current?.getRootNode();
  const portalContainer = typeof ShadowRoot !== "undefined" && triggerRoot instanceof ShadowRoot
    ? triggerRoot
    : internalTriggerRef.current?.ownerDocument.body ?? (typeof document === "undefined" ? undefined : document.body);

  return (
    <>
      {triggerNode}
      {open && portalContainer && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className={menuClassName}
          onKeyDown={onMenuKeyDown}
          onPointerDown={onMenuPointerDown}
          style={{
            ...menuStyle,
            position: "fixed",
            left: position.left,
            top: position.top,
            zIndex: PRODUCT_OVERLAY_LAYER,
            maxHeight: position.maxHeight,
            maxWidth: menuStyle?.maxWidth ?? "calc(100vw - 16px)",
            overflowY: "auto",
            visibility: position.ready ? "visible" : "hidden",
          }}
        >
          {children}
        </div>,
        portalContainer,
      )}
    </>
  );
}
