export type CapturePhase = "idle" | "starting" | "recording" | "processing" | "error";

export interface CapturePhasePresentation {
  captureActive: boolean;
  showSource: boolean;
  showEditor: boolean;
  showSavedMaterials: boolean;
  showErrors: boolean;
  showActions: boolean;
  status?: "Starting microphone…" | "Transcribing…";
}

export function capturePhasePresentation(phase: CapturePhase): CapturePhasePresentation {
  const captureActive = phase === "starting" || phase === "recording" || phase === "processing";
  return {
    captureActive,
    showSource: true,
    showEditor: !captureActive,
    showSavedMaterials: !captureActive,
    showErrors: !captureActive,
    showActions: phase !== "processing",
    status: phase === "starting" ? "Starting microphone…" : phase === "processing" ? "Transcribing…" : undefined,
  };
}
