import type {
  AppliedContext,
  Material,
  MaterialKind,
  MaterialStatus,
  SourceInfo,
} from "@logue/ui";
import { logueApiBase } from "./apiBase";

const apiBase = logueApiBase;

interface ApiMaterial {
  id: string;
  kind: MaterialKind;
  status: MaterialStatus;
  content: string;
  raw_transcript?: string;
  transcript?: string;
  annotation?: string;
  source?: SourceInfo;
  projects?: string[];
  excluded_projects?: string[];
  saved_only_projects?: string[];
  tags?: string[];
  parent_ids?: string[];
  capture_id?: string;
  transcript_revision?: number;
  revision?: number;
  created_at: string;
  actor?: string;
  activity_type?: Material["activityType"];
  adopted_revisions?: Material["adoptedRevisions"];
  applied_context?: AppliedContext;
  organization?: Material["organization"];
  tombstone?: boolean;
  deleted_at?: string;
}

export type MaterialSearchMatch =
  | {
      id: string;
      match: "content" | "annotation" | "source" | "tag" | "project";
      reason?: string;
    }
  | { id: string; match: "related"; reason: string };

export interface MaterialSearchResponse {
  matches: MaterialSearchMatch[];
  strategy: "semantic" | "local";
}

export interface MaterialDependencies {
  projects: string[];
  derived_items: Array<{
    id: string;
    content: string;
    kind: MaterialKind;
    actor: string;
    projects: string[];
  }>;
  documents: Array<{
    id: string;
    title: string;
    project: string;
    revision: number;
    current: boolean;
  }>;
  runs: Array<{
    id: string;
    skill_name: string;
    instruction: string;
    status: string;
    adopted: boolean;
  }>;
}

export type DeletionScope =
  | "source"
  | "project"
  | "document"
  | "document_revision"
  | "run"
  | "workspace";

export interface DeletionPreview {
  scope: DeletionScope;
  target_ids: string[];
  target_labels: string[];
  document_id?: string;
  document_revision?: number;
  summary: {
    sources: number;
    projects: number;
    documents: number;
    runs: number;
    recordings: number;
    revisions: number;
    derived: number;
    citations: number;
    skills: number;
  };
  requires_lineage: boolean;
  backup_created: boolean;
  fingerprint: string;
}

export interface DeletionRequest {
  scope: DeletionScope;
  ids?: string[];
  projectId?: string;
  documentId?: string;
  documentRevision?: number;
}

export interface DeletionResult {
  status: "deleted" | "tombstoned";
  scope: DeletionScope;
  target_ids: string[];
  tombstoned: boolean;
  backup?: BackupSnapshot;
}

export interface SourceRevision {
  material_id: string;
  revision: number;
  current: boolean;
  content: string;
  parent_ids?: string[];
  source?: SourceInfo;
  sources?: SkillRunSourceSnapshot[];
  created_at: string;
  updated_at?: string;
  archived_at?: string;
}

export type DocumentSearchMatch =
  | { id: string; match: "title" | "content" | "project"; reason?: string }
  | { id: string; match: "related"; reason: string };

export interface DocumentSearchResponse {
  matches: DocumentSearchMatch[];
  strategy: "semantic" | "local";
}

export interface ServiceStatus {
  ok: boolean;
  api_version: number;
  ai_configured: boolean;
  model: string;
  provider?: "gemini" | "openai-compatible";
  storage_root: string;
  version: string;
}

export interface LogueClient {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  last_seen_at: string;
  revoked: boolean;
}

export interface PairingCode {
  code: string;
  expires_at: string;
}

export interface AIConnection {
  provider: "gemini" | "openai-compatible";
  model: string;
  transcription_model: string;
  base_url: string;
  configured: boolean;
  has_api_key: boolean;
}

export interface AIConnectionInput {
  provider: AIConnection["provider"];
  model: string;
  transcription_model?: string;
  base_url?: string;
  api_key?: string;
  keep_api_key?: boolean;
}

