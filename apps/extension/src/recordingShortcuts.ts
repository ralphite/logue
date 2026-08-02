export type RecordingShortcutAction = "stop-and-insert" | "cancel";

export function recordingShortcutAction({
  open,
  mode,
  phase,
  key,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false,
  isComposing = false,
  repeat = false,
}: {
  open: boolean;
  mode: string;
  phase: string;
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
}): RecordingShortcutAction | undefined {
  if (!open || mode !== "input" || phase !== "recording" || isComposing || repeat || altKey || ctrlKey || metaKey || shiftKey) return undefined;
  if (key === "Enter") return "stop-and-insert";
  if (key === "Escape") return "cancel";
  return undefined;
}
