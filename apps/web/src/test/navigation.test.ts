import { describe, expect, it } from "vitest";
import { navigationURL, parseNavigation } from "../navigation";

describe("browser navigation", () => {
  it("restores every product section and its selected object", () => {
    expect(parseNavigation("?view=stream&material=material-1")).toEqual({ section: "stream", materialId: "material-1" });
    expect(parseNavigation("?view=projects&project=Skill%20Harness")).toEqual({ section: "projects", projectName: "Skill Harness" });
    expect(parseNavigation("?view=generate&tab=documents&doc=document-1&project=Logue")).toEqual({ section: "generate", generationMode: "documents", documentId: "document-1", projectName: "Logue" });
    expect(parseNavigation("?view=settings")).toEqual({ section: "settings" });
  });

  it("defaults an empty URL to the generate workspace", () => {
    expect(parseNavigation("")).toEqual({ section: "generate", generationMode: "new", documentId: undefined, projectName: undefined });
  });

  it("writes a canonical link while preserving unrelated query params and hashes", () => {
    expect(navigationURL(
      { pathname: "/", search: "?debug=1&view=stream&material=old", hash: "#source" },
      { section: "generate", documentId: "doc / 1" },
    )).toBe("/?debug=1&view=generate&tab=documents&doc=doc+%2F+1#source");
  });

  it("drops object identifiers that do not belong to the destination", () => {
    expect(navigationURL(
      { pathname: "/", search: "?view=generate&tab=documents&doc=d1&project=p1&material=m1", hash: "" },
      { section: "settings" },
    )).toBe("/?view=settings");
  });
});
