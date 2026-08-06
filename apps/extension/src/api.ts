import type { MaterialKind, SourceInfo } from "@logue/ui";
import { createRequestId } from "./requestId";
import {
  assertLogueServerStatus,
  defaultServerURL,
  getServerURL,
  normalizeServerURL,
  removeServerPermission,
  removeUnusedServerPermission,
  requestServerPermission,
  saveServerURL,
  type LogueServerStatus,
} from "./serverConnection";
import type { ExtensionSkill, PageMaterial } from "./sidePanelModels";
import type { CaptureContext, ExtensionProjectSkillBindings, ProjectAssociation, ProjectVoiceProfile, ResolvedVoiceProfile, TopicVocabulary, VoiceProfile, VoiceProfileOverrides, VoiceProfileVocabulary } from "./voiceProfileModels";
import type { PendingVoicePlan, PendingVoiceQueueStatus, PendingVoiceSummary } from "./pendingVoice";

export type { ExtensionSkill, PageMaterial } from "./sidePanelModels";
export type { CaptureContext, ExtensionProjectSkillBindings, ProjectAssociation, ProjectVoiceProfile, ResolvedVoiceProfile, TopicVocabulary, VoiceProfile, VoiceProfileOverrides, VoiceProfileVocabulary } from "./voiceProfileModels";

interface ApiResponse<T> {
  ok: boolean;
  value?: T;
  error?: string;
  captureId?: string;
}

export class ExtensionApiError extends Error {
  captureId?: string;

  constructor(message: string, captureId?: string) {
    super(message);
    this.name = "ExtensionApiError";
    this.captureId = captureId;
  }
}

async function request<T>(action: string, payload?: Record<string, unknown>) {
  const response = (await chrome.runtime.sendMessage({
    type: "logue:api",
    action,
    payload,
  })) as ApiResponse<T>;
  if (!response?.ok) {
    throw new ExtensionApiError(response?.error || "Could not connect to the Logue service.", response?.captureId);
  }
  return response.value as T;
}

async function blobToBase64(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function getServiceStatus() {
  const status = await request<LogueServerStatus>("status");
  assertLogueServerStatus(status);
  return status;
}

export { defaultServerURL, getServerURL };

export async function connectServer(value: string, pairingCode = "") {
  const normalized = normalizeServerURL(value);
  await requestServerPermission(normalized);
  let status: LogueServerStatus;
  try {
    status = await request<LogueServerStatus>("test-server", { serverURL: normalized, pairingCode });
    assertLogueServerStatus(status);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause ?? "");
    const previous = await getServerURL();
    if (previous !== normalized) await removeServerPermission(normalized);
    if (/failed to fetch|network|timed out|connection|name not resolved/i.test(message)) {
      throw new Error("Can’t reach this address.");
    }
    if (/pairing|paired/i.test(message)) throw cause;
    if (/not a Logue server|not compatible/i.test(message)) throw cause;
    throw new Error("This address is not a Logue server.");
  }
  const previous = await getServerURL();
  await saveServerURL(normalized);
  await removeUnusedServerPermission(previous, normalized);
  return { url: normalized, status };
}

export interface ExtensionSettings {
  default_extension_skill: string;
}

export interface ExtensionSkillRun {
  id: string;
  skill_id: string;
  skill_name: string;
  original_output?: string;
  adopted_output?: string;
  status: "running" | "complete" | "failed";
  error?: string;
  material_id?: string;
  adoption?: "insert" | "copy" | "keep" | "document";
  adoption_undone?: boolean;
  adoption_target?: { surface?: string; url?: string; target_key?: string };
  sources?: Array<{
    id: string;
    kind?: string;
    actor?: string;
    content: string;
    projects?: string[];
    tags?: string[];
    created_at?: string;
    source?: {
      url?: string;
      title?: string;
      domain?: string;
      selection?: string;
    } | null;
  }>;
}

