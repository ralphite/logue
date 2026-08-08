import { describe, expect, it, vi } from "vitest";
import { saveThenRefreshPageHistory, shouldLoadPageHistory, shouldShowPageHistory } from "../sidePanelPageHistory";

describe("side panel page history", () => {
  it("loads and shows page history for page, input, and selection capture, but never for generation", () => {
    expect(shouldLoadPageHistory("page")).toBe(true);
    expect(shouldLoadPageHistory("input")).toBe(true);
    expect(shouldLoadPageHistory("selection")).toBe(true);
    expect(shouldLoadPageHistory("generate")).toBe(false);
    expect(shouldShowPageHistory(true, "selection", 1)).toBe(true);
    expect(shouldShowPageHistory(true, "generate", 1)).toBe(false);
    expect(shouldShowPageHistory(false, "page", 1)).toBe(false);
    expect(shouldShowPageHistory(true, "page", 0)).toBe(false);
  });

  it("refreshes the page list only after a successful save", async () => {
    const calls: string[] = [];
    const save = vi.fn(async () => {
      calls.push("save");
      return { id: "newest" };
    });
    const refresh = vi.fn(async () => { calls.push("refresh"); });

    await expect(saveThenRefreshPageHistory(save, refresh)).resolves.toEqual({ id: "newest" });
    expect(calls).toEqual(["save", "refresh"]);

    await expect(saveThenRefreshPageHistory(async () => { throw new Error("save failed"); }, refresh)).rejects.toThrow("save failed");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
