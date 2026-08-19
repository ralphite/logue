import { afterEach, expect, test } from "vitest";
import { orphaned, send } from "./messages";

/**
 * The tests stand a fake Chrome up in place of the real one.
 *
 * `globalThis.chrome` is typed as the full API surface and these fakes are
 * two properties of it, so every assignment here is a deliberate narrowing —
 * declared once rather than argued with at each line.
 */
const runtime: { chrome?: unknown } = globalThis;
const real = runtime.chrome;
afterEach(() => {
  runtime.chrome = real;
});

/**
 * The check that says "this script has outlived its extension" must survive
 * the very state it detects.
 *
 * Chrome does not answer `undefined` for `chrome.runtime.id` once the context
 * is invalidated — it throws. So this returned by throwing, out of the `catch`
 * that `send` calls it from, which turned "no answer" into a rejected promise.
 * Every caller waiting on a reply was stranded silently, and the handler that
 * takes the dead surfaces off the page never ran: the bar stayed, with every
 * button reaching nothing.
 */
test("an invalidated context reads as orphaned rather than throwing", () => {
  runtime.chrome = {
    get runtime(): never {
      throw new Error("Extension context invalidated.");
    },
  };

  expect(orphaned()).toBe(true);
});

test("send answers undefined when the extension is gone, and does not reject", async () => {
  runtime.chrome = {
    get runtime(): never {
      throw new Error("Extension context invalidated.");
    },
  };

  await expect(send({ type: "logue:build" })).resolves.toBeUndefined();
});

/**
 * A reply that never comes must not wait for ever.
 *
 * `sendMessage` promises a reply and does not always keep it: a worker torn
 * down mid-request settles the promise neither way. That is what left the
 * recording bar on "Starting mic…" with no error and no way forward.
 */
test("a deadline turns a reply that never arrives into no answer", async () => {
  runtime.chrome = {
    runtime: {
      id: "test",
      sendMessage: () => new Promise(() => undefined),
    },
  };

  await expect(send({ type: "logue:build" }, 20)).resolves.toBeUndefined();
});
