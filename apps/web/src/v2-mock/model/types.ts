/**
 * Shared, normalized state for the V2 mock. Domain data deliberately has no
 * UI-only flags: every surface reads the same durable product state.
 */
export type Id = string;

export type SourceOrigin = "web" | "you" | "ai";
export type SourceStatus = "saved" | "activity";
export type MembershipState = "saved-only" | "added" | "suggested" | "excluded" | "removed" | "duplicate-linked";
export type RunStatus = "running" | "succeeded" | "failed" | "cancelled";
export type CandidateStatus = "ready" | "adopted" | "dismissed";
export type SkillCategory = "transcription" | "transformation" | "page-selection" | "organization" | "generation";
export type SkillOrigin = "built-in" | "user";
export type SkillInputScope = "selection" | "page" | "editable-selection" | "voice-write" | "voice-comment" | "project-sources";
export type SkillResolutionSource = "explicit" | "project" | "global" | "system";
export type SkillTrigger = "after-speech" | "explicit-action" | "background-organization" | "ask-draft";
export type SkillOutputFormat = "plain-text" | "markdown" | "project-suggestion";
export type SkillProjectContext = "never" | "optional" | "required";
export type SkillResultBehavior = "transcript-revision" | "replace-or-copy" | "membership-suggestion" | "insert-copy-or-document";

export interface Project {
  id: Id;
  name: string;
  goal: string;
}

export interface BrowserPage {
  id: Id;
  url: string;
  title: string;
  selection: string;
  snapshot: string;
  webSourceId?: Id;
}

export interface BrowserTab {
  id: Id;
  pageId: Id;
  activeProjectId: Id | null;
}

export interface SourceRevision {
  id: Id;
  kind: "raw" | "normalized" | "candidate" | "adopted";
  content: string;
  createdAt: string;
  transcriptionProfileId?: string;
  runId?: Id;
}

export interface Source {
  id: Id;
  origin: SourceOrigin;
  status: SourceStatus;
  title: string;
  createdAt: string;
  pageId?: Id;
  commentsOnSourceId?: Id;
  parentSourceIds: Id[];
  revisions: SourceRevision[];
  audio?: { id: Id; durationSeconds: number };
  activityKind?: "voice-command" | "ask" | "draft";
}

export interface SourceMembership {
  id: Id;
  projectId: Id;
  sourceId: Id;
  state: MembershipState;
  reason: "tab-authorized" | "user-selected" | "suggested" | "auto-classified" | "duplicate";
  runId?: Id;
}

export interface TargetSession {
  id: Id;
  tabId: Id;
  label: string;
  kind: "email" | "document" | "input";
  value: string;
  isValid: boolean;
  lastInsertion?: { candidateId: Id; previousValue: string; insertedValue: string };
}

export interface SelectionTargetRevision {
  id: Id;
  kind: "original" | "replacement" | "restored";
  content: string;
  createdAt: string;
  runId?: Id;
}

export interface SelectionTarget {
  id: Id;
  pageId: Id;
  value: string;
  revisions: SelectionTargetRevision[];
  lastReplacement?: { candidateId: Id; previousValue: string; insertedValue: string };
}

export interface Activity {
  id: Id;
  sourceId: Id;
  projectId: Id | null;
  targetSessionId?: Id;
  transcript: string;
  inputMode?: "voice" | "text";
  parsedIntent?: { action: "draft-reply"; projectId: Id; output: "current-target" };
}

export interface Citation {
  sourceId: Id;
  revisionId: Id;
  label: string;
  excerpt: string;
}

export interface Candidate {
  id: Id;
  runId: Id;
  content: string;
  contextSourceIds: Id[];
  citations: Citation[];
  status: CandidateStatus;
  adoption?: "replace" | "copy" | "insert" | "keep" | "document";
  adoptionTargetSessionId?: Id;
  adoptionUndone?: boolean;
}

export interface Run {
  id: Id;
  activityId: Id | null;
  projectId: Id | null;
  status: RunStatus;
  actualContext: Array<{ sourceId: Id; revisionId: Id }>;
  candidateId?: Id;
  skillId?: Id;
  skillRevisionId?: Id;
  skillResolution?: SkillResolutionSource;
  inputScope?: SkillInputScope;
  input?: string;
  targetSessionId?: Id;
  idempotencyKey?: string;
  failureReason?: "no-project-context" | "model-not-ready" | "source-revision-missing";
}

export interface Skill {
  id: Id;
  name: string;
  description: string;
  category: SkillCategory;
  trigger: SkillTrigger;
  origin: SkillOrigin;
  allowedInputScopes: SkillInputScope[];
  revisionIds: Id[];
  currentRevisionId: Id;
  systemDefault: boolean;
  archived: boolean;
}

export interface SkillRevision {
  id: Id;
  skillId: Id;
  version: number;
  instruction: string;
  outputFormat: SkillOutputFormat;
  languageTone: string;
  projectContext: SkillProjectContext;
  resultBehavior: SkillResultBehavior;
  createdAt: string;
}

export interface SkillBinding {
  id: Id;
  level: "global" | "project";
  category: SkillCategory;
  skillId: Id;
  projectId?: Id;
}

export interface DocumentRevision {
  id: Id;
  documentId: Id;
  content: string;
  sourceIds: Id[];
  runId?: Id;
}

export interface Document {
  id: Id;
  projectId: Id;
  title: string;
  revisionIds: Id[];
}

export interface ProviderState {
  id: "voice" | "ai";
  label: string;
  status: "ready" | "needs-attention";
}

export interface PendingCapture {
  id: Id;
  sourceId: Id;
  state: "pending" | "uploaded" | "failed";
}

export interface HostState {
  status: "ready" | "offline";
  providers: Record<ProviderState["id"], ProviderState>;
  pendingCaptures: Record<Id, PendingCapture>;
}

export interface DomainState {
  projects: Record<Id, Project>;
  pages: Record<Id, BrowserPage>;
  tabs: Record<Id, BrowserTab>;
  sources: Record<Id, Source>;
  memberships: Record<Id, SourceMembership>;
  targetSessions: Record<Id, TargetSession>;
  selectionTargets: Record<Id, SelectionTarget>;
  activities: Record<Id, Activity>;
  runs: Record<Id, Run>;
  candidates: Record<Id, Candidate>;
  skills: Record<Id, Skill>;
  skillRevisions: Record<Id, SkillRevision>;
  skillBindings: Record<Id, SkillBinding>;
  pinnedSkillIds: Id[];
  recentSkillIds: Id[];
  hiddenBuiltInSkillIds: Id[];
  documents: Record<Id, Document>;
  documentRevisions: Record<Id, DocumentRevision>;
  host: HostState;
  nextId: number;
}

/** UI state is intentionally separate: it may be reset without data loss. */
export interface SurfaceState {
  activeTabId: Id;
  selectedSourceId: Id | null;
  selectedTargetSessionId: Id | null;
  activeCandidateId: Id | null;
  recording:
    | { kind: "voice-comment"; tabId: Id; pageId: Id }
    | { kind: "voice-write"; tabId: Id; pageId: Id; targetSessionId: Id }
    | null;
  commandActivityId: Id | null;
  openCitationSourceId: Id | null;
  openCitationRevisionId: Id | null;
}

export interface MockSessionState {
  domain: DomainState;
  surface: SurfaceState;
}