export interface LogueDocument {
  id: string;
  title: string;
  content: string;
  project?: string;
  source_ids: string[];
  context_source_ids?: string[];
  sources?: SkillRunSourceSnapshot[];
  context_sources?: SkillRunSourceSnapshot[];
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentRevision extends LogueDocument {
  document_id: string;
  current: boolean;
  tombstone?: boolean;
  deleted_at?: string;
}

export interface ProjectSummary {
  id?: string;
  name: string;
  overview?: string;
  transcription_profile: ProjectVoiceProfile;
  skill_bindings?: ProjectSkillBindings;
  count: number;
  created_at?: string;
  updated_at?: string;
  archived_at?: string;
}

export interface ProjectDependencies {
  project: string;
  sources: number;
  documents: number;
  runs: number;
}

export interface ProjectSkillBindings {
  transcription?: string;
  organization?: string;
  command?: string;
  ask?: string;
  draft?: string;
}

export interface VoiceProfileVocabulary {
  people: string[];
  companies: string[];
  products: string[];
  places: string[];
  acronyms: string[];
  preferred_spellings: Array<{ spoken: string; preferred: string }>;
}

export interface VoiceProfile {
  primary_language: string;
  mixed_languages: string[];
  custom_instructions: string;
  phrases: string[];
  avoid_terms: string[];
  formatting_preference: string;
  vocabulary: VoiceProfileVocabulary;
}

export interface ProjectVoiceProfile extends VoiceProfile {
  mode: "inherited" | "customized" | "disabled";
}

export function createVoiceProfile(): VoiceProfile {
  return {
    primary_language: "Auto-detect",
    mixed_languages: [],
    custom_instructions: "",
    phrases: [],
    avoid_terms: [],
    formatting_preference: "",
    vocabulary: {
      people: [],
      companies: [],
      products: [],
      places: [],
      acronyms: [],
      preferred_spellings: [],
    },
  };
}

export function createProjectVoiceProfile(): ProjectVoiceProfile {
  return { ...createVoiceProfile(), primary_language: "", mode: "inherited" };
}

function normalizeVoiceProfile(value: Partial<VoiceProfile> | undefined): VoiceProfile {
  const fallback = createVoiceProfile();
  const vocabulary = value?.vocabulary;
  return {
    ...fallback,
    ...value,
    mixed_languages: Array.isArray(value?.mixed_languages) ? value.mixed_languages : [],
    phrases: Array.isArray(value?.phrases) ? value.phrases : [],
    avoid_terms: Array.isArray(value?.avoid_terms) ? value.avoid_terms : [],
    vocabulary: {
      people: Array.isArray(vocabulary?.people) ? vocabulary.people : [],
      companies: Array.isArray(vocabulary?.companies) ? vocabulary.companies : [],
      products: Array.isArray(vocabulary?.products) ? vocabulary.products : [],
      places: Array.isArray(vocabulary?.places) ? vocabulary.places : [],
      acronyms: Array.isArray(vocabulary?.acronyms) ? vocabulary.acronyms : [],
      preferred_spellings: Array.isArray(vocabulary?.preferred_spellings)
        ? vocabulary.preferred_spellings
        : [],
    },
  };
}

function normalizeProjectVoiceProfile(
  value: Partial<ProjectVoiceProfile> | undefined,
): ProjectVoiceProfile {
  return {
    ...normalizeVoiceProfile(value),
    primary_language: value?.primary_language ?? "",
    mode:
      value?.mode === "customized" || value?.mode === "disabled"
        ? value.mode
        : "inherited",
  };
}

function normalizeProjectSummary(project: ProjectSummary): ProjectSummary {
  return {
    ...project,
    transcription_profile: normalizeProjectVoiceProfile(
      project.transcription_profile,
    ),
    skill_bindings: project.skill_bindings ?? {},
  };
}

function normalizeWorkspaceSettings(
  settings: WorkspaceSettings,
): WorkspaceSettings {
  return {
    ...settings,
    personal_context: settings.personal_context ?? "",
    ignored_terms: Array.isArray(settings.ignored_terms)
      ? settings.ignored_terms
      : [],
    voice_profile: normalizeVoiceProfile(settings.voice_profile),
  };
}

export interface TopicVocabulary {
  id: string;
  name: string;
  vocabulary: VoiceProfileVocabulary;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredTopic {
  id: string;
  name: string;
  source_ids: string[];
  reason: string;
  automatic: boolean;
  hidden: boolean;
  converted_project?: string;
  vocabulary_id?: string;
  relationships: Array<{
    type: "duplicate" | "conflict" | "supplement";
    source_ids: string[];
    reason: string;
    confidence: "exact" | "suggested";
  }>;
  project_suggestions: Array<{
    project_id: string;
    project_name: string;
    source_ids: string[];
    reason: string;
  }>;
  vocabulary_suggestions: Array<{
    term: string;
    reason: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface TranscriptRevision {
  material_id: string;
  capture_id: string;
  revision: number;
  raw_transcript: string;
  transcript: string;
  applied_context: AppliedContext;
  created_at: string;
  current: boolean;
}

export interface SkillRunSourceSnapshot {
  id: string;
  content: string;
  kind?: MaterialKind;
  actor?: string;
  projects?: string[];
  tags?: string[];
  created_at?: string;
  source?: SourceInfo;
}

export interface SkillRun {
  id: string;
  skill_id: string;
  skill_revision: number;
  skill_name: string;
  instruction: string;
  project?: string;
  continue_run_id?: string;
  retry_run_id?: string;
  page_title?: string;
  page_url?: string;
  target_text?: string;
  selection?: string;
  output_type?: "insert" | "material" | "qa" | "document";
  pinned?: boolean;
  status: "running" | "complete" | "failed" | "cancelled" | "deleted";
  sources: SkillRunSourceSnapshot[];
  original_output?: string;
  adopted_output?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  document_id?: string;
  material_id?: string;
  activity_source_id?: string;
  model_context?: {
    instruction: string;
    selection: string;
    target_text: string;
    page_title: string;
    page_url: string;
    project: { name: string; overview: string };
    personal_context: string;
    skill: {
      id: string;
      name: string;
      revision: number;
      instructions: string;
    };
    sources: SkillRunSourceSnapshot[];
  };
  adoption?: "copy" | "insert" | "replace" | "keep" | "document";
  adoption_undone?: boolean;
  adoption_target?: { surface?: string; url?: string; target_key?: string };
  adoption_revisions?: Array<{
    id: string;
    revision: number;
    action: "copy" | "insert" | "replace" | "keep" | "document";
    content: string;
    material_id?: string;
    document_id?: string;
    document_revision?: number;
    target?: { surface?: string; url?: string; target_key?: string };
    undone?: boolean;
  }>;
  tombstone?: boolean;
}

export interface SkillRunDependencies {
  run: string;
  document_id: string;
  material_id: string;
  activity_source_id: string;
  adopted: boolean;
  frozen_sources: number;
  downstream_runs: number;
  requires_lineage: boolean;
}

export interface WorkspaceSettings {
  personal_context: string;
  ignored_terms: string[];
  voice_profile: VoiceProfile;
  default_transcription_skill?: string;
  default_organization_skill?: string;
  default_extension_skill?: string;
  default_qa_skill?: string;
  default_document_skill?: string;
}

export interface GlossarySuggestion {
  term: string;
  count: number;
}

export function fromApiMaterial(item: ApiMaterial): Material {
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    content: item.content,
    rawTranscript: item.raw_transcript,
    transcript: item.transcript,
    annotation: item.annotation,
    source: item.source,
    projects: item.projects ?? [],
    excludedProjects: item.excluded_projects ?? [],
    savedOnlyProjects: item.saved_only_projects ?? [],
    tags: item.tags ?? [],
    parentIds: item.parent_ids ?? [],
    captureId: item.capture_id,
    transcriptRevision: item.transcript_revision,
    revision: item.revision,
    createdAt: item.created_at,
    actor: item.actor,
    activityType: item.activity_type,
    adoptedRevisions: item.adopted_revisions,
    appliedContext: item.applied_context,
    organization: item.organization,
    tombstone: item.tombstone,
    deletedAt: item.deleted_at,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { error?: string };
      message = parsed.error || body;
    } catch {
      // Keep a plain-text server response as-is.
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function getStatus() {
  return parseResponse<ServiceStatus>(await fetch(`${apiBase}/v1/status`));
}

export async function getClients() {
  const result = await parseResponse<{ clients: LogueClient[] }>(
    await fetch(`${apiBase}/v1/clients`),
  );
  return result.clients;
}

export async function createPairingCode() {
  return parseResponse<PairingCode>(
    await fetch(`${apiBase}/v1/pairing-code`, { method: "POST" }),
  );
}

export async function updateClient(id: string, name: string) {
  return parseResponse<LogueClient>(
    await fetch(`${apiBase}/v1/clients/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

export async function revokeClient(id: string) {
  return parseResponse<LogueClient>(
    await fetch(`${apiBase}/v1/clients/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
}

export async function getAIConnection() {
  return parseResponse<AIConnection>(
    await fetch(`${apiBase}/v1/ai-connection`),
  );
}

export async function testAIConnection(input: AIConnectionInput) {
  return parseResponse<AIConnection & { ok: true }>(
    await fetch(`${apiBase}/v1/ai-connection/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function saveAIConnection(input: AIConnectionInput) {
  return parseResponse<AIConnection>(
    await fetch(`${apiBase}/v1/ai-connection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function getMaterials() {
  const result = await parseResponse<{ items: ApiMaterial[] }>(
    await fetch(`${apiBase}/v1/items`),
  );
  return result.items.map(fromApiMaterial);
}

export async function getTranscriptRevisions(id: string) {
  const result = await parseResponse<{ revisions: TranscriptRevision[] }>(
    await fetch(
      `${apiBase}/v1/items/${encodeURIComponent(id)}/transcript-revisions`,
    ),
  );
  return result.revisions;
}

export async function getMaterialRevisions(id: string) {
  const result = await parseResponse<{ revisions: SourceRevision[] }>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}/revisions`),
  );
  return result.revisions;
}

export async function restoreMaterialRevision(id: string, revision: number) {
  const result = await parseResponse<ApiMaterial>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
    }),
  );
  return fromApiMaterial(result);
}

export async function retranscribeMaterial(
  id: string,
  options: {
    referenceProject?: string;
    disableProjectProfile?: boolean;
    primaryLanguage?: string;
    topicVocabularyId?: string;
    correction?: {
      spoken: string;
      preferred: string;
      scope: "only" | "topic" | "project" | "global";
    };
  },
) {
  const result = await parseResponse<{
    material: ApiMaterial;
    revision: TranscriptRevision;
  }>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}/retranscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_project: options.referenceProject ?? "",
        disable_project_profile: Boolean(options.disableProjectProfile),
        primary_language: options.primaryLanguage ?? "",
        topic_vocabulary_id: options.topicVocabularyId ?? "",
        correction: options.correction,
      }),
    }),
  );
  return {
    material: fromApiMaterial(result.material),
    revision: result.revision,
  };
}

export async function searchMaterials(query: string, signal?: AbortSignal) {
  return parseResponse<MaterialSearchResponse>(
    await fetch(
      `${apiBase}/v1/material-search?query=${encodeURIComponent(query)}`,
      { signal },
    ),
  );
}

export async function createMaterial(input: {
  kind: MaterialKind;
  content: string;
  annotation?: string;
  projects?: string[];
  tags?: string[];
  parentIds?: string[];
  source?: SourceInfo;
  actor?: string;
  requestId?: string;
  activityType?: "voice-command" | "text-command" | "ask" | "compare" | "draft";
  runId?: string;
}) {
  const result = await parseResponse<ApiMaterial>(
    await fetch(`${apiBase}/v1/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: input.kind,
        content: input.content,
        annotation: input.annotation,
        projects: input.projects,
        tags: input.tags,
        parent_ids: input.parentIds,
        source: input.source,
        actor: input.actor,
        request_id: input.requestId,
        activity_type: input.activityType,
        run_id: input.runId,
      }),
    }),
  );
  return fromApiMaterial(result);
}

export async function getDocuments() {
  const result = await parseResponse<{ documents: LogueDocument[] }>(
    await fetch(`${apiBase}/v1/docs`),
  );
  return result.documents;
}

export async function getDocumentRevisions(id: string) {
  const result = await parseResponse<{ revisions: DocumentRevision[] }>(
    await fetch(`${apiBase}/v1/docs/${encodeURIComponent(id)}/revisions`),
  );
  return result.revisions;
}

export async function restoreDocumentRevision(id: string, revision: number) {
  return parseResponse<LogueDocument>(
    await fetch(`${apiBase}/v1/docs/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
    }),
  );
}

export async function searchDocuments(query: string, signal?: AbortSignal) {
  return parseResponse<DocumentSearchResponse>(
    await fetch(
      `${apiBase}/v1/document-search?query=${encodeURIComponent(query)}`,
      { signal },
    ),
  );
}

export async function createDocument(input: {
  title?: string;
  content?: string;
  project?: string;
  sourceIds?: string[];
}) {
  return parseResponse<LogueDocument>(
    await fetch(`${apiBase}/v1/docs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title ?? "Untitled",
        content: input.content ?? "",
        project: input.project ?? "",
        source_ids: input.sourceIds ?? [],
      }),
    }),
  );
}

export async function updateDocument(
  id: string,
  changes: {
    title?: string;
    content?: string;
    project?: string;
    sourceIds?: string[];
    contextSourceIds?: string[];
    expectedRevision?: number;
  },
) {
  return parseResponse<LogueDocument>(
    await fetch(`${apiBase}/v1/docs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.content !== undefined ? { content: changes.content } : {}),
        ...(changes.project !== undefined ? { project: changes.project } : {}),
        ...(changes.sourceIds !== undefined
          ? { source_ids: changes.sourceIds }
          : {}),
        ...(changes.contextSourceIds !== undefined
          ? { context_source_ids: changes.contextSourceIds }
          : {}),
        ...(changes.expectedRevision !== undefined
          ? { expected_revision: changes.expectedRevision }
          : {}),
      }),
    }),
  );
}

export async function deleteDocument(id: string) {
  const response = await fetch(`${apiBase}/v1/docs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok)
    throw new Error(
      (await response.text()) || `Request failed (${response.status})`,
    );
}

function deletionBody(request: DeletionRequest) {
  return {
    scope: request.scope,
    ids: request.ids ?? [],
    project_id: request.projectId ?? "",
    document_id: request.documentId ?? "",
    document_revision: request.documentRevision ?? 0,
  };
}

export async function getDeletionPreview(request: DeletionRequest) {
  return parseResponse<DeletionPreview>(
    await fetch(`${apiBase}/v1/deletions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deletionBody(request)),
    }),
  );
}

export async function executeDeletion(
  request: DeletionRequest,
  preview: DeletionPreview,
): Promise<{ result?: DeletionResult; preview?: DeletionPreview }> {
  const response = await fetch(`${apiBase}/v1/deletions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...deletionBody(request),
      fingerprint: preview.fingerprint,
    }),
  });
  if (response.status === 409) {
    const body = (await response.json()) as {
      error?: string;
      preview?: DeletionPreview;
    };
    if (body.preview) return { preview: body.preview };
    throw new Error(body.error || "Dependencies changed.");
  }
  return { result: await parseResponse<DeletionResult>(response) };
}

