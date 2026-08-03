import { describe, expect, it } from "vitest";
import { isInlineVoiceShortcutTarget, recordingShortcutAction } from "../recordingShortcuts";

const recording = { open: true, mode: "input", phase: "recording" };

describe("recording shortcuts", () => {
  it("maps Enter to one-step stop and insert and Escape to cancel", () => {
    expect(recordingShortcutAction({ ...recording, key: "Enter" })).toBe("stop-and-insert");
    expect(recordingShortcutAction({ ...recording, key: "Escape" })).toBe("cancel");
  });

  it("keeps Escape available while microphone startup or transcription is pending", () => {
    expect(recordingShortcutAction({ ...recording, phase: "starting", key: "Escape" })).toBe("cancel");
    expect(recordingShortcutAction({ ...recording, phase: "processing", key: "Escape" })).toBe("cancel");
    expect(recordingShortcutAction({ ...recording, phase: "starting", key: "Enter" })).toBeUndefined();
  });

  it("does not steal normal typing outside the active recording state", () => {
    expect(recordingShortcutAction({ ...recording, phase: "idle", key: "Enter" })).toBeUndefined();
    expect(recordingShortcutAction({ ...recording, mode: "selection", key: "Enter" })).toBeUndefined();
    expect(recordingShortcutAction({ ...recording, key: "Enter", shiftKey: true })).toBeUndefined();
    expect(recordingShortcutAction({ ...recording, key: "Enter", isComposing: true })).toBeUndefined();
  });

  it("only captures inline voice shortcuts from its original input or launcher", () => {
    const originalInput = new EventTarget();
    const otherInput = new EventTarget();
    const launcherHost = new EventTarget();

    expect(isInlineVoiceShortcutTarget({
      target: originalInput,
      sessionTarget: originalInput,
      composedPath: [originalInput],
      launcherHost,
    })).toBe(true);
    expect(isInlineVoiceShortcutTarget({
      target: launcherHost,
      sessionTarget: originalInput,
      composedPath: [launcherHost],
      launcherHost,
    })).toBe(true);
    expect(isInlineVoiceShortcutTarget({
      target: otherInput,
      sessionTarget: originalInput,
      composedPath: [otherInput],
      launcherHost,
    })).toBe(false);
  });
});
