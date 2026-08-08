import { describe, expect, it } from "vitest";
import { assetDirectory, siblingOf } from "./paths";

describe("resolving the extension's own files", () => {
  it("finds a sibling inside a versioned release directory", () => {
    expect(siblingOf("releases/v1.0.0-abc/background.js", "offscreen.html")).toBe(
      "releases/v1.0.0-abc/offscreen.html",
    );
  });

  it("works for a flat unpacked build", () => {
    expect(siblingOf("background.js", "offscreen.html")).toBe("offscreen.html");
    expect(assetDirectory("background.js")).toBe("");
  });

  /** The failure this exists to prevent: a bare name pointing at the root. */
  it("never returns a bare filename when the worker is nested", () => {
    expect(siblingOf("releases/x/background.js", "offscreen.html")).not.toBe("offscreen.html");
  });
});
