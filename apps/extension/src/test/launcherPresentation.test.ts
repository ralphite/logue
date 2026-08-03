import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("page launcher presentation", () => {
  it("keeps generation progressively disclosed while preserving keyboard focus discovery", () => {
    const content = readFileSync(resolve(process.cwd(), "src/content.tsx"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "src/extension.css"), "utf8");

    expect(content).toContain('className="logue-launcher logue-launcher-generation"');
    expect(content).not.toMatch(/logue-launcher-generation[^>]+tabIndex=\{-1\}/);
    expect(styles).toMatch(/\.logue-launcher-generation\s*\{[^}]*width:\s*0;[^}]*opacity:\s*0;/s);
    expect(styles).toMatch(/\.logue-launcher-group:focus-within \.logue-launcher-generation\s*\{[^}]*width:\s*38px;[^}]*opacity:\s*1;/s);
  });
});
