import type { MockEvent } from "./events";
import { membershipId } from "./selectors";
import type { BrowserPage, DomainState, MockSessionState, Source, SourceMembership } from "./types";

const now = "2026-08-05T12:00:00.000Z";

function nextId(domain: DomainState, prefix: string): [string, DomainState] {
  return [`${prefix}-${domain.nextId}`, { ...domain, nextId: domain.nextId + 1 }];
}

function withMembership(domain: DomainState, projectId: string | null | undefined, sourceId: string, reason: SourceMembership["reason"]): DomainState {
  if (!projectId || !domain.projects[projectId]) return domain;
  const id = membershipId(projectId, sourceId);
  return {
    ...domain,
    memberships: {
      ...domain.memberships,
      [id]: { id, projectId, sourceId, state: "added", reason },
    },
  };
}

function projectForComment(domain: DomainState, tabId: string, explicitProjectId?: string | null) {
  return explicitProjectId === undefined ? domain.tabs[tabId]?.activeProjectId : explicitProjectId;
}

function createOrReuseWebSource(domain: DomainState, page: BrowserPage): [string, DomainState] {
  if (page.webSourceId && domain.sources[page.webSourceId]) return [page.webSourceId, domain];
  const [webSourceId, afterId] = nextId(domain, "web");
  const source: Source = {
    id: webSourceId,
    origin: "web",
    status: "saved",
    title: page.title,
    createdAt: now,
    pageId: page.id,
    parentSourceIds: [],
    revisions: [{ id: `${webSourceId}-raw`, kind: "raw", content: page.snapshot, createdAt: now }],
  };
  return [
    webSourceId,
    {
      ...afterId,
      sources: { ...afterId.sources, [webSourceId]: source },
      pages: { ...afterId.pages, [page.id]: { ...page, webSourceId } },
    },
  ];
}

function saveCommentBundle(
  domain: DomainState,
  commentSourceId: string,
  tabId: string,
  pageId: string | undefined,
  explicitProjectId?: string | null,
): DomainState {
  const comment = domain.sources[commentSourceId];
  const page = domain.pages[pageId ?? domain.tabs[tabId]?.pageId];
  if (!comment || !page || comment.origin !== "you") return domain;
  const [webSourceId, withWeb] = createOrReuseWebSource(domain, page);
  const projectId = projectForComment(withWeb, tabId, explicitProjectId);
  const linked = {
    ...withWeb,
    sources: {
      ...withWeb.sources,
      [commentSourceId]: { ...comment, commentsOnSourceId: webSourceId },
    },
  };
  const reason = explicitProjectId === undefined ? "tab-authorized" : "user-selected";
  return withMembership(withMembership(linked, projectId, webSourceId, reason), projectId, commentSourceId, reason);
}

