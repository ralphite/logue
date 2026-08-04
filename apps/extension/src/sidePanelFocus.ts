export interface SidePanelFocusEnvironment {
  visibility: () => DocumentVisibilityState;
  requestFrame: (callback: () => void) => void;
  hasFocus: () => boolean;
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
  let scheduled = false;
  let attempts = 0;
  const maxAttempts = 8;

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    environment.requestFrame(() => {
      scheduled = false;
      if (!pending || environment.visibility() !== "visible") return;
      const active = environment.activeElement();
      environment.focusWindow();
      const target = isPanelEditable(active)
        ? active
        : environment.serverInput() ?? environment.panel();
      target?.focus({ preventScroll: true });
      attempts += 1;
      if (environment.hasFocus()) {
        pending = false;
        return;
      }
      if (attempts < maxAttempts) schedule();
      else pending = false;
    });
  };

  const fulfill = () => {
    if (!pending || environment.visibility() !== "visible") return false;
    schedule();
    return true;
  };

  return {
    request() {
      pending = true;
      attempts = 0;
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
