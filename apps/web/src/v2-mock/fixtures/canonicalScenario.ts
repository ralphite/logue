import type { MockSessionState } from "../model/types";
import { skillPolicyDefaults } from "../model/skillContract";

const revisionPolicy = (category: keyof typeof skillPolicyDefaults) => {
  const { outputFormat, languageTone, projectContext, resultBehavior } = skillPolicyDefaults[category];
  return { outputFormat, languageTone, projectContext, resultBehavior };
};

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
    selectionTargets: {
      "article-b-selection": {
        id: "article-b-selection",
        pageId: "article-b",
        value: "Participants returned to notes when preparing decisions, not while browsing.",
        revisions: [{ id: "article-b-selection-original", kind: "original", content: "Participants returned to notes when preparing decisions, not while browsing.", createdAt: "2026-08-05T09:05:00.000Z" }],
      },
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
    skills: {
      "skill-clean-transcript": { id: "skill-clean-transcript", name: "Clean up transcription", description: "Remove filler words while preserving meaning.", category: "transcription", trigger: "after-speech", origin: "built-in", allowedInputScopes: ["voice-write", "voice-comment"], revisionIds: ["skill-clean-transcript-r4"], currentRevisionId: "skill-clean-transcript-r4", systemDefault: true, archived: false },
      "skill-clean-voice": { id: "skill-clean-voice", name: "Clear voice note", description: "Turn a rough voice note into concise written text.", category: "transformation", trigger: "after-speech", origin: "built-in", allowedInputScopes: ["voice-write", "voice-comment"], revisionIds: ["skill-clean-voice-r1"], currentRevisionId: "skill-clean-voice-r1", systemDefault: true, archived: false },
      "skill-translate-zh": { id: "skill-translate-zh", name: "Translate to Chinese", description: "Translate clearly without adding information.", category: "page-selection", trigger: "explicit-action", origin: "built-in", allowedInputScopes: ["selection", "editable-selection", "page"], revisionIds: ["skill-translate-zh-r1"], currentRevisionId: "skill-translate-zh-r1", systemDefault: false, archived: false },
      "skill-shorten": { id: "skill-shorten", name: "Shorten", description: "Keep the claim and remove repetition.", category: "page-selection", trigger: "explicit-action", origin: "built-in", allowedInputScopes: ["selection", "editable-selection", "page"], revisionIds: ["skill-shorten-r2"], currentRevisionId: "skill-shorten-r2", systemDefault: false, archived: false },
      "skill-rewrite": { id: "skill-rewrite", name: "Rewrite", description: "Improve clarity without changing the claim.", category: "page-selection", trigger: "explicit-action", origin: "built-in", allowedInputScopes: ["selection", "editable-selection", "page"], revisionIds: ["skill-rewrite-r1"], currentRevisionId: "skill-rewrite-r1", systemDefault: false, archived: false },
      "skill-explain": { id: "skill-explain", name: "Explain", description: "Explain the selected idea in plain language.", category: "page-selection", trigger: "explicit-action", origin: "built-in", allowedInputScopes: ["selection", "editable-selection", "page"], revisionIds: ["skill-explain-r1"], currentRevisionId: "skill-explain-r1", systemDefault: true, archived: false },
      "skill-summarize": { id: "skill-summarize", name: "Summarize", description: "Summarize the page around its main decision signal.", category: "page-selection", trigger: "explicit-action", origin: "built-in", allowedInputScopes: ["selection", "editable-selection", "page"], revisionIds: ["skill-summarize-r3"], currentRevisionId: "skill-summarize-r3", systemDefault: false, archived: false },
      "skill-organize": { id: "skill-organize", name: "Suggest projects", description: "Suggest relevant Projects without moving Sources automatically.", category: "organization", trigger: "background-organization", origin: "built-in", allowedInputScopes: ["project-sources"], revisionIds: ["skill-organize-r1"], currentRevisionId: "skill-organize-r1", systemDefault: true, archived: false },
      "skill-draft-reply": { id: "skill-draft-reply", name: "Draft reply", description: "Draft a concise reply grounded in actual Project Sources.", category: "generation", trigger: "ask-draft", origin: "built-in", allowedInputScopes: ["project-sources"], revisionIds: ["skill-draft-reply-r2"], currentRevisionId: "skill-draft-reply-r2", systemDefault: true, archived: false },
      "skill-decision-signal": { id: "skill-decision-signal", name: "Decision signal", description: "State what evidence should change the current decision.", category: "page-selection", trigger: "explicit-action", origin: "user", allowedInputScopes: ["selection", "editable-selection", "page"], revisionIds: ["skill-decision-signal-r1", "skill-decision-signal-r2"], currentRevisionId: "skill-decision-signal-r2", systemDefault: false, archived: false },
      "skill-field-voice": { id: "skill-field-voice", name: "Field research voice", description: "Preserve research terms and clean speech lightly.", category: "transcription", trigger: "after-speech", origin: "user", allowedInputScopes: ["voice-write", "voice-comment"], revisionIds: ["skill-field-voice-r1"], currentRevisionId: "skill-field-voice-r1", systemDefault: false, archived: false },
    },
    skillRevisions: {
      "skill-clean-transcript-r4": { id: "skill-clean-transcript-r4", skillId: "skill-clean-transcript", version: 4, instruction: "Remove filler words and repair punctuation. Preserve meaning and terminology.", ...revisionPolicy("transcription"), createdAt: "2026-08-01T09:00:00.000Z" },
      "skill-clean-voice-r1": { id: "skill-clean-voice-r1", skillId: "skill-clean-voice", version: 1, instruction: "Turn rough spoken notes into concise written text without changing the claim.", ...revisionPolicy("transformation"), createdAt: "2026-08-01T09:00:00.000Z" },
      "skill-translate-zh-r1": { id: "skill-translate-zh-r1", skillId: "skill-translate-zh", version: 1, instruction: "Translate into natural Simplified Chinese without adding information.", ...revisionPolicy("page-selection"), createdAt: "2026-08-01T09:00:00.000Z" },
      "skill-shorten-r2": { id: "skill-shorten-r2", skillId: "skill-shorten", version: 2, instruction: "Keep the claim and necessary evidence; remove repetition.", ...revisionPolicy("page-selection"), createdAt: "2026-08-02T09:00:00.000Z" },
      "skill-rewrite-r1": { id: "skill-rewrite-r1", skillId: "skill-rewrite", version: 1, instruction: "Improve clarity and rhythm without changing the claim.", ...revisionPolicy("page-selection"), createdAt: "2026-08-01T09:00:00.000Z" },
      "skill-explain-r1": { id: "skill-explain-r1", skillId: "skill-explain", version: 1, instruction: "Explain the idea in plain language and state why it matters.", ...revisionPolicy("page-selection"), createdAt: "2026-08-01T09:00:00.000Z" },
      "skill-summarize-r3": { id: "skill-summarize-r3", skillId: "skill-summarize", version: 3, instruction: "Summarize the page around the main evidence and decision signal.", ...revisionPolicy("page-selection"), createdAt: "2026-08-03T09:00:00.000Z" },
      "skill-organize-r1": { id: "skill-organize-r1", skillId: "skill-organize", version: 1, instruction: "Suggest Projects using confirmed Source content. Never move a Source silently.", ...revisionPolicy("organization"), createdAt: "2026-08-01T09:00:00.000Z" },
      "skill-draft-reply-r2": { id: "skill-draft-reply-r2", skillId: "skill-draft-reply", version: 2, instruction: "Draft a concise reply using only the actual Sources selected for this Run.", ...revisionPolicy("generation"), createdAt: "2026-08-02T09:00:00.000Z" },
      "skill-decision-signal-r1": { id: "skill-decision-signal-r1", skillId: "skill-decision-signal", version: 1, instruction: "Extract the decision implication from this evidence.", ...revisionPolicy("page-selection"), createdAt: "2026-08-03T09:00:00.000Z" },
      "skill-decision-signal-r2": { id: "skill-decision-signal-r2", skillId: "skill-decision-signal", version: 2, instruction: "State the decision signal in one sentence, starting with ‘Decision signal:’.", ...revisionPolicy("page-selection"), createdAt: "2026-08-05T09:00:00.000Z" },
      "skill-field-voice-r1": { id: "skill-field-voice-r1", skillId: "skill-field-voice", version: 1, instruction: "Preserve ‘offline capture’, ‘field researcher’, and ‘Logue’; remove filler words only.", ...revisionPolicy("transcription"), createdAt: "2026-08-05T09:00:00.000Z" },
    },
    skillBindings: {
      "global:transcription": { id: "global:transcription", level: "global", category: "transcription", skillId: "skill-clean-transcript" },
      "global:transformation": { id: "global:transformation", level: "global", category: "transformation", skillId: "skill-clean-voice" },
      "global:page-selection": { id: "global:page-selection", level: "global", category: "page-selection", skillId: "skill-shorten" },
      "global:organization": { id: "global:organization", level: "global", category: "organization", skillId: "skill-organize" },
      "global:generation": { id: "global:generation", level: "global", category: "generation", skillId: "skill-draft-reply" },
      "project:project-a:transcription": { id: "project:project-a:transcription", level: "project", projectId: "project-a", category: "transcription", skillId: "skill-field-voice" },
      "project:project-a:page-selection": { id: "project:project-a:page-selection", level: "project", projectId: "project-a", category: "page-selection", skillId: "skill-decision-signal" },
    },
    pinnedSkillIds: ["skill-translate-zh", "skill-shorten", "skill-decision-signal"],
    recentSkillIds: ["skill-rewrite", "skill-explain"],
    hiddenBuiltInSkillIds: [],
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
