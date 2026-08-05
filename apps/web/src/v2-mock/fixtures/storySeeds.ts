import { createCanonicalScenario } from "./canonicalScenario";
import type { MockSessionState } from "../model/types";

export type StorySeedName = "canonical" | "journey-start" | "unlinked-voice-comment" | "target-lost" | "provider-needs-attention";

/** Each call starts from a private deep copy, including all normalized records. */
export function createStorySeed(name: StorySeedName = "canonical"): MockSessionState {
  const state = createCanonicalScenario();
  switch (name) {
    case "journey-start":
      state.domain.tabs["research-tab"].pageId = "article-a";
      delete state.domain.sources["you-a"];
      delete state.domain.sources["you-b"];
      delete state.domain.sources["activity-existing"];
      delete state.domain.sources["ai-adopted"];
      state.domain.memberships = {};
      state.domain.activities = {};
      state.domain.runs = {};
      state.domain.candidates = {};
      state.domain.documents = {};
      state.domain.documentRevisions = {};
      state.surface.selectedSourceId = null;
      state.surface.activeCandidateId = null;
      state.surface.commandActivityId = null;
      state.surface.openCitationSourceId = null;
      return state;
    case "unlinked-voice-comment":
      state.domain.tabs["research-tab"].pageId = "article-a";
      state.surface.selectedSourceId = null;
      state.surface.recording = { kind: "voice-comment", tabId: "research-tab", pageId: "article-a" };
      return state;
    case "target-lost":
      state.domain.targetSessions["email-target"].isValid = false;
      return state;
    case "provider-needs-attention":
      state.domain.host.providers.ai.status = "needs-attention";
      return state;
    case "canonical":
      return state;
  }
}