export async function getProjects() {
  const result = await parseResponse<{ projects: ProjectSummary[] }>(
    await fetch(`${apiBase}/v1/projects`),
  );
  return result.projects.map(normalizeProjectSummary);
}

export async function getProjectDependencies(name: string) {
  return parseResponse<ProjectDependencies>(
    await fetch(
      `${apiBase}/v1/projects/${encodeURIComponent(name)}/dependencies`,
    ),
  );
}

export async function deleteProject(name: string) {
  return parseResponse<ProjectDependencies>(
    await fetch(`${apiBase}/v1/projects/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  );
}

export async function getSkillRuns() {
  const result = await parseResponse<{ runs: SkillRun[] }>(
    await fetch(`${apiBase}/v1/skill-runs`),
  );
  return result.runs;
}

export async function retrySkillRun(run: SkillRun) {
  return parseResponse<SkillRun>(
    await fetch(`${apiBase}/v1/skill-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: globalThis.crypto?.randomUUID?.() ?? `retry-${Date.now()}`,
        skill_id: run.skill_id,
        instruction: run.instruction,
        project: run.project ?? "",
        source_ids: run.sources.map((source) => source.id),
        page_title: run.page_title ?? "",
        page_url: run.page_url ?? "",
        target_text: run.target_text ?? "",
        selection: run.selection ?? "",
        retry_run_id: run.id,
        auto_search: false,
      }),
    }),
  );
}

