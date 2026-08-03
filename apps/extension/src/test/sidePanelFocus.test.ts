import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSidePanelFocusController } from "../sidePanelFocus";

function focusHarness(initialVisibility: DocumentVisibilityState = "visible") {
  let visibility = initialVisibility;
  const focusWindow = vi.fn();
  const panel = document.createElement("main");
  panel.tabIndex = -1;
  const serverInput = document.createElement("input");
  serverInput.id = "logue-server-url";
  const controller = createSidePanelFocusController({
    visibility: () => visibility,
    requestFrame: (callback) => callback(),
    focusWindow,
    activeElement: () => document.activeElement,
    serverInput: () => document.getElementById("logue-server-url"),
    panel: () => panel,
  });
  document.body.append(panel);
  return { controller, focusWindow, panel, serverInput, setVisibility: (next: DocumentVisibilityState) => { visibility = next; } };
}

describe("side panel initial focus", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("hands keyboard control to the quiet panel surface without focusing an editor", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
    const view = readFileSync(resolve(process.cwd(), "src/sidePanelView.tsx"), "utf8");

    expect(panel).toContain("const panelMainRef = useRef<HTMLElement>(null)");
    expect(panel).toContain("if (!previous) focusPanelOnHydrationRef.current = true");
    expect(panel).toContain('message.type === "logue:side-panel-opened"');
    expect(panel).toContain('document.addEventListener("visibilitychange", focusWhenShown)');
    expect(panel).toContain("panelFocusControllerRef.current?.request()");
    expect(panel).toContain("panelFocusControllerRef.current?.visibilityChanged()");
    expect(view).toContain(
      '<main ref={panelRef} className="panel" tabIndex={-1} data-logue-extension="off">',
    );
  });

  it("does not steal focus on an unrelated visibility change", () => {
    const { controller, focusWindow } = focusHarness();
    const note = document.createElement("textarea");
    document.body.append(note);
    note.focus();

    expect(controller.visibilityChanged()).toBe(false);
    expect(document.activeElement).toBe(note);
    expect(focusWindow).not.toHaveBeenCalled();
  });

  it("fulfills a hidden explicit open exactly once when the panel becomes visible", () => {
    const { controller, focusWindow, panel, setVisibility } = focusHarness("hidden");

    expect(controller.request()).toBe(false);
    expect(controller.isPending()).toBe(true);
    setVisibility("visible");
    expect(controller.visibilityChanged()).toBe(true);
    expect(controller.isPending()).toBe(false);
    expect(document.activeElement).toBe(panel);
    expect(focusWindow).toHaveBeenCalledTimes(1);
    expect(controller.visibilityChanged()).toBe(false);
    expect(focusWindow).toHaveBeenCalledTimes(1);
  });

  it("preserves an active editor and targets server settings when no editor is active", () => {
    const editorHarness = focusHarness();
    const note = document.createElement("textarea");
    document.body.append(note);
    note.focus();
    editorHarness.controller.request();
    expect(document.activeElement).toBe(note);

    document.body.innerHTML = "";
    const settingsHarness = focusHarness();
    document.body.append(settingsHarness.serverInput);
    settingsHarness.panel.focus();
    settingsHarness.controller.request();
    expect(document.activeElement).toBe(settingsHarness.serverInput);
  });

  it("does not let a panel shortcut or a copied result replay a completed insert", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
    const shortcuts = readFileSync(resolve(process.cwd(), "src/sidePanelShortcuts.ts"), "utf8");

    expect(panel).toContain("handleSidePanelShortcut(event, phase");
    expect(shortcuts).toContain('if (action === "record" && !handlers.pendingInsert) handlers.onRecord()');
    expect(panel).toContain('persistDraft({ draft: "", transcript: "", pendingInsert: null })');
  });
});
