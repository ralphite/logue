import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("side panel initial focus", () => {
  it("hands keyboard control to the quiet panel surface without focusing an editor", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");

    expect(panel).toContain("const panelMainRef = useRef<HTMLElement>(null)");
    expect(panel).toContain("if (!previous) focusPanelOnHydrationRef.current = true");
    expect(panel).toContain("panelMainRef.current?.focus({ preventScroll: true })");
    expect(panel).toContain('<main ref={panelMainRef} className="panel" tabIndex={-1}>');
  });
});
