export function shouldDismissSelectionSkills(
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
  hasSelection: boolean,
  recording: boolean,
) {
  return event.key === "Escape" &&
    !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
    hasSelection && !recording;
}