/** A pure semantic reducer. It makes durable changes only; transient UI belongs in surface. */
export function reduceMockSession(state: MockSessionState, event: MockEvent): MockSessionState {
  const domain = state.domain;
  switch (event.type) {
    case "set-tab-project": {
      const tab = domain.tabs[event.tabId];
      if (!tab || (event.projectId !== null && !domain.projects[event.projectId])) return state;
      return { ...state, domain: { ...domain, tabs: { ...domain.tabs, [tab.id]: { ...tab, activeProjectId: event.projectId } } } };
    }
    case "select-article": {
      const tab = domain.tabs[event.tabId];
      if (!tab || !domain.pages[event.pageId]) return state;
      return {
        ...state,
        domain: { ...domain, tabs: { ...domain.tabs, [tab.id]: { ...tab, pageId: event.pageId } } },
        surface: { ...state.surface, activeTabId: tab.id },
      };
    }
    case "start-voice-comment": {
      const tab = domain.tabs[event.tabId];
      const pageId = event.pageId ?? tab?.pageId;
      if (!tab || !pageId || !domain.pages[pageId]) return state;
      return { ...state, surface: { ...state.surface, activeTabId: tab.id, recording: { kind: "voice-comment", tabId: tab.id, pageId } } };
    }
    case "stop-voice-comment": {
      const recording = state.surface.recording;
      if (!recording || recording.kind !== "voice-comment") return state;
      const [sourceId, nextDomain] = nextId(domain, "you-comment");
      const source: Source = {
        id: sourceId,
        origin: "you",
        status: "saved",
        title: "Voice comment",
        createdAt: now,
        pageId: recording.pageId,
        parentSourceIds: [],
        audio: { id: `${sourceId}-audio`, durationSeconds: 8 },
        revisions: [
          { id: `${sourceId}-raw`, kind: "raw", content: event.transcript, createdAt: now },
          { id: `${sourceId}-candidate`, kind: "candidate", content: event.transcript, createdAt: now },
        ],
      };
      return {
        domain: { ...nextDomain, sources: { ...nextDomain.sources, [sourceId]: source } },
        surface: { ...state.surface, recording: null, selectedSourceId: sourceId },
      };
    }
    case "edit-voice-comment": {
      const source = domain.sources[event.sourceId];
      if (!source || source.origin !== "you" || source.title !== "Voice comment" || source.commentsOnSourceId) return state;
      const candidateIndex = source.revisions.findIndex((revision) => revision.kind === "candidate");
      if (candidateIndex < 0) return state;
      const revisions = source.revisions.map((revision, index) => index === candidateIndex ? { ...revision, content: event.content } : revision);
      return { ...state, domain: { ...domain, sources: { ...domain.sources, [source.id]: { ...source, revisions } } } };
    }
    case "start-voice-write": {
      const tab = domain.tabs[event.tabId];
      const target = domain.targetSessions[event.targetSessionId];
      const pageId = event.pageId ?? tab?.pageId;
      if (!tab || !pageId || !domain.pages[pageId] || !target?.isValid || target.tabId !== tab.id) return state;
      return {
        ...state,
        surface: { ...state.surface, activeTabId: tab.id, selectedTargetSessionId: target.id, recording: { kind: "voice-write", tabId: tab.id, pageId, targetSessionId: target.id } },
      };
    }
    case "cancel-recording":
      return { ...state, surface: { ...state.surface, recording: null } };
    case "stop-voice-write": {
      const recording = state.surface.recording;
      if (!recording || recording.kind !== "voice-write") return state;
      const [sourceId, nextDomain] = nextId(domain, "you-write");
      const transcript = event.transcript.trim();
      const source: Source = {
        id: sourceId,
        origin: "you",
        status: "saved",
        title: "Voice write",
        createdAt: now,
        pageId: recording.pageId,
        parentSourceIds: [],
        audio: { id: `${sourceId}-audio`, durationSeconds: 7 },
        revisions: [
          { id: `${sourceId}-raw`, kind: "raw", content: transcript, createdAt: now },
          { id: `${sourceId}-candidate`, kind: "candidate", content: transcript, createdAt: now, transcriptionProfileId: event.transcriptionProfileId },
        ],
      };
      const projectId = domain.tabs[recording.tabId]?.activeProjectId;
      const withSource = { ...nextDomain, sources: { ...nextDomain.sources, [sourceId]: source } };
      const withSuggestion = projectId ? {
        ...withSource,
        memberships: {
          ...withSource.memberships,
          [membershipId(projectId, sourceId)]: { id: membershipId(projectId, sourceId), projectId, sourceId, state: "suggested" as const, reason: "suggested" as const },
        },
      } : withSource;
      return {
        domain: withSuggestion,
        surface: { ...state.surface, recording: null, selectedSourceId: sourceId },
      };
    }
    case "retranscribe-voice-write": {
      const source = domain.sources[event.sourceId];
      if (!source || source.origin !== "you" || source.title !== "Voice write") return state;
      const revision = {
        id: `${source.id}-candidate-${source.revisions.length + 1}`,
        kind: "candidate" as const,
        content: event.transcript.trim(),
        createdAt: now,
        transcriptionProfileId: event.transcriptionProfileId,
      };
      return { ...state, domain: { ...domain, sources: { ...domain.sources, [source.id]: { ...source, revisions: [...source.revisions, revision] } } } };
    }
    case "edit-voice-write": {
      const source = domain.sources[event.sourceId];
      if (!source || source.origin !== "you") return state;
      const candidateIndex = source.revisions.map((revision) => revision.kind).lastIndexOf("candidate");
      if (candidateIndex < 0) return state;
      const revisions = source.revisions.map((revision, index) => index === candidateIndex ? { ...revision, content: event.content } : revision);
      return { ...state, domain: { ...domain, sources: { ...domain.sources, [source.id]: { ...source, revisions } } } };
    }
    case "insert-voice-write": {
      const source = domain.sources[event.sourceId];
      const target = domain.targetSessions[event.targetSessionId];
      if (!source || source.origin !== "you" || !target?.isValid) return state;
      const content = source.revisions.filter((revision) => revision.kind === "candidate").at(-1)?.content;
      if (!content) return state;
      const insertedValue = `${target.value}${target.value ? "\n\n" : ""}${content}`;
      const adoptedRevision = { id: `${source.id}-adopted-${source.revisions.length + 1}`, kind: "adopted" as const, content, createdAt: now };
      return {
        domain: {
          ...domain,
          sources: { ...domain.sources, [source.id]: { ...source, revisions: [...source.revisions, adoptedRevision] } },
          targetSessions: { ...domain.targetSessions, [target.id]: { ...target, value: insertedValue, lastInsertion: { candidateId: source.id, previousValue: target.value, insertedValue } } },
        },
        surface: { ...state.surface, selectedSourceId: source.id, selectedTargetSessionId: target.id },
      };
    }
    case "set-source-membership": {
      const source = domain.sources[event.sourceId];
      const project = domain.projects[event.projectId];
      if (!source || !project) return state;
      const id = membershipId(project.id, source.id);
      return {
        ...state,
        domain: {
          ...domain,
          memberships: {
            ...domain.memberships,
            [id]: { id, projectId: project.id, sourceId: source.id, state: event.state, reason: "user-selected" },
          },
        },
      };
    }
    case "save-comment-bundle":
      return { ...state, domain: saveCommentBundle(domain, event.commentSourceId, event.tabId, event.pageId, event.projectId) };
    case "save-text-comment": {
      const tab = domain.tabs[event.tabId];
      const pageId = event.pageId ?? tab?.pageId;
      if (!tab || !pageId || !event.text.trim()) return state;
      const [sourceId, nextDomain] = nextId(domain, "you-comment");
      const source: Source = {
        id: sourceId,
        origin: "you",
        status: "saved",
        title: "Text comment",
        createdAt: now,
        pageId,
        parentSourceIds: [],
        revisions: [{ id: `${sourceId}-raw`, kind: "raw", content: event.text.trim(), createdAt: now }],
      };
      const withComment = { ...nextDomain, sources: { ...nextDomain.sources, [sourceId]: source } };
      return {
        domain: saveCommentBundle(withComment, sourceId, event.tabId, pageId, event.projectId),
        surface: { ...state.surface, selectedSourceId: sourceId },
      };
    }
    case "open-email-target": {
      const target = domain.targetSessions[event.targetSessionId];
      if (!target || !target.isValid) return state;
      return { ...state, surface: { ...state.surface, activeTabId: target.tabId, selectedTargetSessionId: target.id } };
    }
    case "parse-command": {
      const target = domain.targetSessions[event.targetSessionId];
      if (!target || !target.isValid || !domain.projects[event.projectId]) return state;
      const [sourceId, afterSourceId] = nextId(domain, "activity");
      const [activityId, afterActivityId] = nextId(afterSourceId, "activity-record");
      const source: Source = {
        id: sourceId,
        origin: "you",
        status: "activity",
        activityKind: "voice-command",
        title: "Voice command",
        createdAt: now,
        parentSourceIds: [],
        revisions: [{ id: `${sourceId}-raw`, kind: "raw", content: event.transcript, createdAt: now }],
      };
      return {
        domain: {
          ...afterActivityId,
          sources: { ...afterActivityId.sources, [sourceId]: source },
          activities: {
            ...afterActivityId.activities,
            [activityId]: {
              id: activityId,
              sourceId,
              projectId: event.projectId,
              targetSessionId: target.id,
              transcript: event.transcript,
              parsedIntent: { action: "draft-reply", projectId: event.projectId, output: "current-target" },
            },
          },
        },
        surface: { ...state.surface, commandActivityId: activityId, selectedTargetSessionId: target.id },
      };
    }
    case "execute-command": {
      const activity = domain.activities[event.activityId];
      if (!activity?.parsedIntent) return state;
      const [runId, nextDomain] = nextId(domain, "run");
      const actualContextSourceIds = event.contextSourceIds.filter((sourceId) => Boolean(nextDomain.sources[sourceId]));
      return {
        ...state,
        domain: {
          ...nextDomain,
          runs: {
            ...nextDomain.runs,
            [runId]: { id: runId, activityId: activity.id, projectId: activity.parsedIntent.projectId, status: "running", actualContextSourceIds },
          },
        },
      };
    }
    case "generate-sourced-draft": {
      const run = domain.runs[event.runId];
      if (!run) return state;
      const [candidateId, nextDomain] = nextId(domain, "candidate");
      const citations = event.citations.filter((citation) => run.actualContextSourceIds.includes(citation.sourceId));
      const candidate = { id: candidateId, runId: run.id, content: event.content, contextSourceIds: [...run.actualContextSourceIds], citations, status: "ready" as const };
      return {
        domain: {
          ...nextDomain,
          candidates: { ...nextDomain.candidates, [candidateId]: candidate },
          runs: { ...nextDomain.runs, [run.id]: { ...run, status: "succeeded", candidateId } },
        },
        surface: { ...state.surface, activeCandidateId: candidateId },
      };
    }
    case "edit-candidate": {
      const candidate = domain.candidates[event.candidateId];
      if (!candidate || candidate.status !== "ready") return state;
      return { ...state, domain: { ...domain, candidates: { ...domain.candidates, [candidate.id]: { ...candidate, content: event.content } } } };
    }
    case "insert-candidate": {
      const candidate = domain.candidates[event.candidateId];
      const target = domain.targetSessions[event.targetSessionId];
      if (!candidate || !target?.isValid || candidate.status === "dismissed") return state;
      const aiSourceId = `ai-${candidate.id}`;
      const aiSource = domain.sources[aiSourceId] ?? {
        id: aiSourceId,
        origin: "ai" as const,
        status: "saved" as const,
        title: "Draft reply",
        createdAt: now,
        parentSourceIds: [...candidate.contextSourceIds],
        revisions: [{ id: `${aiSourceId}-adopted`, kind: "adopted" as const, content: candidate.content, createdAt: now }],
      };
      const insertedValue = `${target.value}${target.value ? "\n\n" : ""}${candidate.content}`;
      return {
        domain: {
          ...domain,
          sources: { ...domain.sources, [aiSourceId]: aiSource },
          candidates: { ...domain.candidates, [candidate.id]: { ...candidate, status: "adopted" } },
          targetSessions: {
            ...domain.targetSessions,
            [target.id]: { ...target, value: insertedValue, lastInsertion: { candidateId: candidate.id, previousValue: target.value, insertedValue } },
          },
        },
        surface: { ...state.surface, activeCandidateId: candidate.id, selectedTargetSessionId: target.id },
      };
    }
    case "undo-target": {
      const target = domain.targetSessions[event.targetSessionId];
      if (!target?.lastInsertion) return state;
      return {
        ...state,
        domain: {
          ...domain,
          targetSessions: { ...domain.targetSessions, [target.id]: { ...target, value: target.lastInsertion.previousValue, lastInsertion: undefined } },
        },
      };
    }
    case "open-citation":
      return domain.sources[event.sourceId] ? { ...state, surface: { ...state.surface, openCitationSourceId: event.sourceId } } : state;
    case "close-citation":
      return { ...state, surface: { ...state.surface, openCitationSourceId: null } };
  }
}
