import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSidePanelFocusController } from "../sidePanelFocus";

function focusHarness(initialVisibility: DocumentVisibilityState = "visible") {
  let visibility = initialVisibility;
  let focused = true;
  const focusWindow = vi.fn();
  const panel = document.createElement("main");
  panel.tabIndex = -1;
  const serverInput = document.createElement("input");
  serverInput.id = "logue-server-url";
  const controller = createSidePanelFocusController({
    visibility: () => visibility,
    requestFrame: (callback) => callback(),
    hasFocus: () => focused,
    focusWindow,
    activeElement: () => document.activeElement,
    serverInput: () => document.getElementById("logue-server-url"),
    panel: () => panel,
  });
  document.body.append(panel);
  return {
    controller,
    focusWindow,
    panel,
    serverInput,
    setFocused: (next: boolean) => { focused = next; },
    setVisibility: (next: DocumentVisibilityState) => { visibility = next; },
  };
}

describe("side panel initial focus", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("hands keyboard control to the quiet panel surface without focusing an editor", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
    const surface = readFileSync(resolve(process.cwd(), "src/surfaces/SidePanelSurface.tsx"), "utf8");

    expect(panel).toContain("const panelMainRef = useRef<HTMLElement>(null)");
    expect(panel).toContain("if (!previous) focusPanelOnHydrationRef.current = true");
    expect(panel).toContain('panelMessage.type === "logue:side-panel-opened"');
    expect(panel).toContain('document.addEventListener("visibilitychange", focusWhenShown)');
    expect(panel).toContain("panelFocusControllerRef.current?.request()");
    expect(panel).toContain("panelFocusControllerRef.current?.visibilityChanged()");
    // The panel surface must stay focusable and opt out of the page Extension.
    expect(surface).toContain("ref={panelRef}");
    expect(surface).toContain("tabIndex={-1}");
    expect(surface).toContain('data-logue-extension="off"');
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

  it("retries a reopened native panel until Chrome transfers document focus", () => {
    const frames: Array<() => void> = [];
    const focusWindow = vi.fn();
    const panel = document.createElement("main");
    panel.tabIndex = -1;
    document.body.append(panel);
    let focused = false;
    const controller = createSidePanelFocusController({
      visibility: () => "visible",
      requestFrame: (callback) => frames.push(callback),
      hasFocus: () => focused,
      focusWindow,
      activeElement: () => document.activeElement,
      serverInput: () => null,
      panel: () => panel,
    });

    expect(controller.request()).toBe(true);
    frames.shift()?.();
    expect(controller.isPending()).toBe(true);
    frames.shift()?.();
    focused = true;
    frames.shift()?.();

    expect(controller.isPending()).toBe(false);
    expect(document.activeElement).toBe(panel);
    expect(focusWindow).toHaveBeenCalledTimes(3);
  });

  it("never replaces an active text editor while retrying focus", () => {
    const frames: Array<() => void> = [];
    const panel = document.createElement("main");
    const editor = document.createElement("textarea");
    document.body.append(panel, editor);
    editor.focus();
    let focused = false;
    const controller = createSidePanelFocusController({
      visibility: () => "visible",
      requestFrame: (callback) => frames.push(callback),
      hasFocus: () => focused,
      focusWindow: () => undefined,
      activeElement: () => document.activeElement,
      serverInput: () => null,
      panel: () => panel,
    });

    controller.request();
    frames.shift()?.();
    focused = true;
    frames.shift()?.();

    expect(document.activeElement).toBe(editor);
  });

  it("does not let a panel shortcut or a copied result replay a completed insert", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
    const shortcuts = readFileSync(resolve(process.cwd(), "src/sidePanelShortcuts.ts"), "utf8");

    expect(panel).toContain("handleSidePanelShortcut(event, phase");
    expect(shortcuts).toContain('if (action === "record" && !handlers.pendingInsert) handlers.onRecord()');
    expect(panel).toContain('persistDraft({ draft: "", transcript: "", pendingInsert: null })');
  });

  it("clears a stale local error after an explicit server change without hiding a pending insert", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");

    expect(panel.match(/setError\(\(active\) => pendingInsert \? active : undefined\);/g)).toHaveLength(2);
  });
});
