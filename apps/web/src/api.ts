import type { AppliedContext, Material, MaterialKind, MaterialStatus, SourceInfo } from "@logue/ui";
import { logueApiBase } from "./apiBase";

const apiBase = logueApiBase;

interface ApiMaterial {
  id: string;
  kind: MaterialKind;
  status: MaterialStatus;
  content: string;
  transcript?: string;
  annotation?: string;
  source?: SourceInfo;
  projects?: string[];
  excluded_projects?: string[];
  saved_only_projects?: string[];
  tags?: string[];
  parent_ids?: string[];
  capture_id?: string;
  created_at: string;
  actor?: string;
  applied_context?: AppliedContext;
  organization?: Material["organization"];
}

export type MaterialSearchMatch =
  | { id: string; match: "content" | "annotation" | "source" | "tag" | "project"; reason?: string }
  | { id: string; match: "related"; reason: string };

export interface MaterialSearchResponse {
  matches: MaterialSearchMatch[];
  strategy: "semantic" | "local";
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
  storage_root: string;
  version: string;
}

export interface LogueDocument {
  id: string;
  title: string;
  content: string;
  project?: string;
  source_ids: string[];
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentRevision extends LogueDocument {
  document_id: string;
  current: boolean;
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
    vocabulary: { people: [], companies: [], products: [], places: [], acronyms: [], preferred_spellings: [] },
  };
}

export function createProjectVoiceProfile(): ProjectVoiceProfile {
  return { ...createVoiceProfile(), mode: "inherited" };
}

export interface TopicVocabulary {
  id: string;
  name: string;
  vocabulary: VoiceProfileVocabulary;
  created_at: string;
  updated_at: string;
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
  status: "running" | "complete" | "failed" | "cancelled";
  sources: SkillRunSourceSnapshot[];
  original_output?: string;
  adopted_output?: string;
  error?: string;
  created_at: string;
  updated_at: string;
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
    transcript: item.transcript,
    annotation: item.annotation,
    source: item.source,
    projects: item.projects ?? [],
    excludedProjects: item.excluded_projects ?? [],
    savedOnlyProjects: item.saved_only_projects ?? [],
    tags: item.tags ?? [],
    parentIds: item.parent_ids ?? [],
    captureId: item.capture_id,
    createdAt: item.created_at,
    actor: item.actor,
    appliedContext: item.applied_context,
    organization: item.organization,
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

export async function getMaterials() {
  const result = await parseResponse<{ items: ApiMaterial[] }>(await fetch(`${apiBase}/v1/items`));
  return result.items.map(fromApiMaterial);
}

export async function searchMaterials(query: string, signal?: AbortSignal) {
  return parseResponse<MaterialSearchResponse>(
    await fetch(`${apiBase}/v1/material-search?query=${encodeURIComponent(query)}`, { signal }),
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
      }),
    }),
  );
  return fromApiMaterial(result);
}

export async function getDocuments() {
  const result = await parseResponse<{ documents: LogueDocument[] }>(await fetch(`${apiBase}/v1/docs`));
  return result.documents;
}

export async function getDocumentRevisions(id: string) {
  const result = await parseResponse<{ revisions: DocumentRevision[] }>(
    await fetch(`${apiBase}/v1/docs/${encodeURIComponent(id)}/revisions`),
  );
  return result.revisions;
}

export async function searchDocuments(query: string, signal?: AbortSignal) {
  return parseResponse<DocumentSearchResponse>(
    await fetch(`${apiBase}/v1/document-search?query=${encodeURIComponent(query)}`, { signal }),
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
  changes: { title?: string; content?: string; project?: string; sourceIds?: string[]; expectedRevision?: number },
) {
  return parseResponse<LogueDocument>(
    await fetch(`${apiBase}/v1/docs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.content !== undefined ? { content: changes.content } : {}),
        ...(changes.project !== undefined ? { project: changes.project } : {}),
        ...(changes.sourceIds !== undefined ? { source_ids: changes.sourceIds } : {}),
        ...(changes.expectedRevision !== undefined ? { expected_revision: changes.expectedRevision } : {}),
      }),
    }),
  );
}

export async function deleteDocument(id: string) {
  const response = await fetch(`${apiBase}/v1/docs/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
}

export async function generateDocument(input: {
  title?: string;
  project?: string;
  sourceIds: string[];
  instruction?: string;
}) {
  return parseResponse<LogueDocument>(
    await fetch(`${apiBase}/v1/docs/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title ?? "",
        project: input.project ?? "",
        source_ids: input.sourceIds,
        instruction: input.instruction ?? "",
      }),
    }),
  );
}

export async function getProjects() {
  const result = await parseResponse<{ projects: ProjectSummary[] }>(await fetch(`${apiBase}/v1/projects`));
  return result.projects;
}

export async function getSkillRuns() {
  const result = await parseResponse<{ runs: SkillRun[] }>(await fetch(`${apiBase}/v1/skill-runs`));
  return result.runs;
}

export async function retrySkillRun(run: SkillRun) {
  return parseResponse<SkillRun>(await fetch(`${apiBase}/v1/skill-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request_id: globalThis.crypto?.randomUUID?.() ?? `retry-${Date.now()}`,
      skill_id: run.skill_id,
      instruction: run.instruction,
      project: run.project ?? "",
      source_ids: run.sources.map((source) => source.id),
    }),
  }));
}

