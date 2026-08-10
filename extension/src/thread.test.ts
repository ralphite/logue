import { beforeEach, describe, expect, it, vi } from "vitest";
import { pageKey, readThread, writeThread, clearThread, REMEMBERED_PAGES } from "./thread";

/** A stand-in for chrome.storage.local: one object, get and set and remove. */
function storage() {
  let bag: Record<string, unknown> = {};
  return {
    bag: () => bag,
    reset: (initial: Record<string, unknown> = {}) => {
      bag = { ...initial };
    },
    local: {
      get: (keys: string | string[]) => {
        const wanted = Array.isArray(keys) ? keys : [keys];
        return Promise.resolve(Object.fromEntries(wanted.filter((k) => k in bag).map((k) => [k, bag[k]])));
      },
      set: (values: Record<string, unknown>) => {
        Object.assign(bag, values);
        return Promise.resolve();
      },
      remove: (key: string) => {
        delete bag[key];
        return Promise.resolve();
      },
    },
  };
}

const store = storage();
vi.stubGlobal("chrome", { storage: { local: store.local } });

const said = (text: string) => [{ from: "you" as const, text, at: "2026-08-10T00:00:00Z" }];

describe("one conversation per page", () => {
  beforeEach(() => store.reset());

  it("keeps two pages apart", async () => {
    await writeThread("https://example.com/article", said("what is this about?"), "2026-08-10T01:00:00Z");
    await writeThread("https://docs.google.com/document/d/abc", said("does Logue work here?"), "2026-08-10T02:00:00Z");

    expect((await readThread("https://example.com/article"))[0]?.text).toBe("what is this about?");
    expect((await readThread("https://docs.google.com/document/d/abc"))[0]?.text).toBe("does Logue work here?");
  });

  it("has nothing to say on a page nobody has asked about", async () => {
    await writeThread("https://example.com/article", said("hello"), "2026-08-10T01:00:00Z");
    expect(await readThread("https://example.com/somewhere-else")).toEqual([]);
  });

  it("comes back when you do", async () => {
    await writeThread("https://example.com/article", said("summarise this"), "2026-08-10T01:00:00Z");
    await writeThread("https://other.example/page", said("and this"), "2026-08-10T02:00:00Z");
    expect((await readThread("https://example.com/article"))[0]?.text).toBe("summarise this");
  });

  /** A table of contents is not a different page. */
  it("treats a fragment as the same page", () => {
    expect(pageKey("https://example.com/a?x=1#section-2")).toBe(pageKey("https://example.com/a?x=1#section-9"));
    expect(pageKey("https://example.com/a?x=1")).not.toBe(pageKey("https://example.com/a?x=2"));
  });

  it("forgets the oldest page rather than growing for ever", async () => {
    // One after another on purpose: each write reads what the last one left,
    // which is the behaviour being tested. In parallel they would race.
    for (let i = 0; i < REMEMBERED_PAGES + 5; i += 1) {
      // Ascending timestamps: page 0 is the oldest.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await writeThread(`https://example.com/${i}`, said(`page ${i}`), `2026-08-10T00:${String(i).padStart(2, "0")}:00Z`);
    }
    expect(await readThread("https://example.com/0")).toEqual([]);
    expect((await readThread(`https://example.com/${REMEMBERED_PAGES + 4}`))[0]?.text).toBe(
      `page ${REMEMBERED_PAGES + 4}`,
    );
    expect(Object.keys(store.bag()["logue:threads"] ?? {})).toHaveLength(REMEMBERED_PAGES);
  });

  it("clears one page without touching another", async () => {
    await writeThread("https://a.example/", said("first"), "2026-08-10T01:00:00Z");
    await writeThread("https://b.example/", said("second"), "2026-08-10T02:00:00Z");
    await clearThread("https://a.example/");
    expect(await readThread("https://a.example/")).toEqual([]);
    expect((await readThread("https://b.example/"))[0]?.text).toBe("second");
  });

  /**
   * The single global conversation this replaced cannot be attributed to any
   * page, and keeping it would put the same messages on every page — which is
   * the bug, not the fix.
   */
  it("drops the one global conversation it replaced", async () => {
    store.reset({ "logue:thread": said("asked somewhere, shown everywhere") });
    expect(await readThread("https://example.com/anything")).toEqual([]);
    expect(store.bag()["logue:thread"]).toBeUndefined();
  });
});