export async function setSkillRunPinned(id: string, pinned: boolean) {
  return parseResponse<SkillRun>(
    await fetch(`${apiBase}/v1/skill-runs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    }),
  );
}

export async function getSkillRunDependencies(id: string) {
  return parseResponse<SkillRunDependencies>(
    await fetch(
      `${apiBase}/v1/skill-runs/${encodeURIComponent(id)}/dependencies`,
    ),
  );
}

export async function deleteSkillRun(id: string, preserveLineage = false) {
  const suffix = preserveLineage ? "?preserve_lineage=true" : "";
  const response = await fetch(
    `${apiBase}/v1/skill-runs/${encodeURIComponent(id)}${suffix}`,
    { method: "DELETE" },
  );
  if (!response.ok)
    throw new Error(
      (await response.text()) || `Request failed (${response.status})`,
    );
}

export async function saveProject(
  currentName: string,
  input: {
    name?: string;
    overview: string;
    transcriptionProfile: ProjectVoiceProfile;
    skillBindings?: ProjectSkillBindings;
    archived?: boolean;
  },
) {
  const path = currentName
    ? `${apiBase}/v1/projects/${encodeURIComponent(currentName)}`
    : `${apiBase}/v1/projects`;
  return normalizeProjectSummary(await parseResponse<ProjectSummary>(
    await fetch(path, {
      method: currentName ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        overview: input.overview,
        transcription_profile: input.transcriptionProfile,
        ...(input.skillBindings !== undefined
          ? { skill_bindings: input.skillBindings }
          : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
      }),
    }),
  ));
}

export async function updateMaterialMetadata(
  id: string,
  projects: string[],
  tags: string[],
) {
  return updateMaterial(id, { projects, tags });
}

export async function updateMaterial(
  id: string,
  changes: {
    content?: string;
    projects?: string[];
    excludedProjects?: string[];
    savedOnlyProjects?: string[];
    tags?: string[];
  },
) {
  const result = await parseResponse<ApiMaterial>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(changes.content !== undefined ? { content: changes.content } : {}),
        ...(changes.projects !== undefined
          ? { projects: changes.projects }
          : {}),
        ...(changes.excludedProjects !== undefined
          ? { excluded_projects: changes.excludedProjects }
          : {}),
        ...(changes.savedOnlyProjects !== undefined
          ? { saved_only_projects: changes.savedOnlyProjects }
          : {}),
        ...(changes.tags !== undefined ? { tags: changes.tags } : {}),
      }),
    }),
  );
  return fromApiMaterial(result);
}

export async function updateMaterialMembership(
  id: string,
  input: {
    action: "add" | "remove" | "exclude" | "undo" | "change";
    project: string;
    targetProject?: string;
  },
) {
  const result = await parseResponse<{ bundle_root_id: string; items: ApiMaterial[] }>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}/membership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: input.action,
        project: input.project,
        target_project: input.targetProject,
      }),
    }),
  );
  return {
    bundleRootId: result.bundle_root_id,
    items: result.items.map(fromApiMaterial),
  };
}

export async function forgetClassificationMemory(bundleRootId: string) {
  return parseResponse<{ bundle_root_id: string; source_ids: string[] }>(
    await fetch(
      `${apiBase}/v1/classification-memories/${encodeURIComponent(bundleRootId)}`,
      { method: "DELETE" },
    ),
  );
}

export async function deleteMaterial(
  id: string,
  options?: { preserveLineage?: boolean },
) {
  const suffix = options?.preserveLineage ? "?preserve_lineage=true" : "";
  const response = await fetch(
    `${apiBase}/v1/items/${encodeURIComponent(id)}${suffix}`,
    { method: "DELETE" },
  );
  if (!response.ok)
    throw new Error(
      (await response.text()) || `Request failed (${response.status})`,
    );
}

export async function getMaterialDependencies(id: string) {
  return parseResponse<MaterialDependencies>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}/dependencies`),
  );
}