export async function deleteSkillRun(id: string) {
  const response = await fetch(`${apiBase}/v1/skill-runs/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
}

export async function saveProject(
  currentName: string,
  input: { name?: string; overview: string; transcriptionProfile: ProjectVoiceProfile; skillBindings?: ProjectSkillBindings },
) {
  const path = currentName ? `${apiBase}/v1/projects/${encodeURIComponent(currentName)}` : `${apiBase}/v1/projects`;
  return parseResponse<ProjectSummary>(
    await fetch(path, {
      method: currentName ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        overview: input.overview,
        transcription_profile: input.transcriptionProfile,
        ...(input.skillBindings !== undefined ? { skill_bindings: input.skillBindings } : {}),
      }),
    }),
  );
}

export async function generateProjectOverviewDraft(project: string) {
  return parseResponse<{ draft: string; source_ids: string[] }>(
    await fetch(`${apiBase}/v1/project-overview-drafts/${encodeURIComponent(project)}`, { method: "POST" }),
  );
}

export async function updateMaterialMetadata(id: string, projects: string[], tags: string[]) {
	return updateMaterial(id, { projects, tags });
}

export async function updateMaterial(
  id: string,
  changes: { content?: string; projects?: string[]; excludedProjects?: string[]; savedOnlyProjects?: string[]; tags?: string[] },
) {
  const result = await parseResponse<ApiMaterial>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(changes.content !== undefined ? { content: changes.content } : {}),
        ...(changes.projects !== undefined ? { projects: changes.projects } : {}),
        ...(changes.excludedProjects !== undefined ? { excluded_projects: changes.excludedProjects } : {}),
        ...(changes.savedOnlyProjects !== undefined ? { saved_only_projects: changes.savedOnlyProjects } : {}),
        ...(changes.tags !== undefined ? { tags: changes.tags } : {}),
      }),
    }),
  );
  return fromApiMaterial(result);
}

export async function deleteMaterial(id: string) {
  const response = await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
}

export async function getWorkspaceSettings() {
  return parseResponse<WorkspaceSettings>(await fetch(`${apiBase}/v1/settings`));
}

export async function getTopicVocabularies() {
  const result = await parseResponse<{ topic_vocabularies: TopicVocabulary[] }>(await fetch(`${apiBase}/v1/topic-vocabularies`));
  return result.topic_vocabularies;
}

export async function saveTopicVocabulary(id: string | undefined, value: { name: string; vocabulary: VoiceProfileVocabulary }) {
  return parseResponse<TopicVocabulary>(await fetch(`${apiBase}/v1/topic-vocabularies${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  }));
}

export async function deleteTopicVocabulary(id: string) {
  const response = await fetch(`${apiBase}/v1/topic-vocabularies/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings) {
  return parseResponse<WorkspaceSettings>(
    await fetch(`${apiBase}/v1/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  );
}

export async function getGlossarySuggestions() {
  const result = await parseResponse<{ suggestions: GlossarySuggestion[] }>(await fetch(`${apiBase}/v1/glossary-suggestions`));
  return result.suggestions;
}

export function exportWorkspaceURL() {
  return `${apiBase}/v1/export`;
}

export function captureAudioURL(captureId: string) {
  return `${apiBase}/v1/captures/${encodeURIComponent(captureId)}`;
}

export async function restoreWorkspace(value: unknown) {
  return parseResponse<{ status: string; backup_path: string }>(
    await fetch(`${apiBase}/v1/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    }),
  );
}

export async function backupWorkspace() {
  return parseResponse<{ status: string; backup_path: string }>(
    await fetch(`${apiBase}/v1/backup`, { method: "POST" }),
  );
}

export async function deleteWorkspace() {
  return parseResponse<{ status: string; backup_path: string }>(
    await fetch(`${apiBase}/v1/workspace`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    }),
  );
}
