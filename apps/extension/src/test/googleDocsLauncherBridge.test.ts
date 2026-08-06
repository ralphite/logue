import { describe, expect, it } from "vitest";
import {
  googleDocsLauncherActionMessage,
  googleDocsLauncherStateMessage,
  readGoogleDocsLauncherAction,
  readGoogleDocsLauncherState,
} from "../googleDocsLauncherBridge";

describe("Google Docs launcher bridge", () => {
  it("accepts only complete editor-frame state", () => {
    const state = { visible: true, phase: "recording" as const, error: "", pendingCopyText: "" };
    expect(readGoogleDocsLauncherState(googleDocsLauncherStateMessage(state))).toEqual(state);
    expect(readGoogleDocsLauncherState({ type: "logue:google-docs-launcher", kind: "state", state: { visible: true } })).toBeUndefined();
  });

  it("round-trips only supported actions", () => {
    expect(readGoogleDocsLauncherAction(googleDocsLauncherActionMessage("start"))).toEqual({ action: "start", overrides: undefined, text: undefined, retranscribeInput: undefined });
    expect(readGoogleDocsLauncherAction({ type: "logue:google-docs-launcher", kind: "action", action: "pause" })).toBeUndefined();
  });
});
