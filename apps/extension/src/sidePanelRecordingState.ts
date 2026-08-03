import type { CaptureIntent } from "./capturePrimitives";
import type { CapturePhase } from "./sidePanelPresentation";

/**
 * The side panel receives harmless context refreshes while the content script
 * settles after opening. A recording belongs to the tab and capture intent,
 * not to an exact URL string: Chrome/content-script URL normalization can
 * legitimately differ during that refresh. The lifecycle port remains the
 * authority for a real document unload.
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
  return Boolean(capture && (capture.tabId !== next.tabId || capture.intent !== next.intent));
}

export function shouldPreservePanelCapturePresentation(
  phase: CapturePhase,
  capture: ActivePanelCaptureScope | undefined,
  next: { tabId: number; intent: CaptureIntent },
) {
  return isPanelCaptureActive(phase) && !shouldInterruptPanelCapture(capture, next);
}