export async function getExtensionSkills() {
  const response = await request<{ skills: ExtensionSkill[] }>("skills");
  return response.skills.filter((skill) => skill.enabled && skill.task === "generate" && skill.surfaces.includes("extension"));
}

export async function getExtensionSettings() {
  return request<ExtensionSettings>("settings");
}

export async function createExtensionSkillRun(input: {
  skillId: string;
  instruction: string;
  project?: string;
  sourceIds?: string[];
  pageTitle?: string;
  pageUrl?: string;
  targetText?: string;
  selection?: string;
  autoSearch?: boolean;
  activitySourceId?: string;
}) {
  return request<ExtensionSkillRun>("skill-run", {
    request_id: createRequestId(),
    skill_id: input.skillId,
    instruction: input.instruction,
    project: input.project,
    source_ids: input.sourceIds ?? [],
    page_title: input.pageTitle,
    page_url: input.pageUrl,
    target_text: input.targetText,
    selection: input.selection,
    activity_source_id: input.activitySourceId,
    ...(input.autoSearch !== undefined ? { auto_search: input.autoSearch } : {}),
  });
}

export async function adoptExtensionSkillRun(id: string, adoptedOutput: string, result: { action?: "insert" | "copy" | "replace" | "keep" | "undo"; target?: { surface?: string; url?: string; target_key?: string } } = {}) {
  const response = await request<{ run: ExtensionSkillRun }>("adopt-skill-run", { id, adoptedOutput, action: result.action ?? "copy", target: result.target });
  return response.run;
}

export interface AppliedContext {
  page_url: string;
  page_title: string;
  reference_project?: string;
  profile_project?: string;
  personal_context?: string;
  project_overview?: string;
  glossary?: string[];
  recent_adopted_ids?: string[];
  recent_adopted_texts?: string[];
  transcription_skill_id?: string;
  transcription_skill_name?: string;
  transcription_skill_revision?: number;
  transcription_skill_instructions?: string;
  voice_profile_label?: string;
  project_profile_mode?: string;
  primary_language?: string;
  mixed_languages?: string[];
  custom_instructions?: string;
  phrases?: string[];
  avoid_terms?: string[];
  formatting_preference?: string;
  disable_project_profile?: boolean;
  use_default_profile?: boolean;
  language_override?: string;
  topic_vocabulary_id?: string;
  topic_vocabulary_name?: string;
}

export async function getCaptureContext(pageUrl: string, project = "", overrides: VoiceProfileOverrides = {}) {
  return request<CaptureContext>("context", { pageUrl, project, ...overrides });
}

export async function createExtensionProject(name: string, overview = "") {
  return request<{ id: string; name: string; overview?: string }>("create-project", {
    name,
    overview,
  });
}

export async function saveProjectAssociation(input: { scope: "page" | "site"; pageUrl: string; project: string }) {
  return request<ProjectAssociation>("save-project-association", input);
}

export async function deleteProjectAssociation(id: string) {
  return request<void>("delete-project-association", { id });
}

