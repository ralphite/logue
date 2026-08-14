import { describe, expect, it } from "vitest";
import { actOf, entriesOf, merge } from "./entries";
import type { Material } from "./api";

const material = (over: Partial<Material>): Material => ({
  id: "m1",
  kind: "text",
  content: "words",
  projects: [],
  created_at: "2026-08-13T21:00:00Z",
  ...over,
});

describe("what a Source was, as an act", () => {
  it("reads a voice Source about a passage as a comment on it", () => {
    const passage = material({ id: "quote", kind: "selection" });
    const said = material({ id: "said", kind: "voice", parent_ids: ["quote"] });
    expect(actOf(said, new Map([["quote", passage]]))).toBe("comment");
  });

  it("reads a voice Source about nothing as dictation", () => {
    expect(actOf(material({ kind: "voice" }), new Map())).toBe("voiced");
  });

  it("keeps pages, passages and notes apart", () => {
    expect(actOf(material({ kind: "page" }), new Map())).toBe("saved");
    expect(actOf(material({ kind: "selection" }), new Map())).toBe("kept");
    expect(actOf(material({ kind: "text" }), new Map())).toBe("typed");
  });
});

describe("the one list", () => {
  it("hangs what a Skill made under the thing it was made from", () => {
    const entries = entriesOf([
      material({ id: "note", content: "the note" }),
      material({ id: "answer", kind: "derived", content: "the answer", parent_ids: ["note"] }),
    ]);
    // One entry, not two: the answer is what happened to the note, not a
    // second thing that happened.
    expect(entries).toHaveLength(1);
    expect(entries[0]?.take?.made.map((one) => one.text)).toEqual(["the answer"]);
  });

  it("shows a comment as its own entry, with the passage it is about", () => {
    const entries = entriesOf([
      material({ id: "quote", kind: "selection", content: "the passage" }),
      material({ id: "note", content: "what I think", parent_ids: ["quote"] }),
    ]);
    expect(entries).toHaveLength(2);
    expect(entries.find((one) => one.id === "note")?.quote).toBe("the passage");
  });

  it("puts the newest first", () => {
    const entries = entriesOf([
      material({ id: "old", created_at: "2026-08-13T20:00:00Z" }),
      material({ id: "new", created_at: "2026-08-13T22:00:00Z" }),
    ]);
    expect(entries.map((one) => one.id)).toEqual(["new", "old"]);
  });
});

describe("this session in front of the Host's record", () => {
  const theirs = entriesOf([material({ id: "m1", content: "kept a while ago" })]);

  it("does not show the same Source twice", () => {
    const mine = [
      { id: "e1", at: "2026-08-13T21:30:00Z", kind: "typed" as const, state: "ready" as const, material: material({ id: "m1" }) },
    ];
    expect(merge(mine, theirs)).toHaveLength(1);
  });

  it("keeps the local one, which is the one holding the spinner", () => {
    const mine = [
      {
        id: "e1",
        at: "2026-08-13T21:30:00Z",
        kind: "voiced" as const,
        state: "failed" as const,
        message: "The model is busy.",
        material: material({ id: "m1" }),
      },
    ];
    expect(merge(mine, theirs)[0]?.message).toBe("The model is busy.");
  });

  it("does not show a recording twice while it is still becoming words", () => {
    const mine = [
      { id: "e1", at: "2026-08-13T21:30:00Z", kind: "voiced" as const, state: "working" as const, captureId: "cap_1" },
    ];
    const hosts = entriesOf([material({ id: "m9", kind: "voice", capture_id: "cap_1" })]);
    expect(merge(mine, hosts)).toHaveLength(1);
  });
});
