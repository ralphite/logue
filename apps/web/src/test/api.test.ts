import { afterEach, describe, expect, it, vi } from "vitest";
import { getSkills } from "../skillApi";
import { fromApiMaterial, getStatus } from "../api";
import { resolveLogueApiBase } from "../apiBase";

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

  it("uses an English fallback for empty Skill API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));
    await expect(getSkills()).rejects.toThrow("Request failed (502)");
  });
});

describe("resolveLogueApiBase", () => {
  it("uses the current origin for a release served on any Go port", () => {
    expect(resolveLogueApiBase({
      hostname: "127.0.0.1",
      origin: "http://127.0.0.1:18831",
      port: "18831",
      protocol: "http:",
    })).toBe("http://127.0.0.1:18831");
  });

  it("connects the Vite development server to the API on the same host", () => {
    expect(resolveLogueApiBase({
      hostname: "192.168.1.24",
      origin: "http://192.168.1.24:5173",
      port: "5173",
      protocol: "http:",
    })).toBe("http://192.168.1.24:8787");
  });

  it("prefers and normalizes an explicit API base", () => {
    expect(resolveLogueApiBase({
      hostname: "localhost",
      origin: "http://localhost:5173",
      port: "5173",
      protocol: "http:",
    }, " https://logue.example/api/ ")).toBe("https://logue.example/api");
  });
});
