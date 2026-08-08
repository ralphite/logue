import { describe, expect, it } from "vitest";
import type { Material } from "@logue/ui";
import { groupIdenticalMaterials } from "../lib/materialGroups";

function material(id: string, kind: Material["kind"], content: string, project?: string): Material {
  return {
    id,
    kind,
    status: project ? "organized" : "unfiled",
    content,
    projects: project ? [project] : [],
    tags: [],
    createdAt: `2026-08-02T10:0${id.length}:00Z`,
  };
}

describe("groupIdenticalMaterials", () => {
  it("groups only exact trimmed text with the same content type", () => {
    const groups = groupIdenticalMaterials([
      material("a", "voice", "same", "Logue"),
      material("b", "voice", " same ", "Browser Extension"),
      material("c", "text", "same"),
      material("d", "voice", "Same"),
    ]);

    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([["a", "b"], ["c"], ["d"]]);
    expect(groups[0].projects).toEqual(["Logue", "Browser Extension"]);
  });

  it("keeps every underlying record available for expansion and editing", () => {
    const source = [material("first", "voice", "duplicate"), material("second", "voice", "duplicate")];
    const [group] = groupIdenticalMaterials(source);
    expect(group.representative.id).toBe("first");
    expect(group.items).toEqual(source);
  });
});
