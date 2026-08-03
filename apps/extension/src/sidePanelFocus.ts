export interface SidePanelFocusEnvironment {
  visibility: () => DocumentVisibilityState;
  requestFrame: (callback: () => void) => void;
  focusWindow: () => void;
  activeElement: () => Element | null;
  serverInput: () => HTMLElement | null;
  panel: () => HTMLElement | null;
}

export function isPanelEditable(element: Element | null): element is HTMLElement {
  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable);
}

export function createSidePanelFocusController(environment: SidePanelFocusEnvironment) {
  let pending = false;

  const fulfill = () => {
    if (!pending || environment.visibility() !== "visible") return false;
    pending = false;
    environment.requestFrame(() => {
      const active = environment.activeElement();
      environment.focusWindow();
      const target = isPanelEditable(active)
        ? active
        : environment.serverInput() ?? environment.panel();
      target?.focus({ preventScroll: true });
    });
    return true;
  };

  return {
    request() {
      pending = true;
      return fulfill();
    },
    visibilityChanged() {
      return fulfill();
    },
    isPending() {
      return pending;
    },
  };
}

export type SidePanelFocusController = ReturnType<typeof createSidePanelFocusController>;
