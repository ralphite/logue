import { describe, expect, it } from "vitest";
import type { LogueDocument } from "../lib/api";
import {
  documentAdoptionFromResult,
  documentUndoFailureState,
  resolveDocumentUndoFailure,
  resolveDocumentUndoResult,
  SkillApiError,
  type LogueDocumentTombstone,
} from "../lib/skillApi";

const document: LogueDocument = {
  id: "doc_active",
  title: "Draft",
  content: "Draft",
  source_ids: ["mat_source"],
  revision: 1,
  created_at: "2026-08-07T00:00:00Z",
  updated_at: "2026-08-07T00:00:00Z",
};

const tombstone: LogueDocumentTombstone = {
  id: document.id,
  title: "Undone Document",
  revision: 2,
  recovery_revision: 1,
  tombstone: true,
};

describe("canonical Document adoption state", () => {
  it("removes a newly created Document after tombstone Undo", () => {
    const adoption = documentAdoptionFromResult(
      "adopt_create",
      document,
      "document",
    );

    expect(resolveDocumentUndoResult(adoption, tombstone)).toEqual({
      kind: "remove",
      documentId: document.id,
    });
  });

  it("replaces an updated Document with its restored revision", () => {
    const adoption = documentAdoptionFromResult(
      "adopt_replace",
      document,
      "replace",
    );
    const restored = { ...document, revision: 3 };

    expect(resolveDocumentUndoResult(adoption, restored)).toEqual({
      kind: "replace",
      document: restored,
    });
  });

  it("rejects mismatched Host outcomes and preserves 409 status", () => {
    const createAdoption = documentAdoptionFromResult(
      "adopt_create",
      document,
      "document",
    );
    expect(() => resolveDocumentUndoResult(createAdoption, document)).toThrow(
      "Could not undo the new Document.",
    );
    expect(new SkillApiError("changed", 409).status).toBe(409);
  });

  it("classifies terminal conflicts, terminal 4xx, and retryable failures", () => {
    expect(documentUndoFailureState(new SkillApiError("changed", 409))).toBe(
      "conflict",
    );
    expect(documentUndoFailureState(new SkillApiError("offline", 503))).toBe(
      "retryable",
    );
    expect(documentUndoFailureState(new SkillApiError("invalid", 400))).toBe(
      "terminal",
    );
    expect(documentUndoFailureState(new TypeError("Network error"))).toBe(
      "retryable",
    );
  });

  it.each([409, 400, 404])(
    "clears a terminal %s adoption and restores normal actions",
    (status) => {
      const adoption = documentAdoptionFromResult(
        "adopt_replace",
        document,
        "replace",
      );
      const failure = resolveDocumentUndoFailure(
        adoption,
        new SkillApiError("terminal", status),
      );

      expect(failure.adoption).toBeUndefined();
      expect(failure.retryable).toBe(false);
    },
  );

  it.each([
    new SkillApiError("unavailable", 503),
    new TypeError("Network error"),
  ])("retains the same adoption and exposes Retry", (cause) => {
    const adoption = documentAdoptionFromResult(
      "adopt_replace",
      document,
      "replace",
    );
    const failure = resolveDocumentUndoFailure(adoption, cause);

    expect(failure.adoption).toBe(adoption);
    expect(failure.adoption?.id).toBe("adopt_replace");
    expect(failure.retryable).toBe(true);
  });
});
