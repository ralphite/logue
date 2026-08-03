import { describe, expect, it } from "vitest";
import { capturePhasePresentation } from "../sidePanelPresentation";

describe("side panel capture presentation", () => {
  it("keeps idle content available", () => {
    expect(capturePhasePresentation("idle")).toMatchObject({
      captureActive: false,
      showSource: true,
      showEditor: true,
      showOrganization: true,
      showErrors: true,
      showActions: true,
      status: undefined,
    });
  });

  it("reduces starting and recording to their essential controls", () => {
    expect(capturePhasePresentation("starting")).toMatchObject({
      captureActive: true,
      showSource: true,
      showEditor: false,
      showOrganization: false,
      showErrors: false,
      showActions: true,
      status: "Starting microphone…",
    });
    expect(capturePhasePresentation("recording")).toMatchObject({
      captureActive: true,
      showSource: true,
      showEditor: false,
      showOrganization: false,
      showErrors: false,
      showActions: true,
      status: undefined,
    });
  });

  it("shows only transcription progress while processing", () => {
    expect(capturePhasePresentation("processing")).toEqual({
      captureActive: true,
      showSource: true,
      showEditor: false,
      showOrganization: false,
      showErrors: false,
      showActions: false,
      status: "Transcribing…",
    });
  });
});
