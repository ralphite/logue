import { describe, expect, it, vi } from "vitest";
import {
  completeSelectionActionKeep,
  prepareSelectionActionKeep,
} from "../selectionActionKeep";

describe("selection action Keep state", () => {
  const target = {
    surface: "inline-selection",
    url: "https://docs.google.com/document/d/example",
    target_key: "selection:run-1",
  };

  it("reuses the same adoption after a failed request", () => {
    const createId = vi.fn().mockReturnValueOnce("keep-1");
    const pending = prepareSelectionActionKeep(
      undefined,
      "Frozen candidate",
      target,
      createId,
    );
    const retry = prepareSelectionActionKeep(
      pending,
      "Frozen candidate",
      { ...target },
      createId,
    );

    expect(retry).toBe(pending);
    expect(retry.id).toBe("keep-1");
    expect(createId).toHaveBeenCalledTimes(1);
  });

  it("freezes the successful content and target for Undo", () => {
    const pending = prepareSelectionActionKeep(
      undefined,
      "Frozen candidate",
      target,
      () => "keep-1",
    );
    const adoption = completeSelectionActionKeep("run-1", pending);
    target.target_key = "selection:another-run";

    expect(adoption).toEqual({
      runId: "run-1",
      id: "keep-1",
      content: "Frozen candidate",
      target: {
        surface: "inline-selection",
        url: "https://docs.google.com/document/d/example",
        target_key: "selection:run-1",
      },
    });
  });

  it("creates a new identity when content changes", () => {
    const previous = prepareSelectionActionKeep(
      undefined,
      "First candidate",
      target,
      () => "keep-1",
    );
    const next = prepareSelectionActionKeep(
      previous,
      "Edited candidate",
      target,
      () => "keep-2",
    );

    expect(next.id).toBe("keep-2");
  });
});
