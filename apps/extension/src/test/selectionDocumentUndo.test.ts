import { describe, expect, it } from "vitest";
import { ExtensionApiError } from "../api";
import { resolveSelectionDocumentUndoFailure } from "../selectionDocumentUndo";

const candidate: {
  text: string;
  documentAdoption: {
    id: string;
    documentId: string;
    documentRevision: number;
    action: "replace";
  };
  documentUndoRetryable?: boolean;
} = {
  text: "Candidate",
  documentAdoption: {
    id: "adopt-1",
    documentId: "doc-1",
    documentRevision: 2,
    action: "replace",
  },
};

describe("Selection/Page Document Undo failure state", () => {
  it.each([409, 400, 404])(
    "clears a terminal %s adoption and restores normal actions",
    (status) => {
      const failure = resolveSelectionDocumentUndoFailure(
        candidate,
        new ExtensionApiError("terminal", undefined, undefined, status),
      );

      expect(failure.candidate.documentAdoption).toBeUndefined();
      expect(failure.candidate.documentUndoRetryable).toBe(false);
    },
  );

  it.each([
    new ExtensionApiError("unavailable", undefined, undefined, 503),
    new TypeError("Network error"),
  ])("retains the same adoption and exposes Retry", (cause) => {
    const failure = resolveSelectionDocumentUndoFailure(candidate, cause);

    expect(failure.candidate.documentAdoption?.id).toBe("adopt-1");
    expect(failure.candidate.documentUndoRetryable).toBe(true);
  });
});
