import type { ExtensionDocumentAdoption } from "./api";
import { classifyExtensionDocumentUndoFailure } from "./documentUndoFailure";

interface SelectionDocumentUndoCandidate {
  documentAdoption?: ExtensionDocumentAdoption;
  documentUndoRetryable?: boolean;
}

export function resolveSelectionDocumentUndoFailure<
  T extends SelectionDocumentUndoCandidate,
>(candidate: T, cause: unknown): { candidate: T; error: string } {
  const kind = classifyExtensionDocumentUndoFailure(cause);
  if (kind === "retryable") {
    return {
      candidate: { ...candidate, documentUndoRetryable: true },
      error: "Couldn’t undo this Document yet. Try again.",
    };
  }
  return {
    candidate: {
      ...candidate,
      documentAdoption: undefined,
      documentUndoRetryable: false,
    },
    error:
      kind === "conflict"
        ? "This Document changed, so it wasn’t undone."
        : "Couldn’t undo this Document. The Candidate is still available.",
  };
}
