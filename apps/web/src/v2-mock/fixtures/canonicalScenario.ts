import type { MockSessionState } from "../model/types";

const canonicalScenario: MockSessionState = {
  domain: {
    projects: {
      "project-a": { id: "project-a", name: "Mobile research", goal: "Turn field evidence into a clear product decision." },
      "project-b": { id: "project-b", name: "Q3 pricing decision", goal: "Compare packaging options." },
    },
    pages: {
      "article-a": {
        id: "article-a",
        url: "https://example.com/mobile-research",
        title: "Article A: Mobile research signals",
        selection: "The study found a clear preference for offline capture.",
        snapshot: "The study found a clear preference for offline capture and later review.",
        webSourceId: "web-a",
      },
      "article-b": {
        id: "article-b",
        url: "https://example.com/field-notes",
        title: "Article B: Field note patterns",
        selection: "Participants returned to notes when preparing decisions.",
        snapshot: "Participants returned to notes when preparing decisions, not while browsing.",
        webSourceId: "web-b",
      },
    },
    tabs: { "research-tab": { id: "research-tab", pageId: "article-b", activeProjectId: "project-a" } },
    sources: {
      "web-a": {
        id: "web-a", origin: "web", status: "saved", title: "Article A: Mobile research signals", createdAt: "2026-08-05T09:00:00.000Z", pageId: "article-a", parentSourceIds: [],
        revisions: [{ id: "web-a-raw", kind: "raw", content: "The study found a clear preference for offline capture and later review.", createdAt: "2026-08-05T09:00:00.000Z" }],
      },
      "you-a": {
        id: "you-a", origin: "you", status: "saved", title: "Voice comment", createdAt: "2026-08-05T09:01:00.000Z", pageId: "article-a", commentsOnSourceId: "web-a", parentSourceIds: [], audio: { id: "you-a-audio", durationSeconds: 11 },
        revisions: [
          { id: "you-a-raw", kind: "raw", content: "Offline capture is the differentiator for our field researchers.", createdAt: "2026-08-05T09:01:00.000Z" },
          { id: "you-a-candidate", kind: "candidate", content: "Offline capture is the differentiator for field researchers.", createdAt: "2026-08-05T09:01:10.000Z" },
        ],
      },
      "web-b": {
        id: "web-b", origin: "web", status: "saved", title: "Article B: Field note patterns", createdAt: "2026-08-05T09:05:00.000Z", pageId: "article-b", parentSourceIds: [],
        revisions: [{ id: "web-b-raw", kind: "raw", content: "Participants returned to notes when preparing decisions, not while browsing.", createdAt: "2026-08-05T09:05:00.000Z" }],
      },
      "you-b": {
        id: "you-b", origin: "you", status: "saved", title: "Text comment", createdAt: "2026-08-05T09:06:00.000Z", pageId: "article-b", commentsOnSourceId: "web-b", parentSourceIds: [],
        revisions: [{ id: "you-b-raw", kind: "raw", content: "The reply should make evidence review feel immediate, not archival.", createdAt: "2026-08-05T09:06:00.000Z" }],
      },
      "web-duplicate": {
        id: "web-duplicate", origin: "web", status: "saved", title: "Article A mirror", createdAt: "2026-08-05T09:07:00.000Z", pageId: "article-a", parentSourceIds: ["web-a"],
        revisions: [{ id: "web-duplicate-raw", kind: "raw", content: "The study found a clear preference for offline capture and later review.", createdAt: "2026-08-05T09:07:00.000Z" }],
      },
      "you-suggested": {
        id: "you-suggested", origin: "you", status: "saved", title: "Follow-up note", createdAt: "2026-08-05T09:08:00.000Z", parentSourceIds: [],
        revisions: [{ id: "you-suggested-raw", kind: "raw", content: "Check whether offline capture changes the quality of later synthesis.", createdAt: "2026-08-05T09:08:00.000Z" }],
      },
      "you-auto": {
        id: "you-auto", origin: "you", status: "saved", title: "Auto-added field note", createdAt: "2026-08-05T09:09:00.000Z", parentSourceIds: [],
        revisions: [{ id: "you-auto-raw", kind: "raw", content: "Researchers need evidence at the decision moment, not only at capture time.", createdAt: "2026-08-05T09:09:00.000Z" }],
      },
      "activity-existing": {
        id: "activity-existing", origin: "you", status: "activity", activityKind: "draft", title: "Draft reply", createdAt: "2026-08-05T09:10:00.000Z", parentSourceIds: [],
        revisions: [{ id: "activity-existing-raw", kind: "raw", content: "Using Mobile research, draft a reply", createdAt: "2026-08-05T09:10:00.000Z" }],
      },
      "activity-cancelled-source": {
        id: "activity-cancelled-source", origin: "you", status: "activity", activityKind: "draft", title: "Compare field notes", createdAt: "2026-08-05T09:11:00.000Z", parentSourceIds: [],
        revisions: [{ id: "activity-cancelled-source-raw", kind: "raw", content: "Compare offline capture with evidence review behavior.", createdAt: "2026-08-05T09:11:00.000Z" }],
      },
      "ai-adopted": {
        id: "ai-adopted", origin: "ai", status: "saved", title: "Draft reply", createdAt: "2026-08-05T09:12:00.000Z", parentSourceIds: ["web-a", "you-a", "web-b", "you-b"],
        revisions: [{ id: "ai-adopted-revision", kind: "adopted", content: "We should prioritize offline capture and make the evidence easy to revisit when a decision is due.", createdAt: "2026-08-05T09:12:00.000Z" }],
      },
    },
    memberships: {
      "project-a:web-a": { id: "project-a:web-a", projectId: "project-a", sourceId: "web-a", state: "added", reason: "tab-authorized" },
      "project-a:you-a": { id: "project-a:you-a", projectId: "project-a", sourceId: "you-a", state: "added", reason: "tab-authorized" },
      "project-a:web-b": { id: "project-a:web-b", projectId: "project-a", sourceId: "web-b", state: "added", reason: "tab-authorized" },
      "project-a:you-b": { id: "project-a:you-b", projectId: "project-a", sourceId: "you-b", state: "added", reason: "tab-authorized" },
      "project-a:web-duplicate": { id: "project-a:web-duplicate", projectId: "project-a", sourceId: "web-duplicate", state: "duplicate-linked", reason: "duplicate" },
      "project-a:you-suggested": { id: "project-a:you-suggested", projectId: "project-a", sourceId: "you-suggested", state: "suggested", reason: "suggested" },
      "project-a:you-auto": { id: "project-a:you-auto", projectId: "project-a", sourceId: "you-auto", state: "added", reason: "auto-classified" },
      "project-a:ai-adopted": { id: "project-a:ai-adopted", projectId: "project-a", sourceId: "ai-adopted", state: "added", reason: "user-selected" },
      "project-b:web-b": { id: "project-b:web-b", projectId: "project-b", sourceId: "web-b", state: "suggested", reason: "suggested" },
    },
    targetSessions: {
      "email-target": { id: "email-target", tabId: "research-tab", label: "Reply to Maya", kind: "email", value: "Hi Maya,", isValid: true },
    },
    activities: {
      "activity-record-existing": { id: "activity-record-existing", sourceId: "activity-existing", projectId: "project-a", targetSessionId: "email-target", transcript: "Using Mobile research, draft a reply", parsedIntent: { action: "draft-reply", projectId: "project-a", output: "current-target" } },
      "activity-cancelled": { id: "activity-cancelled", sourceId: "activity-cancelled-source", projectId: "project-a", transcript: "Compare offline capture with evidence review behavior.", parsedIntent: { action: "draft-reply", projectId: "project-a", output: "current-target" } },
    },
    runs: {
      "run-existing": { id: "run-existing", activityId: "activity-record-existing", projectId: "project-a", status: "succeeded", actualContextSourceIds: ["web-a", "you-a", "web-b", "you-b"], candidateId: "candidate-existing" },
      "run-cancelled": { id: "run-cancelled", activityId: "activity-cancelled", projectId: "project-a", status: "cancelled", actualContextSourceIds: ["web-a", "you-a"] },
    },
    candidates: {
      "candidate-existing": {
        id: "candidate-existing", runId: "run-existing", status: "ready", content: "A draft that has not yet been adopted.", contextSourceIds: ["web-a", "you-a", "web-b", "you-b"],
        citations: [
          { sourceId: "web-a", label: "Article A", excerpt: "clear preference for offline capture" },
          { sourceId: "you-b", label: "Your thought", excerpt: "evidence review feel immediate" },
        ],
      },
    },
    documents: { "document-brief": { id: "document-brief", projectId: "project-a", title: "Mobile research reply", revisionIds: ["document-brief-r1"] } },
    documentRevisions: {
      "document-brief-r1": { id: "document-brief-r1", documentId: "document-brief", content: "Evidence-led reply outline.", sourceIds: ["web-a", "you-a"], runId: "run-existing" },
    },
    host: {
      status: "ready",
      providers: { voice: { id: "voice", label: "Local transcription", status: "ready" }, ai: { id: "ai", label: "Connected generation", status: "ready" } },
      pendingCaptures: { "pending-upload": { id: "pending-upload", sourceId: "you-a", state: "uploaded" } },
    },
    nextId: 100,
  },
  surface: { activeTabId: "research-tab", selectedSourceId: "you-b", selectedTargetSessionId: "email-target", activeCandidateId: "candidate-existing", recording: null, commandActivityId: "activity-record-existing", openCitationSourceId: null },
};

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Returns a fresh state so stories never mutate each other's journey. */
export function createCanonicalScenario(): MockSessionState {
  return deepCopy(canonicalScenario);
}

export { canonicalScenario };
