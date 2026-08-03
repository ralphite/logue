import { beforeEach, describe, expect, it } from "vitest";
import { handleSidePanelShortcut, sidePanelShortcutAction } from "../sidePanelShortcuts";

describe("side panel recording shortcuts", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("maps R, Enter, and Escape only in their relevant capture states", () => {
    expect(sidePanelShortcutAction({ phase: "idle", key: "r", target: document.body })).toBe("record");
    expect(sidePanelShortcutAction({ phase: "recording", key: "Enter", target: document.body })).toBe("stop");
    expect(sidePanelShortcutAction({ phase: "recording", key: "Escape", target: document.body })).toBe("cancel");
    expect(sidePanelShortcutAction({ phase: "starting", key: "Escape", target: document.body })).toBe("cancel");
    expect(sidePanelShortcutAction({ phase: "idle", key: "Escape", target: document.body })).toBe("close");
  });

  it("never steals input, composition, modified, or repeated keystrokes", () => {
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.append(textarea, select, editable);

    expect(sidePanelShortcutAction({ phase: "recording", key: "Enter", target: textarea })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "idle", key: "r", target: select })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "idle", key: "r", target: editable })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "recording", key: "Enter", target: document.body, isComposing: true })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "recording", key: "Enter", target: document.body, ctrlKey: true })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "idle", key: "r", target: document.body, repeat: true })).toBeUndefined();
  });

  it("handles real panel key events while leaving editable DOM targets untouched", () => {
    const panel = document.createElement("main");
    panel.tabIndex = -1;
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    panel.append(textarea, editable);
    document.body.append(panel);

    const calls = { record: 0, stop: 0, cancel: 0, close: 0 };
    const handlers = {
      pendingInsert: false,
      onRecord: () => { calls.record += 1; },
      onStop: () => { calls.stop += 1; },
      onCancel: () => { calls.cancel += 1; },
      onClose: () => { calls.close += 1; },
    };
    let phase: "idle" | "starting" | "recording" | "processing" | "error" = "idle";
    const listener = (event: KeyboardEvent) => handleSidePanelShortcut(event, phase, handlers);
    window.addEventListener("keydown", listener);

    panel.focus();
    const record = new KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true });
    panel.dispatchEvent(record);
    expect(calls.record).toBe(1);
    expect(record.defaultPrevented).toBe(true);

    phase = "recording";
    const stop = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    panel.dispatchEvent(stop);
    expect(calls.stop).toBe(1);
    expect(stop.defaultPrevented).toBe(true);

    const cancel = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    panel.dispatchEvent(cancel);
    expect(calls.cancel).toBe(1);
    expect(cancel.defaultPrevented).toBe(true);

    const textEnter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(textEnter);
    const editableEscape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    editable.dispatchEvent(editableEscape);
    expect(calls.stop).toBe(1);
    expect(calls.cancel).toBe(1);
    expect(textEnter.defaultPrevented).toBe(false);
    expect(editableEscape.defaultPrevented).toBe(false);

    window.removeEventListener("keydown", listener);
  });
});
