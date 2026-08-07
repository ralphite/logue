import { classifyExtensionDocumentUndoFailure } from "./documentUndoFailure";
import type { CommandResult, LocalError } from "./sidePanelModels";

export interface SidePanelDocumentUndoFailure {
  result: CommandResult;
  error: LocalError;
}

export function resolveSidePanelDocumentUndoFailure(
  result: CommandResult,
  cause: unknown,
): SidePanelDocumentUndoFailure {
  const kind = classifyExtensionDocumentUndoFailure(cause);
  if (kind === "conflict") {
    return {
      result: { ...result, documentAdoption: undefined },
      error: {
        kind: "save",
        message: "This Document changed, so it wasn’t undone.",
      },
    };
  }
  if (kind === "retryable") {
    return {
      result,
      error: {
        kind: "save",
        message: "Couldn’t undo this Document yet. Try again.",
        action: "retry",
      },
    };
  }
  return {
    result: { ...result, documentAdoption: undefined },
    error: {
      kind: "save",
      message: "Couldn’t undo this Document. The Candidate is still available.",
    },
  };
}