export async function getPageMaterials(pageUrl: string) {
  const result = await request<{
    items?: Array<{
      id: string;
      kind: "voice" | "selection" | "text" | "derived";
      actor?: string;
      content: string;
      annotation?: string;
      parent_ids?: string[];
      capture_id?: string;
      comment_state?: "unlinked" | "linked";
      source?: SourceInfo;
      created_at: string;
      projects?: string[];
      excluded_projects?: string[];
      saved_only_projects?: string[];
      tags?: string[];
      organization?: {
        status?: string;
        reason?: string;
        suggested_projects?: string[];
        membership_origins?: Record<string, "auto_added" | "added">;
        duplicate_of?: string;
      };
    }>;
  }>("page-materials", { pageUrl });
  return (result.items ?? [])
    .map((item): PageMaterial => ({
      id: item.id,
      kind: item.kind,
      actor: item.actor,
      content: item.content,
      annotation: item.annotation,
      parentIds: item.parent_ids ?? [],
      captureId: item.capture_id,
      commentState: item.comment_state,
      source: item.source,
      createdAt: item.created_at,
      projects: item.projects ?? [],
      excludedProjects: item.excluded_projects ?? [],
      savedOnlyProjects: item.saved_only_projects ?? [],
      tags: item.tags ?? [],
      organization: item.organization ? {
        status: item.organization.status,
        reason: item.organization.reason,
        suggestedProjects: item.organization.suggested_projects ?? [],
        membershipOrigins: item.organization.membership_origins,
        duplicateOf: item.organization.duplicate_of,
      } : undefined,
    }))
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

export async function getProjectSources(project: string, query: string) {
  const result = await request<{ items?: Array<{
    id: string;
    kind?: string;
    actor?: string;
    content: string;
    projects?: string[];
    tags?: string[];
    created_at?: string;
    source?: { url?: string; title?: string; domain?: string; selection?: string } | null;
  }> }>("project-sources", { project, query });
  return (result.items ?? []).map((source) => ({
    id: source.id,
    kind: source.kind,
    actor: source.actor,
    content: source.content,
    projects: source.projects ?? [],
    tags: source.tags ?? [],
    createdAt: source.created_at,
    source: source.source ?? undefined,
  }));
}

export async function transcribeAudio(input: {

  requestId?: string;
  audio: Blob;
  source: SourceInfo;
  targetText?: string;
  selectedText?: string;
  projectContext?: string;
  glossary?: string;
  instructions?: string;
  appliedContext?: AppliedContext;
}) {
  return request<{ capture_id: string; raw_transcript: string; text: string; skill_id: string; skill_name: string; skill_revision: number; applied_context: AppliedContext }>("transcribe", {
    requestId: input.requestId,
    audioBase64: await blobToBase64(input.audio),
    mimeType: input.audio.type || "audio/webm",
    pageUrl: input.source.url ?? "",
    pageTitle: input.source.title ?? "",
    targetText: input.targetText ?? "",
    selectedText: input.selectedText ?? "",
    projectContext: input.projectContext ?? "",
    glossary: input.glossary ?? "",
    instructions: input.instructions ?? "",
    appliedContext: input.appliedContext,
  });
}

export async function queuePendingVoice(input: {
  id: string;
  audio?: Blob;
  tabId?: number;
  frameId?: number;
  pageUrl?: string;
  pageTitle?: string;
  plan?: PendingVoicePlan;
}) {
  return request<PendingVoiceSummary>("pending-voice-queue", {
    id: input.id,
    ...(input.audio ? {
      audioBase64: await blobToBase64(input.audio),
      mimeType: input.audio.type || "audio/webm",
    } : {}),
    tabId: input.tabId,
    frameId: input.frameId,
    pageUrl: input.pageUrl,
    pageTitle: input.pageTitle,
    plan: input.plan,
  });
}

export async function markPendingVoiceTranscribed(input: {
  id: string;
  captureId: string;
  rawTranscript: string;
  text: string;
  appliedContext?: AppliedContext;
}) {
  return request<PendingVoiceSummary>("pending-voice-mark-transcribed", {
    id: input.id,
    transcription: {
      captureId: input.captureId,
      rawTranscript: input.rawTranscript,
      text: input.text,
      appliedContext: input.appliedContext,
    },
  });
}

export async function completePendingVoice(id: string) {
  await request<null>("pending-voice-complete", { id });
}

export async function getPendingVoices() {
  const result = await request<{ items: PendingVoiceSummary[] }>("pending-voice-list");
  return result.items;
}

export async function getPendingVoiceQueueStatus() {
  return request<PendingVoiceQueueStatus>("pending-voice-status");
}

export async function retryPendingVoice(id: string) {
  return request<unknown>("pending-voice-retry", { id });
}

export async function exportPendingVoice(id: string) {
  return request<{ audioBase64: string; mimeType: string; pageTitle?: string; createdAt: number }>("pending-voice-export", { id });
}

export async function deletePendingVoice(id: string) {
  await request<null>("pending-voice-delete", { id });
}

export type { PendingVoicePlan, PendingVoiceQueueStatus, PendingVoiceSummary } from "./pendingVoice";

export async function saveMaterial(input: {
  requestId: string;
  kind: MaterialKind;
  content: string;
  annotation?: string;
  source: SourceInfo;
  projects?: string[];
  suggestedProjects?: string[];
  tags?: string[];
  captureId?: string;
  rawTranscript?: string;
  transcript?: string;
  appliedContext?: AppliedContext;
  actor?: string;
  parentIds?: string[];
  runId?: string;
  activityType?: "voice-command" | "text-command" | "ask" | "draft";
  commentState?: "unlinked";
}) {
  return request<{ id: string }>("save-material", {
    request_id: input.requestId,
    kind: input.kind,
    content: input.content,
    annotation: input.annotation,
    source: input.source,
    projects: input.projects ?? [],
    suggested_projects: input.suggestedProjects ?? [],
    tags: input.tags ?? [],
    capture_id: input.captureId,
    raw_transcript: input.rawTranscript,
    transcript: input.transcript,
    applied_context: input.appliedContext,
    actor: input.actor,
    parent_ids: input.parentIds ?? [],
    run_id: input.runId,
    activity_type: input.activityType,
    comment_state: input.commentState,
    membership_origin: input.projects?.length ? "auto_added" : undefined,
  });
}

export interface ExtensionDocument {
  id: string;
  title: string;
  content: string;
  project?: string;
  source_ids: string[];
  revision: number;
}

export async function createExtensionDocument(input: { title: string; content: string; project?: string; sourceIds?: string[] }) {
  return request<ExtensionDocument>("create-document", {
    title: input.title,
    content: input.content,
    project: input.project ?? "",
    source_ids: input.sourceIds ?? [],
  });
}

export async function saveExtensionSkillRunAsDocument(id: string, input: { title: string; content: string; documentId?: string; project?: string; sourceIds?: string[]; contextSourceIds?: string[]; expectedRevision?: number }) {
  return request<{ run: ExtensionSkillRun; document: ExtensionDocument }>("adopt-skill-run-document", {
    id,
    title: input.title,
    content: input.content,
    documentId: input.documentId,
    project: input.project,
    sourceIds: input.sourceIds,
    contextSourceIds: input.contextSourceIds,
    expectedRevision: input.expectedRevision,
  });
}

export interface VoiceMaterialResult {
  id: string;
  content: string;
  raw_transcript?: string;
  transcript?: string;
  transcript_revision?: number;
  applied_context?: AppliedContext;
}

export interface TranscriptRevisionResult {
  material_id: string;
  capture_id: string;
  revision: number;
  raw_transcript: string;
  transcript: string;
  applied_context: AppliedContext;
  created_at: string;
}

export type CorrectionScope = "only" | "topic" | "project" | "global";

export async function updateMaterial(id: string, changes: {
  content?: string;
  projects?: string[];
  excludedProjects?: string[];
  savedOnlyProjects?: string[];
  tags?: string[];
}) {
  return request<VoiceMaterialResult>("update-material", {
    id,
    changes: {
      ...(changes.content !== undefined ? { content: changes.content } : {}),
      ...(changes.projects !== undefined ? { projects: changes.projects } : {}),
      ...(changes.excludedProjects !== undefined ? { excluded_projects: changes.excludedProjects } : {}),
      ...(changes.savedOnlyProjects !== undefined ? { saved_only_projects: changes.savedOnlyProjects } : {}),
      ...(changes.tags !== undefined ? { tags: changes.tags } : {}),
    },
  });
}

export async function updateCommentBundle(id: string, changes: {
  content?: string;
  projects?: string[];
  excludedProjects?: string[];
  savedOnlyProjects?: string[];
  tags?: string[];
}) {
  return request<{ bundle_root_id: string; items: VoiceMaterialResult[] }>("update-comment-bundle", {
    id,
    changes: {
      ...(changes.content !== undefined ? { content: changes.content } : {}),
      ...(changes.projects !== undefined ? { projects: changes.projects } : {}),
      ...(changes.excludedProjects !== undefined ? { excluded_projects: changes.excludedProjects } : {}),
      ...(changes.savedOnlyProjects !== undefined ? { saved_only_projects: changes.savedOnlyProjects } : {}),
      ...(changes.tags !== undefined ? { tags: changes.tags } : {}),
    },
  });
}

export async function updateSourceAnchor(id: string, input: {
  action: "resolve" | "reanchor" | "snapshot_only";
  expectedRevision: number;
  status?: "anchored" | "page_changed";
  quote?: string;
  contextBefore?: string;
  contextAfter?: string;
}) {
  return request<VoiceMaterialResult>("update-source-anchor", {
    id,
    input: {
      action: input.action,
      expected_revision: input.expectedRevision,
      status: input.status,
      quote: input.quote,
      context_before: input.contextBefore,
      context_after: input.contextAfter,
    },
  });
}

export async function adoptVoiceMaterial(id: string, input: { adoptionId: string; content?: string; target?: { surface?: string; url?: string; target_key?: string }; undone?: boolean }) {
  return request<VoiceMaterialResult>("adopt-voice-material", { id, adoptionId: input.adoptionId, content: input.content, target: input.target, undone: input.undone });
}

export async function linkVoiceComment(id: string, input: { content: string; sourceContent: string; source: SourceInfo; projects?: string[]; tags?: string[] }) {
  return request<{ source: { id: string }; comment: VoiceMaterialResult }>("link-voice-comment", {
    id,
    ...input,
    membership_origin: input.projects?.length ? "auto_added" : undefined,
  });
}

export async function deleteMaterial(id: string) {
  await request<null>("delete-material", { id });
}

export async function retranscribeMaterial(id: string, options: {
  referenceProject?: string;
  profileOverrides?: VoiceProfileOverrides;
  correction?: { spoken: string; preferred: string; scope: CorrectionScope };
}) {
  const overrides = options.profileOverrides ?? {};
  return request<{ material: VoiceMaterialResult; revision: TranscriptRevisionResult }>("retranscribe-material", {
    id,
    options: {
      reference_project: options.referenceProject ?? "",
      profile_project: overrides.profile_project ?? "",
      use_default_profile: Boolean(overrides.use_default_profile),
      disable_project_profile: Boolean(overrides.disable_project_profile),
      primary_language: overrides.primary_language ?? "",
      topic_vocabulary_id: overrides.topic_vocabulary_id ?? "",
      correction: options.correction,
    },
  });
}

export async function cancelMaterialSave(requestId: string) {
  await request<null>("cancel-material-save", { requestId });
}

export async function saveSelection(input: {
  requestId: string;
  sourceContent: string;
  annotation?: string;
  rawTranscript?: string;
  transcript?: string;
  source: SourceInfo;
  projects?: string[];
  tags?: string[];
  captureId?: string;
  appliedContext?: AppliedContext;
}) {
  return request<{ source: { id: string }; annotation?: { id: string } }>("save-selection", {
    request_id: input.requestId,
    source_content: input.sourceContent,
    annotation: input.annotation,
    raw_transcript: input.rawTranscript,
    transcript: input.transcript,
    source: input.source,
    projects: input.projects ?? [],
    tags: input.tags ?? [],
    capture_id: input.captureId,
    applied_context: input.appliedContext,
    membership_origin: input.projects?.length ? "auto_added" : undefined,
  });
}

export async function deleteCapture(id: string) {
  await request<null>("delete-capture", { id });
}
