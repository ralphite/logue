import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Logue Web extension integration", () => {
  it("keeps the Logue Web document eligible for voice input", () => {
    const html = readFileSync(resolve(process.cwd(), "../web/index.html"), "utf8");

    expect(html).not.toMatch(/<meta[^>]+name=["']logue-extension["'][^>]+content=["']disabled["']/i);
  });
});
