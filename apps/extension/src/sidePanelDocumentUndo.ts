import { ExtensionApiError } from "./api";
import type { CommandResult, LocalError } from "./sidePanelModels";

export interface SidePanelDocumentUndoFailure {
  result: CommandResult;
  error: LocalError;
}

export function resolveSidePanelDocumentUndoFailure(
  result: CommandResult,
  cause: unknown,
): SidePanelDocumentUndoFailure {
  if (cause instanceof ExtensionApiError && cause.status === 409) {
    return {
      result: { ...result, documentAdoption: undefined },
      error: {
        kind: "save",
        message: "This Document changed, so it wasn’t undone.",
      },
    };
  }
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  const retryable = cause instanceof ExtensionApiError
    ? cause.status === 503 || (cause.status === undefined && /network|failed to fetch|connection/i.test(message))
    : cause instanceof TypeError || /network|failed to fetch|connection/i.test(message);
  if (retryable) {
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
