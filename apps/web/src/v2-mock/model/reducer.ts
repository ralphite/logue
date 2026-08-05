import type { MockEvent } from "./events";
import { getBindableSkills, globalSkillBindingId, membershipId, projectSkillBindingId, resolveSkill } from "./selectors";
import { executeSkill } from "./skillExecutor";
import { skillPolicyDefaults } from "./skillContract";
import type { BrowserPage, DomainState, Id, MockSessionState, SkillCategory, SkillInputScope, Source, SourceMembership } from "./types";

const now = "2026-08-05T12:00:00.000Z";

function nextId(domain: DomainState, prefix: string): [string, DomainState] {
  return [`${prefix}-${domain.nextId}`, { ...domain, nextId: domain.nextId + 1 }];
}

function executeSkillRun(domain: DomainState, options: {
  category: SkillCategory;
  inputScope: SkillInputScope;
  input: string;
  explicitSkillId?: Id;
  projectId?: Id | null;
  contextSourceIds?: Id[];
  activityId?: Id | null;
}) {
  const resolved = resolveSkill(domain, options.category, { explicitSkillId: options.explicitSkillId, projectId: options.projectId, inputScope: options.inputScope });
  if (!resolved || !options.input.trim()) return null;
  const [runId, afterRunId] = nextId(domain, "run");
  const [candidateId, afterCandidateId] = nextId(afterRunId, "candidate");
  const requestedContextSourceIds = (options.contextSourceIds ?? []).filter((sourceId) => Boolean(domain.sources[sourceId]));
  const actualContextSourceIds = resolved.revision.projectContext === "never" ? [] : requestedContextSourceIds;
  if (resolved.revision.projectContext === "required" && !actualContextSourceIds.length) return null;
  const contextSources = actualContextSourceIds.map((sourceId) => domain.sources[sourceId]);
  const content = executeSkill({ skill: resolved.skill, revision: resolved.revision, input: options.input, contextSources });
  const run = {
    id: runId,
    activityId: options.activityId ?? null,
    projectId: options.projectId && domain.projects[options.projectId] ? options.projectId : null,
    status: "succeeded" as const,
    actualContextSourceIds,
    candidateId,
    skillId: resolved.skill.id,
    skillRevisionId: resolved.revision.id,
    skillResolution: resolved.source,
    inputScope: options.inputScope,
    input: options.input,
  };
  const candidate = { id: candidateId, runId, content, contextSourceIds: actualContextSourceIds, citations: [], status: "ready" as const };
  return {
    domain: {
      ...afterCandidateId,
      runs: { ...afterCandidateId.runs, [runId]: run },
      candidates: { ...afterCandidateId.candidates, [candidateId]: candidate },
      recentSkillIds: [resolved.skill.id, ...afterCandidateId.recentSkillIds.filter((skillId) => skillId !== resolved.skill.id)].slice(0, 8),
    },
    run,
    candidate,
  };
}

