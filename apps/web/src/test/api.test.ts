import { afterEach, describe, expect, it, vi } from "vitest";
import { getAgents } from "../agentApi";
import { fromApiMaterial, getStatus } from "../api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fromApiMaterial", () => {
  it("preserves provenance and supplies empty organization arrays", () => {
    const item = fromApiMaterial({
      id: "one",
      kind: "selection",
      status: "unfiled",
      content: "source",
      parent_ids: ["parent"],
      organization: { status: "needs_review", confidence: 0.5, reason: "Organization is unclear" },
      created_at: "2026-08-01T00:00:00Z",
    });
    expect(item.parentIds).toEqual(["parent"]);
    expect(item.projects).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.organization).toEqual({ status: "needs_review", confidence: 0.5, reason: "Organization is unclear" });
  });

  it("uses an English fallback for empty API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(getStatus()).rejects.toThrow("Request failed (503)");
  });

  it("uses an English fallback for empty Agent API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));
    await expect(getAgents()).rejects.toThrow("Request failed (502)");
  });
});
