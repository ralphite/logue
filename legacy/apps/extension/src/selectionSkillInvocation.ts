import type { EditableSelectionSnapshot } from "@logue/ui";
import { isEditableTargetAvailable } from "./dom";

export interface SelectionSkillInvocation {
  snapshot: EditableSelectionSnapshot;
  target: HTMLElement;
  pageHref: string;
}

export type SelectionSkillInvocationState = "current" | "cancelled" | "changed";

/**
 * Skill runs are asynchronous. Only the exact selection that started a run may
 * receive its output; Esc clears it, while a new selection invalidates it.
 */
export function selectionSkillInvocationState({
  invocation,
  currentSnapshot,
  currentTarget,
  currentPageHref,
}: {
  invocation: SelectionSkillInvocation;
  currentSnapshot?: EditableSelectionSnapshot;
  currentTarget: HTMLElement | null;
  currentPageHref: string;
}): SelectionSkillInvocationState {
  if (!currentSnapshot) return "cancelled";
  if (
    currentSnapshot !== invocation.snapshot ||
    currentTarget !== invocation.target ||
    invocation.pageHref !== currentPageHref ||
    !isEditableTargetAvailable(invocation.target)
  ) return "changed";
  return "current";
}
