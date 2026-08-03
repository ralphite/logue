import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("side panel initial focus", () => {
  it("hands keyboard control to the quiet panel surface without focusing an editor", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
    const view = readFileSync(resolve(process.cwd(), "src/sidePanelView.tsx"), "utf8");

    expect(panel).toContain("const panelMainRef = useRef<HTMLElement>(null)");
    expect(panel).toContain("if (!previous) focusPanelOnHydrationRef.current = true");
    expect(panel).toContain("panelMainRef.current?.focus({ preventScroll: true })");
    expect(view).toContain('<main ref={panelRef} className="panel" tabIndex={-1}>');
  });

  it("does not let a panel shortcut or a copied result replay a completed insert", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
    const shortcuts = readFileSync(resolve(process.cwd(), "src/sidePanelShortcuts.ts"), "utf8");

    expect(panel).toContain("handleSidePanelShortcut(event, phase");
    expect(shortcuts).toContain('if (action === "record" && !handlers.pendingInsert) handlers.onRecord()');
    expect(panel).toContain('persistDraft({ draft: "", transcript: "", pendingInsert: null })');
  });
});
