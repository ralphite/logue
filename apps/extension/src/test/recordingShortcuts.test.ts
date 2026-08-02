import { describe, expect, it } from "vitest";
import { recordingShortcutAction } from "../recordingShortcuts";

const recording = { open: true, mode: "input", phase: "recording" };

describe("recording shortcuts", () => {
  it("maps Enter to one-step stop and insert and Escape to cancel", () => {
    expect(recordingShortcutAction({ ...recording, key: "Enter" })).toBe("stop-and-insert");
    expect(recordingShortcutAction({ ...recording, key: "Escape" })).toBe("cancel");
  });

  it("does not steal normal typing outside the active recording state", () => {
    expect(recordingShortcutAction({ ...recording, phase: "idle", key: "Enter" })).toBeUndefined();
    expect(recordingShortcutAction({ ...recording, mode: "selection", key: "Enter" })).toBeUndefined();
    expect(recordingShortcutAction({ ...recording, key: "Enter", shiftKey: true })).toBeUndefined();
    expect(recordingShortcutAction({ ...recording, key: "Enter", isComposing: true })).toBeUndefined();
  });
});
