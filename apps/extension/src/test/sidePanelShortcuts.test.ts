import { beforeEach, describe, expect, it } from "vitest";
import { sidePanelShortcutAction } from "../sidePanelShortcuts";

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
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.append(textarea, editable);

    expect(sidePanelShortcutAction({ phase: "recording", key: "Enter", target: textarea })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "idle", key: "r", target: editable })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "recording", key: "Enter", target: document.body, isComposing: true })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "recording", key: "Enter", target: document.body, ctrlKey: true })).toBeUndefined();
    expect(sidePanelShortcutAction({ phase: "idle", key: "r", target: document.body, repeat: true })).toBeUndefined();
  });
});
