import { describe, expect, it } from "vitest";
import { ExtensionApiError } from "../api";
import { resolveSidePanelDocumentUndoFailure } from "../sidePanelDocumentUndo";
import type { CommandResult } from "../sidePanelModels";

const result: CommandResult = {
  runId: "run-1",
  originalText: "Candidate",
  text: "Candidate",
  sources: [],
  targetKey: "target-1",
  sourceURL: "https://example.com",
  documentAdoption: {
    id: "adopt-1",
    documentId: "doc-1",
    documentRevision: 2,
    action: "replace",
  },
};

describe("Side Panel Document Undo failure state", () => {
  it("clears a terminal 409 adoption without offering Retry", () => {
    const failure = resolveSidePanelDocumentUndoFailure(
      result,
      new ExtensionApiError("changed", undefined, undefined, 409),
    );

    expect(failure.result.documentAdoption).toBeUndefined();
    expect(failure.error).toEqual({
      kind: "save",
      message: "This Document changed, so it wasn’t undone.",
    });
  });

  it.each([
    new ExtensionApiError("unavailable", undefined, undefined, 503),
    new TypeError("Network error"),
  ])("retains the same adoption and Retry for a recoverable failure", (cause) => {
    const failure = resolveSidePanelDocumentUndoFailure(result, cause);

    expect(failure.result).toBe(result);
    expect(failure.result.documentAdoption?.id).toBe("adopt-1");
    expect(failure.error.action).toBe("retry");
  });

  it("clears other terminal failures without offering Retry", () => {
    const failure = resolveSidePanelDocumentUndoFailure(
      result,
      new ExtensionApiError("invalid", undefined, undefined, 400),
    );

    expect(failure.result.documentAdoption).toBeUndefined();
    expect(failure.error.action).toBeUndefined();
  });
});