function withoutSkillBindings(domain: DomainState, skillId: Id) {
  return Object.fromEntries(Object.entries(domain.skillBindings).filter(([, binding]) => binding.skillId !== skillId));
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
      const projectId = nextDomain.tabs[recording.tabId]?.activeProjectId;
      const transcription = executeSkillRun(nextDomain, { category: "transcription", inputScope: "voice-comment", input: event.transcript, projectId });
      const afterTranscription = transcription?.domain ?? nextDomain;
      const transcript = transcription?.candidate.content ?? event.transcript.trim();
      const transformation = executeSkillRun(afterTranscription, { category: "transformation", inputScope: "voice-comment", input: transcript, projectId });
      const afterSkills = transformation?.domain ?? afterTranscription;
      const candidate = transformation?.candidate.content ?? transcript;
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
          ...(transcription ? [{ id: `${sourceId}-normalized`, kind: "normalized" as const, content: transcript, createdAt: now, runId: transcription.run.id }] : []),
          { id: `${sourceId}-candidate`, kind: "candidate", content: candidate, createdAt: now, runId: transformation?.run.id ?? transcription?.run.id },
        ],
      };
      return {
        domain: { ...afterSkills, sources: { ...afterSkills.sources, [sourceId]: source } },
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
      const projectId = nextDomain.tabs[recording.tabId]?.activeProjectId;
      const transcription = executeSkillRun(nextDomain, { category: "transcription", inputScope: "voice-write", input: event.transcript, projectId });
      const afterTranscription = transcription?.domain ?? nextDomain;
      const transcript = transcription?.candidate.content ?? event.transcript.trim();
      const transformation = executeSkillRun(afterTranscription, { category: "transformation", inputScope: "voice-write", input: transcript, projectId });
      const afterVoiceSkills = transformation?.domain ?? afterTranscription;
      const transformed = transformation?.candidate.content ?? transcript;
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
          { id: `${sourceId}-raw`, kind: "raw", content: event.transcript.trim(), createdAt: now },
          ...(transcription ? [{ id: `${sourceId}-normalized`, kind: "normalized" as const, content: transcript, createdAt: now, transcriptionProfileId: event.transcriptionProfileId, runId: transcription.run.id }] : []),
          { id: `${sourceId}-candidate`, kind: "candidate", content: transformed, createdAt: now, transcriptionProfileId: event.transcriptionProfileId, runId: transformation?.run.id ?? transcription?.run.id },
        ],
      };
      const withSource = { ...afterVoiceSkills, sources: { ...afterVoiceSkills.sources, [sourceId]: source } };
      const organization = projectId ? executeSkillRun(withSource, { category: "organization", inputScope: "project-sources", input: transformed, projectId, contextSourceIds: [sourceId] }) : null;
      const afterOrganization = organization?.domain ?? withSource;
      const withSuggestion = projectId ? {
        ...afterOrganization,
        memberships: {
          ...afterOrganization.memberships,
          [membershipId(projectId, sourceId)]: { id: membershipId(projectId, sourceId), projectId, sourceId, state: "suggested" as const, reason: "suggested" as const, runId: organization?.run.id },
        },
      } : afterOrganization;
      return {
        domain: withSuggestion,
        surface: { ...state.surface, recording: null, selectedSourceId: sourceId },
      };
    }
    case "retranscribe-voice-write": {
      const source = domain.sources[event.sourceId];
      if (!source || source.origin !== "you" || source.title !== "Voice write") return state;
      const tab = Object.values(domain.tabs).find((item) => item.pageId === source.pageId) ?? domain.tabs[state.surface.activeTabId];
      const projectId = tab?.activeProjectId;
      const transcription = executeSkillRun(domain, { category: "transcription", inputScope: "voice-write", input: event.transcript, projectId });
      const afterTranscription = transcription?.domain ?? domain;
      const transcript = transcription?.candidate.content ?? event.transcript.trim();
      const transformation = executeSkillRun(afterTranscription, { category: "transformation", inputScope: "voice-write", input: transcript, projectId });
      const nextDomain = transformation?.domain ?? afterTranscription;
      const revision = {
        id: `${source.id}-candidate-${source.revisions.length + 1}`,
        kind: "candidate" as const,
        content: transformation?.candidate.content ?? transcript,
        createdAt: now,
        transcriptionProfileId: event.transcriptionProfileId,
        runId: transformation?.run.id ?? transcription?.run.id,
      };
      return { ...state, domain: { ...nextDomain, sources: { ...nextDomain.sources, [source.id]: { ...source, revisions: [...source.revisions, revision] } } } };
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
      const resolved = resolveSkill(domain, "generation", { projectId: activity.parsedIntent.projectId, inputScope: "project-sources" });
      if (!resolved) return state;
      const [runId, nextDomain] = nextId(domain, "run");
      const requestedContextSourceIds = event.contextSourceIds.filter((sourceId) => Boolean(nextDomain.sources[sourceId]));
      const actualContextSourceIds = resolved.revision.projectContext === "never" ? [] : requestedContextSourceIds;
      if (resolved.revision.projectContext === "required" && !actualContextSourceIds.length) return state;
      return {
        ...state,
        domain: {
          ...nextDomain,
          runs: {
            ...nextDomain.runs,
            [runId]: { id: runId, activityId: activity.id, projectId: activity.parsedIntent.projectId, status: "running", actualContextSourceIds, skillId: resolved.skill.id, skillRevisionId: resolved.revision.id, skillResolution: resolved.source, inputScope: "project-sources", input: activity.transcript },
          },
        },
      };
    }
    case "generate-sourced-draft": {
      const run = domain.runs[event.runId];
      const skill = run?.skillId ? domain.skills[run.skillId] : undefined;
      const revision = run?.skillRevisionId ? domain.skillRevisions[run.skillRevisionId] : undefined;
      if (!run || !skill || !revision || !run.input) return state;
      const [candidateId, nextDomain] = nextId(domain, "candidate");
      const citations = event.citations.filter((citation) => run.actualContextSourceIds.includes(citation.sourceId));
      const content = executeSkill({ skill, revision, input: run.input, contextSources: run.actualContextSourceIds.map((sourceId) => domain.sources[sourceId]).filter(Boolean) });
      const candidate = { id: candidateId, runId: run.id, content, contextSourceIds: [...run.actualContextSourceIds], citations, status: "ready" as const };
      return {
        domain: {
          ...nextDomain,
          candidates: { ...nextDomain.candidates, [candidateId]: candidate },
          runs: { ...nextDomain.runs, [run.id]: { ...run, status: "succeeded", candidateId } },
        },
        surface: { ...state.surface, activeCandidateId: candidateId },
      };
    }
    case "run-skill": {
      const executed = executeSkillRun(domain, event);
      if (!executed) return state;
      return {
        domain: executed.domain,
        surface: { ...state.surface, activeCandidateId: executed.candidate.id },
      };
    }
    case "adopt-skill-candidate": {
      const candidate = domain.candidates[event.candidateId];
      const run = candidate ? domain.runs[candidate.runId] : undefined;
      if (!candidate || candidate.status !== "ready" || !run?.skillId) return state;
      const selectionTarget = event.selectionTargetId ? domain.selectionTargets[event.selectionTargetId] : undefined;
      if (event.adoption === "replace" && (!selectionTarget || selectionTarget.value !== run.input)) return state;
      const selectionTargets = selectionTarget ? {
        ...domain.selectionTargets,
        [selectionTarget.id]: {
          ...selectionTarget,
          value: candidate.content,
          revisions: [...selectionTarget.revisions, { id: `${selectionTarget.id}-replacement-${selectionTarget.revisions.length + 1}`, kind: "replacement" as const, content: candidate.content, createdAt: now, runId: run.id }],
          lastReplacement: { candidateId: candidate.id, previousValue: selectionTarget.value, insertedValue: candidate.content },
        },
      } : domain.selectionTargets;
      return {
        ...state,
        domain: { ...domain, selectionTargets, candidates: { ...domain.candidates, [candidate.id]: { ...candidate, status: "adopted", adoption: event.adoption } } },
        surface: { ...state.surface, activeCandidateId: event.adoption === "copy" ? null : candidate.id },
      };
    }
    case "dismiss-skill-candidate": {
      const candidate = domain.candidates[event.candidateId];
      const run = candidate ? domain.runs[candidate.runId] : undefined;
      if (!candidate || candidate.status !== "ready" || !run?.skillId) return state;
      return {
        ...state,
        domain: { ...domain, candidates: { ...domain.candidates, [candidate.id]: { ...candidate, status: "dismissed" } } },
        surface: { ...state.surface, activeCandidateId: state.surface.activeCandidateId === candidate.id ? null : state.surface.activeCandidateId },
      };
    }
    case "undo-skill-adoption": {
      const candidate = domain.candidates[event.candidateId];
      const run = candidate ? domain.runs[candidate.runId] : undefined;
      const selectionTarget = domain.selectionTargets[event.selectionTargetId];
      if (!candidate || candidate.status !== "adopted" || candidate.adoption !== "replace" || !run?.skillId || selectionTarget?.lastReplacement?.candidateId !== candidate.id) return state;
      return {
        ...state,
        domain: {
          ...domain,
          selectionTargets: {
            ...domain.selectionTargets,
            [selectionTarget.id]: {
              ...selectionTarget,
              value: selectionTarget.lastReplacement.previousValue,
              revisions: [...selectionTarget.revisions, { id: `${selectionTarget.id}-restored-${selectionTarget.revisions.length + 1}`, kind: "restored", content: selectionTarget.lastReplacement.previousValue, createdAt: now, runId: run.id }],
              lastReplacement: undefined,
            },
          },
          candidates: { ...domain.candidates, [candidate.id]: { ...candidate, status: "ready", adoption: undefined } },
        },
        surface: { ...state.surface, activeCandidateId: candidate.id },
      };
    }
    case "create-my-skill": {
      const name = event.name.trim();
      const description = event.description.trim();
      const instruction = event.instruction.trim();
      if (!name || !instruction || !event.allowedInputScopes.length) return state;
      const [skillId, afterSkillId] = nextId(domain, "skill");
      const [revisionId, nextDomain] = nextId(afterSkillId, "skill-revision");
      return {
        ...state,
        domain: {
          ...nextDomain,
          skills: {
            ...nextDomain.skills,
            [skillId]: { id: skillId, name, description, category: event.category, trigger: skillPolicyDefaults[event.category].trigger, origin: "user", allowedInputScopes: [...event.allowedInputScopes], revisionIds: [revisionId], currentRevisionId: revisionId, systemDefault: false, archived: false },
          },
          skillRevisions: {
            ...nextDomain.skillRevisions,
            [revisionId]: { id: revisionId, skillId, version: 1, instruction, outputFormat: event.outputFormat, languageTone: event.languageTone.trim(), projectContext: event.projectContext, resultBehavior: event.resultBehavior, createdAt: now },
          },
        },
      };
    }
    case "revise-my-skill": {
      const skill = domain.skills[event.skillId];
      const currentRevision = skill ? domain.skillRevisions[skill.currentRevisionId] : undefined;
      const name = event.name.trim();
      const description = event.description.trim();
      const instruction = event.instruction.trim();
      if (!skill || skill.origin !== "user" || skill.archived || !currentRevision || !name || !instruction || !event.allowedInputScopes.length) return state;
      if (skill.name === name && skill.description === description && currentRevision.instruction === instruction && skill.allowedInputScopes.join("|") === event.allowedInputScopes.join("|") && currentRevision.outputFormat === event.outputFormat && currentRevision.languageTone === event.languageTone.trim() && currentRevision.projectContext === event.projectContext && currentRevision.resultBehavior === event.resultBehavior) return state;
      const [revisionId, nextDomain] = nextId(domain, "skill-revision");
      const version = Math.max(...skill.revisionIds.map((id) => domain.skillRevisions[id]?.version ?? 0)) + 1;
      return {
        ...state,
        domain: {
          ...nextDomain,
          skills: { ...nextDomain.skills, [skill.id]: { ...skill, name, description, allowedInputScopes: [...event.allowedInputScopes], revisionIds: [...skill.revisionIds, revisionId], currentRevisionId: revisionId } },
          skillRevisions: { ...nextDomain.skillRevisions, [revisionId]: { id: revisionId, skillId: skill.id, version, instruction, outputFormat: event.outputFormat, languageTone: event.languageTone.trim(), projectContext: event.projectContext, resultBehavior: event.resultBehavior, createdAt: now } },
        },
      };
    }
    case "duplicate-skill": {
      const source = domain.skills[event.skillId];
      const sourceRevision = source ? domain.skillRevisions[source.currentRevisionId] : undefined;
      if (!source || !sourceRevision) return state;
      const [skillId, afterSkillId] = nextId(domain, "skill");
      const [revisionId, nextDomain] = nextId(afterSkillId, "skill-revision");
      return {
        ...state,
        domain: {
          ...nextDomain,
          skills: {
            ...nextDomain.skills,
            [skillId]: { ...source, id: skillId, name: event.name?.trim() || `${source.name} copy`, origin: "user", revisionIds: [revisionId], currentRevisionId: revisionId, systemDefault: false, archived: false },
          },
          skillRevisions: { ...nextDomain.skillRevisions, [revisionId]: { ...sourceRevision, id: revisionId, skillId, version: 1, createdAt: now } },
        },
      };
    }
    case "set-skill-archived": {
      const skill = domain.skills[event.skillId];
      if (!skill || skill.origin !== "user") return state;
      return {
        ...state,
        domain: {
          ...domain,
          skills: { ...domain.skills, [skill.id]: { ...skill, archived: event.archived } },
          pinnedSkillIds: event.archived ? domain.pinnedSkillIds.filter((id) => id !== skill.id) : domain.pinnedSkillIds,
          skillBindings: event.archived ? withoutSkillBindings(domain, skill.id) : domain.skillBindings,
        },
      };
    }
    case "set-built-in-hidden": {
      const skill = domain.skills[event.skillId];
      if (!skill || skill.origin !== "built-in") return state;
      const hiddenBuiltInSkillIds = event.hidden
        ? Array.from(new Set([...domain.hiddenBuiltInSkillIds, skill.id]))
        : domain.hiddenBuiltInSkillIds.filter((id) => id !== skill.id);
      return {
        ...state,
        domain: {
          ...domain,
          hiddenBuiltInSkillIds,
          pinnedSkillIds: event.hidden ? domain.pinnedSkillIds.filter((id) => id !== skill.id) : domain.pinnedSkillIds,
          skillBindings: event.hidden ? withoutSkillBindings(domain, skill.id) : domain.skillBindings,
        },
      };
    }
    case "set-skill-pinned": {
      const skill = domain.skills[event.skillId];
      if (!skill || skill.archived || skill.category !== "page-selection" || domain.hiddenBuiltInSkillIds.includes(skill.id)) return state;
      const pinnedSkillIds = event.pinned
        ? Array.from(new Set([...domain.pinnedSkillIds, skill.id]))
        : domain.pinnedSkillIds.filter((id) => id !== skill.id);
      return { ...state, domain: { ...domain, pinnedSkillIds } };
    }
    case "set-global-skill-binding": {
      const skill = domain.skills[event.skillId];
      if (!skill || !getBindableSkills(domain, event.category).some((candidate) => candidate.id === skill.id)) return state;
      const id = globalSkillBindingId(event.category);
      return { ...state, domain: { ...domain, skillBindings: { ...domain.skillBindings, [id]: { id, level: "global", category: event.category, skillId: skill.id } } } };
    }
    case "set-project-skill-binding": {
      const skill = domain.skills[event.skillId];
      if (!domain.projects[event.projectId] || !skill || !getBindableSkills(domain, event.category).some((candidate) => candidate.id === skill.id)) return state;
      const id = projectSkillBindingId(event.projectId, event.category);
      return { ...state, domain: { ...domain, skillBindings: { ...domain.skillBindings, [id]: { id, level: "project", projectId: event.projectId, category: event.category, skillId: skill.id } } } };
    }
    case "reset-project-skill-binding": {
      const id = projectSkillBindingId(event.projectId, event.category);
      if (!domain.skillBindings[id]) return state;
      const skillBindings = { ...domain.skillBindings };
      delete skillBindings[id];
      return { ...state, domain: { ...domain, skillBindings } };
    }
    case "restore-run": {
      const run = domain.runs[event.runId];
      return run?.candidateId && domain.candidates[run.candidateId] ? { ...state, surface: { ...state.surface, activeCandidateId: run.candidateId } } : state;
    }
    case "retry-run": {
      const previous = domain.runs[event.runId];
      if (!previous) return state;
      const [runId, afterRunId] = nextId(domain, "run");
      const [candidateId, afterCandidateId] = nextId(afterRunId, "candidate");
      const citations = previous.actualContextSourceIds.slice(0, 2).flatMap((sourceId) => {
        const source = domain.sources[sourceId];
        return source ? [{ sourceId, label: source.title, excerpt: source.revisions.at(-1)?.content ?? "" }] : [];
      });
      const run = { ...previous, id: runId, status: "succeeded" as const, candidateId };
      const skill = previous.skillId ? domain.skills[previous.skillId] : undefined;
      const revision = previous.skillRevisionId ? domain.skillRevisions[previous.skillRevisionId] : undefined;
      const content = skill && revision && previous.input
        ? executeSkill({ skill, revision, input: previous.input, contextSources: previous.actualContextSourceIds.map((sourceId) => domain.sources[sourceId]).filter(Boolean) })
        : "Retry completed with the saved request and the same actual Sources.";
      const candidate = { id: candidateId, runId, content, contextSourceIds: [...previous.actualContextSourceIds], citations, status: "ready" as const };
      return {
        domain: { ...afterCandidateId, runs: { ...afterCandidateId.runs, [runId]: run }, candidates: { ...afterCandidateId.candidates, [candidateId]: candidate } },
        surface: { ...state.surface, activeCandidateId: candidateId },
      };
    }
    case "delete-run": {
      const run = domain.runs[event.runId];
      const candidate = run?.candidateId ? domain.candidates[run.candidateId] : undefined;
      if (!run || candidate?.status === "adopted") return state;
      const runs = { ...domain.runs };
      const candidates = { ...domain.candidates };
      delete runs[run.id];
      if (candidate) delete candidates[candidate.id];
      return {
        domain: { ...domain, runs, candidates },
        surface: { ...state.surface, activeCandidateId: state.surface.activeCandidateId === candidate?.id ? null : state.surface.activeCandidateId },
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
