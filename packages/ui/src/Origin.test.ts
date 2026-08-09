import { describe, expect, it } from "vitest";
import { originOf, readAnswer } from "./Origin";

describe("where a Source came from", () => {
  /** One rule everywhere: the same kind must never read differently per screen. */
  it("maps every kind the Host can store", () => {
    expect(originOf("selection")).toBe("web");
    expect(originOf("page")).toBe("web");
    expect(originOf("voice")).toBe("you");
    expect(originOf("text")).toBe("you");
    expect(originOf("derived")).toBe("ai");
  });

  it("treats an unknown kind as yours rather than as evidence", () => {
    expect(originOf("something-new")).toBe("you");
  });
});

const cites = (text: string) => readAnswer(text).flatMap((token) => (token.cites ?? []).map((c) => c.n));

describe("reading citations out of generated text", () => {
  it("reads the compact form", () => {
    expect(cites("Async wins [Source 3, 7].")).toEqual([3, 7]);
  });

  /** The form a real model produced, which the first parser silently dropped. */
  it("reads the repeated-label form", () => {
    expect(cites("链路 [Source 11, Source 16, Source 23]。")).toEqual([11, 16, 23]);
  });

  it("keeps the prose intact around a citation", () => {
    const tokens = readAnswer("Before [Source 1] after.");
    expect(tokens.map((t) => t.text ?? `[${t.cites?.map((c) => c.n).join(",")}]`)).toEqual([
      "Before ",
      "[1]",
      " after.",
    ]);
  });

  it("leaves text with no citations alone", () => {
    expect(cites("No citation here.")).toEqual([]);
    expect(readAnswer("No citation here.")).toHaveLength(1);
  });

  it("gives every token a distinct key", () => {
    const tokens = readAnswer("A [Source 1] B [Source 2] C");
    expect(new Set(tokens.map((t) => t.at)).size).toBe(tokens.length);
  });
});
