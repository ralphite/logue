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

  it("round-trips Selection Action Keep Undo for the Google Docs proxy", () => {
    expect(
      readGoogleDocsLauncherAction(
        googleDocsLauncherActionMessage("command-candidate-keep-undo"),
      ),
    ).toMatchObject({ action: "command-candidate-keep-undo" });
  });

  it("preserves the Document adoption action in Google Docs Candidate state", () => {
    const state = {
      visible: true,
      phase: "idle" as const,
      error: "",
      pendingCopyText: "",
      commandCandidate: {
        skillName: "Summarize",
        text: "Candidate",
        primaryAction: "Copy" as const,
        error: "",
        documentUndoAvailable: true,
        documentUndoAction: "document" as const,
        documentUndoRetryable: true,
      },
    };

    expect(
      readGoogleDocsLauncherState(googleDocsLauncherStateMessage(state))
        ?.commandCandidate?.documentUndoAction,
    ).toBe("document");
    expect(
      readGoogleDocsLauncherState(googleDocsLauncherStateMessage(state))
        ?.commandCandidate?.documentUndoRetryable,
    ).toBe(true);
  });
});
