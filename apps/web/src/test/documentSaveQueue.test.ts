import { describe, expect, it } from "vitest";
import { createSerialTaskQueue } from "../documentSaveQueue";

describe("document save queue", () => {
  it("never lets a slower older save finish after a newer save", async () => {
    const enqueue = createSerialTaskQueue();
    const calls: string[] = [];
    let releaseOld: (() => void) | undefined;

    const oldSave = enqueue(async () => {
      calls.push("old:start");
      await new Promise<void>((resolve) => { releaseOld = resolve; });
      calls.push("old:end");
      return "old";
    });
    const newSave = enqueue(async () => {
      calls.push("new:start");
      calls.push("new:end");
      return "new";
    });

    await Promise.resolve();
    expect(calls).toEqual(["old:start"]);
    releaseOld?.();
    await expect(Promise.all([oldSave, newSave])).resolves.toEqual(["old", "new"]);
    expect(calls).toEqual(["old:start", "old:end", "new:start", "new:end"]);
  });

  it("continues after a failed task", async () => {
    const enqueue = createSerialTaskQueue();
    await expect(enqueue(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    await expect(enqueue(async () => "recovered")).resolves.toBe("recovered");
  });
});
