import { describe, expect, it } from "vitest";
import { installedExtensionAssetPath } from "../extensionAssets";

describe("installedExtensionAssetPath", () => {
  it("uses the root asset beside a root service worker", () => {
    expect(installedExtensionAssetPath("background.js", "content.js")).toBe("content.js");
  });

  it("uses the active versioned release beside its service worker", () => {
    expect(installedExtensionAssetPath("releases/v0.2.13-current/background.js", "content.js"))
      .toBe("releases/v0.2.13-current/content.js");
  });

  it("rejects paths that escape the extension", () => {
    expect(() => installedExtensionAssetPath("../background.js", "content.js")).toThrow();
    expect(() => installedExtensionAssetPath("background.js", "../content.js")).toThrow();
  });
});
