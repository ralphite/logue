import { describe, expect, it } from "vitest";
import { fromApiMaterial } from "../api";

describe("fromApiMaterial", () => {
  it("preserves provenance and supplies empty organization arrays", () => {
    const item = fromApiMaterial({
      id: "one",
      kind: "selection",
      status: "unfiled",
      content: "source",
      parent_ids: ["parent"],
      organization: { status: "needs_review", confidence: 0.5, reason: "归属不明确" },
      created_at: "2026-08-01T00:00:00Z",
    });
    expect(item.parentIds).toEqual(["parent"]);
    expect(item.projects).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.organization).toEqual({ status: "needs_review", confidence: 0.5, reason: "归属不明确" });
  });
});
