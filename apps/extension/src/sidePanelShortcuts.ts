export type SidePanelShortcutAction = "record" | "stop" | "cancel" | "close";

export interface SidePanelShortcutInput {
  key: string;
  phase: "idle" | "starting" | "recording" | "processing" | "error";
  target?: EventTarget | null;
  isComposing?: boolean;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface SidePanelShortcutHandlers {
  pendingInsert: boolean;
  onRecord: () => void;
  onStop: () => void;
  onCancel: () => void;
  onClose: () => void;
}

function isEditableTarget(target: EventTarget | null | undefined) {
  return target instanceof HTMLElement && (
    target.matches("input, textarea, select") ||
    target.isContentEditable ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

export function sidePanelShortcutAction(input: SidePanelShortcutInput): SidePanelShortcutAction | undefined {
  if (
    input.isComposing || input.repeat || input.altKey || input.ctrlKey || input.metaKey || input.shiftKey ||
    isEditableTarget(input.target)
  ) return undefined;

  if (input.phase === "recording") {
    if (input.key === "Enter") return "stop";
    if (input.key === "Escape") return "cancel";
    return undefined;
  }
  if (input.phase === "starting" && input.key === "Escape") return "cancel";
  if ((input.phase === "idle" || input.phase === "error") && input.key.toLowerCase() === "r") return "record";
  if ((input.phase === "idle" || input.phase === "error") && input.key === "Escape") return "close";
  return undefined;
}

export function handleSidePanelShortcut(event: KeyboardEvent, phase: SidePanelShortcutInput["phase"], handlers: SidePanelShortcutHandlers) {
  const action = sidePanelShortcutAction({
    key: event.key,
    phase,
    target: event.target,
    isComposing: event.isComposing,
    repeat: event.repeat,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  });
  if (!action) return false;

  event.preventDefault();
  if (action === "record" && !handlers.pendingInsert) handlers.onRecord();
  if (action === "stop") handlers.onStop();
  if (action === "cancel") handlers.onCancel();
  if (action === "close") handlers.onClose();
  return true;
}
