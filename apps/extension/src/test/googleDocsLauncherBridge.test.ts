import { describe, expect, it } from "vitest";
import {
  googleDocsLauncherActionMessage,
  googleDocsLauncherStateMessage,
  readGoogleDocsLauncherAction,
  readGoogleDocsLauncherEditorFrameId,
  readGoogleDocsLauncherState,
} from "../googleDocsLauncherBridge";

describe("Google Docs launcher bridge", () => {
  it("accepts only complete editor-frame state", () => {
    const state = { visible: true, phase: "recording" as const, error: "", pendingCopyText: "" };
    expect(readGoogleDocsLauncherState(googleDocsLauncherStateMessage(state))).toEqual(state);
    expect(readGoogleDocsLauncherState({ type: "logue:google-docs-launcher", kind: "state", state: { visible: true } })).toBeUndefined();
  });

  it("accepts only explicit launcher actions", () => {
    const action = googleDocsLauncherActionMessage("start", 24);
    expect(readGoogleDocsLauncherAction(action)).toBe("start");
    expect(readGoogleDocsLauncherEditorFrameId(action)).toBe(24);
    expect(readGoogleDocsLauncherEditorFrameId({ editorFrameId: 0 })).toBeUndefined();
    expect(readGoogleDocsLauncherAction({ type: "logue:google-docs-launcher", kind: "action", action: "delete" })).toBeUndefined();
  });
});
