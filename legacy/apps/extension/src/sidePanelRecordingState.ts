import type { CaptureIntent } from "./capturePrimitives";
import type { CapturePhase } from "./sidePanelPresentation";

/**
 * A capture belongs to its tab, never to a transient URL or capture intent.
 * Same-tab context changes must not interrupt normal recording.
 */
export interface ActivePanelCaptureScope {
  tabId: number;
  intent: CaptureIntent;
}

export function isPanelCaptureActive(phase: CapturePhase) {
  return phase === "starting" || phase === "recording" || phase === "processing";
}

export function shouldInterruptPanelCapture(
  capture: ActivePanelCaptureScope | undefined,
  next: { tabId: number; intent: CaptureIntent },
) {
  return Boolean(capture && capture.tabId !== next.tabId);
}

export function shouldPreservePanelCapturePresentation(
  phase: CapturePhase,
  capture: ActivePanelCaptureScope | undefined,
  next: { tabId: number; intent: CaptureIntent },
) {
  return isPanelCaptureActive(phase) && !shouldInterruptPanelCapture(capture, next);
}
