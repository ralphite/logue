import { describe, expect, it } from "vitest";
import {
  shouldInterruptPanelCapture,
  shouldPreservePanelCapturePresentation,
} from "../sidePanelRecordingState";

describe("side panel recording state", () => {
  const pageCapture = { tabId: 18, intent: "page" as const };

  it("keeps an active recording through a same-tab URL/context refresh", () => {
    // `tab.url` and the page's `location.href` can briefly differ while the
    // content script reports its first context. That is not a page change.
    expect(shouldInterruptPanelCapture(pageCapture, { tabId: 18, intent: "page" })).toBe(false);
    expect(shouldPreservePanelCapturePresentation("starting", pageCapture, { tabId: 18, intent: "page" })).toBe(true);
    expect(shouldPreservePanelCapturePresentation("recording", pageCapture, { tabId: 18, intent: "page" })).toBe(true);
    expect(shouldPreservePanelCapturePresentation("processing", pageCapture, { tabId: 18, intent: "page" })).toBe(true);
  });

  it("still stops a capture when the user leaves its tab or flow", () => {
    expect(shouldInterruptPanelCapture(pageCapture, { tabId: 19, intent: "page" })).toBe(true);
    expect(shouldInterruptPanelCapture(pageCapture, { tabId: 18, intent: "generate" })).toBe(true);
    expect(shouldPreservePanelCapturePresentation("error", pageCapture, { tabId: 18, intent: "page" })).toBe(false);
  });
});
