import { describe, expect, it } from "vitest";
import { AUTOMATIC_TRIES, RECENT_MS, worthRetrying, type Held } from "./unfinished";

const NOW = Date.parse("2026-08-11T12:00:00Z");
const held = (id: string, agoMs: number): Held => ({
  captureId: id,
  seconds: 5,
  createdAt: new Date(NOW - agoMs).toISOString(),
});

describe("what the worker retries by itself", () => {
  it("takes the newest first — that is the one somebody is waiting for", () => {
    const order = worthRetrying([held("old", 60_000), held("new", 1000), held("mid", 20_000)], {}, NOW);
    expect(order.map((one) => one.captureId)).toEqual(["new", "mid", "old"]);
  });

  it("leaves anything older than half an hour to be asked for", () => {
    // A workspace collects recordings that failed for good reasons — silence,
    // a cancelled thought, a test. Retrying all of them would turn each into a
    // Source nobody wanted.
    const items = [held("recent", RECENT_MS - 1000), held("yesterday", 24 * 60 * 60 * 1000)];
    expect(worthRetrying(items, {}, NOW).map((one) => one.captureId)).toEqual(["recent"]);
  });

  it("stops after a few attempts rather than trying forever", () => {
    const one = held("stubborn", 1000);
    expect(worthRetrying([one], { stubborn: AUTOMATIC_TRIES - 1 }, NOW)).toHaveLength(1);
    expect(worthRetrying([one], { stubborn: AUTOMATIC_TRIES }, NOW)).toHaveLength(0);
  });

  it("gives up automatically, never permanently", () => {
    // Past the automatic attempts it is still listed for a person to press.
    // "We stopped guessing" and "we gave up" are different promises.
    const exhausted = held("stubborn", 1000);
    expect(worthRetrying([exhausted], { stubborn: 99 }, NOW)).toHaveLength(0);
    expect(exhausted.captureId).toBe("stubborn");
  });
});

describe("a model that was merely busy", () => {
  const busy = (id: string, agoMs: number): Held => ({
    ...held(id, agoMs),
    message: "The model is busy (503).",
  });

  it("is kept trying long after a real refusal would have been left alone", () => {
    // Three recordings sat saying "the words did not come back" while the log
    // filled with 503s. Nobody decided anything about them — nobody managed to
    // ask yet, which is a different thing.
    const hour = 60 * 60 * 1000;
    expect(worthRetrying([busy("a", 2 * hour)], {}, NOW).map((one) => one.captureId)).toEqual(["a"]);
    expect(worthRetrying([held("b", 2 * hour)], {}, NOW)).toEqual([]);
  });

  it("still stops eventually, rather than asking forever", () => {
    expect(worthRetrying([busy("a", 1000)], { a: 12 }, NOW)).toEqual([]);
    expect(worthRetrying([busy("a", 1000)], { a: 11 }, NOW)).toHaveLength(1);
  });

  it("reads the failure, not the wording of the row", () => {
    expect(worthRetrying([{ ...held("a", 60 * 60 * 1000), message: "high demand" }], {}, NOW)).toHaveLength(1);
    expect(worthRetrying([{ ...held("b", 60 * 60 * 1000), message: "Connect a model in Settings." }], {}, NOW)).toEqual(
      [],
    );
  });
});
