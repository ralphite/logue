import type { Material } from "@logue/ui";
import { describe, expect, it } from "vitest";
import { buildCommentBundles, groupLibraryMaterials } from "../commentBundles";

function material(input: Partial<Material> & Pick<Material, "id" | "kind" | "content">): Material {
  return {
    status: input.projects?.length ? "organized" : "unfiled",
    projects: [],
    tags: [],
    createdAt: "2026-08-05T10:00:00Z",
    actor: "user",
    ...input,
  };
}

describe("comment bundles", () => {
  const source = material({ id: "source", kind: "selection", content: "Selected evidence", projects: ["Logue"] });
  const comment = material({
    id: "comment",
    kind: "derived",
    content: "This changes the onboarding decision.",
    parentIds: [source.id],
    projects: ["Logue"],
    captureId: "capture-1",
    transcript: "raw transcript",
    createdAt: "2026-08-05T10:01:00Z",
  });

  it("keeps the persisted source and comment as one user-facing bundle", () => {
    const bundles = buildCommentBundles([comment, source]);
    expect(bundles.get(source.id)).toMatchObject({
      source: { id: "source" },
      primaryComment: { id: "comment" },
      projects: ["Logue"],
    });
  });

  it("returns one bundle whether search matched the source, comment, or both", () => {
    const all = [comment, source];
    for (const candidates of [[comment], [source], all]) {
      const groups = groupLibraryMaterials(candidates, all);
      expect(groups).toHaveLength(1);
      expect(groups[0].bundle?.members.map((item) => item.id)).toEqual(["source", "comment"]);
    }
  });

  it("does not absorb AI output into a user comment bundle", () => {
    const generated = material({ id: "generated", kind: "derived", content: "AI summary", parentIds: [source.id], actor: "Summarize" });
    const groups = groupLibraryMaterials([generated, source], [generated, source]);
    expect(groups.map((group) => group.representative.id)).toEqual(["generated", "source"]);
    expect(groups.every((group) => !group.bundle)).toBe(true);
  });

  it("keeps comment bundles separate even when their selected text is identical", () => {
    const secondSource = material({ id: "source-2", kind: "selection", content: source.content });
    const secondComment = material({ id: "comment-2", kind: "derived", content: "A different judgment", parentIds: [secondSource.id] });
    const groups = groupLibraryMaterials([comment, source, secondComment, secondSource], [comment, source, secondComment, secondSource]);
    expect(groups.map((group) => group.key)).toEqual(["comment-bundle:source", "comment-bundle:source-2"]);
  });
});