export async function getWorkspaceSettings() {
  const settings = await parseResponse<WorkspaceSettings>(
    await fetch(`${apiBase}/v1/settings`),
  );
  return normalizeWorkspaceSettings(settings);
}

export async function getTopicVocabularies() {
  const result = await parseResponse<{ topic_vocabularies: TopicVocabulary[] }>(
    await fetch(`${apiBase}/v1/topic-vocabularies`),
  );
  return result.topic_vocabularies;
}

export async function saveTopicVocabulary(
  id: string | undefined,
  value: { name: string; vocabulary: VoiceProfileVocabulary },
) {
  return parseResponse<TopicVocabulary>(
    await fetch(
      `${apiBase}/v1/topic-vocabularies${id ? `/${encodeURIComponent(id)}` : ""}`,
      {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      },
    ),
  );
}

export async function deleteTopicVocabulary(id: string) {
  const response = await fetch(
    `${apiBase}/v1/topic-vocabularies/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok)
    throw new Error(
      (await response.text()) || `Request failed (${response.status})`,
    );
}

export async function getTopics() {
  const result = await parseResponse<{ topics: DiscoveredTopic[] }>(
    await fetch(`${apiBase}/v1/topics`),
  );
  return result.topics;
}

export async function updateTopic(
  id: string,
  changes: { name?: string; hidden?: boolean; sourceIds?: string[] },
) {
  return parseResponse<DiscoveredTopic>(
    await fetch(`${apiBase}/v1/topics/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.hidden !== undefined ? { hidden: changes.hidden } : {}),
        ...(changes.sourceIds !== undefined
          ? { source_ids: changes.sourceIds }
          : {}),
      }),
    }),
  );
}

