import type { PanelCaptureState } from "./capturePrimitives";

type GenerationTarget = Pick<PanelCaptureState, "tabId" | "source" | "targetText" | "targetSessionId" | "targetAvailable" | "selectionText">;

export function generationTargetKey(state: GenerationTarget) {
  return JSON.stringify({
    tabId: state.tabId,
    pageUrl: state.source.url,
    targetText: state.targetAvailable ? state.targetText ?? "" : undefined,
    targetSessionId: state.targetAvailable ? state.targetSessionId : undefined,
    selectionText: state.selectionText ?? undefined,
  });
}

export function canInsertGeneratedText(state: GenerationTarget, resultTargetKey?: string) {
  return Boolean(resultTargetKey) && resultTargetKey === generationTargetKey(state);
}
