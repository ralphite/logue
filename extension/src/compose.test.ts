import { describe, expect, it } from "vitest";
import { joinAtCaret } from "./compose";

describe("speaking into a box that already has words in it", () => {
  it("adds to the end, which is where the caret usually is", () => {
    expect(joinAtCaret("Chorus", 6, "how does it handle retries")).toBe("Chorus how does it handle retries");
  });

  it("lands where the caret is, not where it is easiest", () => {
    expect(joinAtCaret("Chorus and Logue", 6, "and Phoenix")).toBe("Chorus and Phoenix and Logue");
  });

  it("keeps every character that was already there", () => {
    const typed = "Ask about §3 — the part on 中文 pages";
    for (let caret = 0; caret <= typed.length; caret += 1) {
      const joined = joinAtCaret(typed, caret, "SAID");
      const back = joined.replace("SAID", "");
      // Only whitespace may differ: the join tidies the seam, nothing else.
      expect(back.replace(/\s+/g, "")).toBe(typed.replace(/\s+/g, ""));
    }
  });

  it("does not open with a space when the box was empty", () => {
    expect(joinAtCaret("", 0, "just this")).toBe("just this");
  });

  it("survives a caret that is not where the text is", () => {
    expect(joinAtCaret("short", 999, "more")).toBe("short more");
    expect(joinAtCaret("short", -4, "more")).toBe("moreshort");
  });
});
