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

export interface ProjectSummary {
  id?: string;
  name: string;
  overview?: string;
  glossary: string[];
  count: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkspaceSettings {
  personal_context: string;
  glossary: string[];
  ignored_terms: string[];
  default_transcription_skill?: string;
  default_organization_skill?: string;
  default_extension_skill?: string;
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

export async function saveProject(
  currentName: string,
  input: { name?: string; overview: string; glossary: string[] },
) {
  const path = currentName ? `${apiBase}/v1/projects/${encodeURIComponent(currentName)}` : `${apiBase}/v1/projects`;
  return parseResponse<ProjectSummary>(
    await fetch(path, {
      method: currentName ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
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
  changes: { content?: string; projects?: string[]; tags?: string[] },
) {
  const result = await parseResponse<ApiMaterial>(
    await fetch(`${apiBase}/v1/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(changes.content !== undefined ? { content: changes.content } : {}),
        ...(changes.projects !== undefined ? { projects: changes.projects } : {}),
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