export async function mergeTopics(topicIds: string[], name: string) {
  return parseResponse<DiscoveredTopic>(
    await fetch(`${apiBase}/v1/topics/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_ids: topicIds, name }),
    }),
  );
}

export async function splitTopic(
  id: string,
  sourceIds: string[],
  name: string,
) {
  return parseResponse<DiscoveredTopic>(
    await fetch(`${apiBase}/v1/topics/${encodeURIComponent(id)}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_ids: sourceIds, name }),
    }),
  );
}

export async function convertTopicToProject(id: string, name: string) {
  return parseResponse<ProjectSummary>(
    await fetch(`${apiBase}/v1/topics/${encodeURIComponent(id)}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

export async function addTopicSourcesToProject(id: string, projectId: string) {
  return parseResponse<DiscoveredTopic>(
    await fetch(`${apiBase}/v1/topics/${encodeURIComponent(id)}/add-to-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    }),
  );
}

export async function rememberTopicVocabularySuggestion(
  id: string,
  input: {
    term: string;
    destination: "topic" | "project" | "global";
    projectId?: string;
  },
) {
  return parseResponse<DiscoveredTopic>(
    await fetch(
      `${apiBase}/v1/topics/${encodeURIComponent(id)}/remember-vocabulary`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: input.term,
          destination: input.destination,
          project_id: input.projectId ?? "",
        }),
      },
    ),
  );
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings) {
  return normalizeWorkspaceSettings(await parseResponse<WorkspaceSettings>(
    await fetch(`${apiBase}/v1/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  ));
}

export async function getGlossarySuggestions() {
  const result = await parseResponse<{ suggestions: GlossarySuggestion[] }>(
    await fetch(`${apiBase}/v1/glossary-suggestions`),
  );
  return result.suggestions;
}

export type ExportScope = "all" | "library" | "project";

export interface ExportOptions {
  scope: ExportScope;
  projectId?: string;
  includeAudio?: boolean;
  includeActivity?: boolean;
}

export interface ExportPreview {
  scope: ExportScope;
  project_id: string;
  project_name: string;
  include_audio: boolean;
  include_activity: boolean;
  fingerprint: string;
  estimated_bytes: number;
  sources: number;
  activity: number;
  documents: number;
  projects: number;
  runs: number;
  settings: number;
  skills: number;
  topic_vocabularies: number;
  topics: number;
  recordings: number;
  lineage_tombstones: number;
  restorable: false;
  credentials_included: false;
}

export interface BackupSnapshot {
  id: string;
  created_at: string;
  source_host: string;
  logue_version: string;
  imported_at: string;
  size_bytes: number;
}

function exportQuery(options: ExportOptions, fingerprint?: string) {
  const query = new URLSearchParams();
  query.set("scope", options.scope);
  if (options.projectId) query.set("project_id", options.projectId);
  query.set(
    "include_audio",
    options.includeAudio === false ? "false" : "true",
  );
  query.set("include_activity", options.includeActivity ? "true" : "false");
  if (fingerprint) query.set("fingerprint", fingerprint);
  return query.toString();
}

export async function getExportPreview(options: ExportOptions) {
  return parseResponse<ExportPreview>(
    await fetch(`${apiBase}/v1/export-preview?${exportQuery(options)}`),
  );
}

export async function downloadWorkspaceExport(
  options: ExportOptions,
  preview: ExportPreview,
) {
  const response = await fetch(
    `${apiBase}/v1/export?${exportQuery(options, preview.fingerprint)}`,
  );
  if (response.status === 409) {
    const body = (await response.json()) as {
      error?: string;
      preview?: ExportPreview;
    };
    if (body.preview) return body.preview;
    throw new Error(body.error || "Selected data changed.");
  }
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      message = (JSON.parse(body) as { error?: string }).error || body;
    } catch {
      // Keep a plain-text server response as-is.
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  const href = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  const label =
    options.scope === "project"
      ? preview.project_name
      : options.scope === "library"
        ? "library"
        : "all-saved-data";
  anchor.href = href;
  anchor.download = `logue-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  return undefined;
}

export function captureAudioURL(captureId: string) {
  return `${apiBase}/v1/captures/${encodeURIComponent(captureId)}`;
}

export async function getWorkspaceBackups() {
  const result = await parseResponse<{ backups: BackupSnapshot[] }>(
    await fetch(`${apiBase}/v1/backups`),
  );
  return result.backups;
}

export async function downloadWorkspaceBackup(snapshot: BackupSnapshot) {
  const response = await fetch(
    `${apiBase}/v1/backups/${encodeURIComponent(snapshot.id)}/download`,
  );
  if (!response.ok) {
    const body = await response.text();
    try {
      throw new Error((JSON.parse(body) as { error?: string }).error || body);
    } catch (cause) {
      if (cause instanceof SyntaxError) throw new Error(body || "Backup download failed.");
      throw cause;
    }
  }
  const href = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `logue-backup-${snapshot.created_at.slice(0, 10)}-${snapshot.id.slice(-6)}.logue-backup`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
}

export async function importWorkspaceBackup(file: File) {
  return parseResponse<{ status: string; backup: BackupSnapshot }>(
    await fetch(`${apiBase}/v1/backups/import`, {
      method: "POST",
      headers: { "Content-Type": "application/vnd.logue.backup+zip" },
      body: file,
    }),
  );
}

export async function restoreWorkspace(snapshotId: string) {
  return parseResponse<{
    status: string;
    restored_backup_id: string;
    previous_backup: BackupSnapshot;
  }>(
    await fetch(`${apiBase}/v1/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot_id: snapshotId, confirm: "RESTORE" }),
    }),
  );
}

export async function backupWorkspace() {
  return parseResponse<{ status: string; backup: BackupSnapshot }>(
    await fetch(`${apiBase}/v1/backup`, { method: "POST" }),
  );
}

export async function deleteWorkspace() {
  return parseResponse<{ status: string; backup: BackupSnapshot }>(
    await fetch(`${apiBase}/v1/workspace`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    }),
  );
}
