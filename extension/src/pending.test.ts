import { beforeEach, describe, expect, it, vi } from "vitest";
import { all, BUDGET, forget, keep, LIMIT } from "./pending";

/** Just enough of `chrome.storage.local` to hold one key. */
function stubStorage(): { store: Record<string, unknown>; fail: () => void } {
  const store: Record<string, unknown> = {};
  let broken = false;
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (key: string) => (broken ? Promise.reject(new Error("no")) : Promise.resolve({ [key]: store[key] })),
        set: (values: Record<string, unknown>) => {
          if (broken) return Promise.reject(new Error("quota"));
          Object.assign(store, values);
          return Promise.resolve();
        },
      },
    },
  });
  return { store, fail: () => (broken = true) };
}

const recording = (audio = "aaa") => ({ audio, mediaType: "audio/webm" });

describe("recordings the Host was not there to take", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps one, and gives it back", async () => {
    stubStorage();
    expect(await keep(recording("hello"))).toBe(true);
    const waiting = await all();
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.audio).toBe("hello");
    expect(waiting[0]?.at).toBeTruthy();
  });

  it("keeps them in the order they were spoken", async () => {
    stubStorage();
    await keep(recording("first"));
    await keep(recording("second"));
    expect((await all()).map((one) => one.audio)).toEqual(["first", "second"]);
  });

  it("stops at the limit rather than filling the quota", async () => {
    stubStorage();
    // Sequentially on purpose: the limit is about how many are already there.
    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < LIMIT; i++) expect(await keep(recording(`r${i}`))).toBe(true);
    // The caller says so out loud; it does not pretend the audio was kept.
    expect(await keep(recording("one too many"))).toBe(false);
    expect(await all()).toHaveLength(LIMIT);
  });

  it("stops at the byte budget, not only at the count", async () => {
    // Ten one-minute notes fit; ten ten-minute ones are two and a half times
    // what this storage holds. Counting recordings was the wrong unit, and the
    // quota would have refused the write instead of us refusing it.
    stubStorage();
    const long = "a".repeat(Math.floor(BUDGET / 2) + 1);
    expect(await keep(recording(long))).toBe(true);
    expect(await keep(recording(long))).toBe(false);
    expect(await all()).toHaveLength(1);
  });

  it("says no rather than yes when storage refuses", async () => {
    const { fail } = stubStorage();
    fail();
    expect(await keep(recording())).toBe(false);
  });

  it("reads as empty rather than throwing when storage is unavailable", async () => {
    const { fail } = stubStorage();
    fail();
    expect(await all()).toEqual([]);
  });

  it("forgets only the one that arrived", async () => {
    stubStorage();
    await keep(recording("kept"));
    await keep(recording("sent"));
    const [, sent] = await all();
    await forget(sent!.id);
    expect((await all()).map((one) => one.audio)).toEqual(["kept"]);
  });

  it("ignores anything in storage that is not a recording", async () => {
    const { store } = stubStorage();
    store["logue:pending-voice"] = [{ nonsense: true }, { id: "x", audio: "real" }];
    expect((await all()).map((one) => one.audio)).toEqual(["real"]);
  });
});
