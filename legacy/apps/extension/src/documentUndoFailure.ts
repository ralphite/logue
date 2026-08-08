import { ExtensionApiError } from "./api";

export type ExtensionDocumentUndoFailureKind =
  | "conflict"
  | "retryable"
  | "terminal";

export function classifyExtensionDocumentUndoFailure(
  cause: unknown,
): ExtensionDocumentUndoFailureKind {
  if (cause instanceof ExtensionApiError && cause.status === 409) {
    return "conflict";
  }
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  const retryable = cause instanceof ExtensionApiError
    ? cause.status === 503 ||
      (cause.status === undefined &&
        /network|failed to fetch|connection/i.test(message))
    : cause instanceof TypeError ||
      /network|failed to fetch|connection/i.test(message);
  return retryable ? "retryable" : "terminal";
}
