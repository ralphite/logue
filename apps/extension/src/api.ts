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

export type { ExtensionSkill, PageMaterial } from "./sidePanelModels";

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

export async function connectServer(value: string) {
  const normalized = normalizeServerURL(value);
  await requestServerPermission(normalized);
  let status: LogueServerStatus;
  try {
    status = await request<LogueServerStatus>("test-server", { serverURL: normalized });
    assertLogueServerStatus(status);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause ?? "");
    const previous = await getServerURL();
    if (previous !== normalized) await removeServerPermission(normalized);
    if (/failed to fetch|network|timed out|connection|name not resolved/i.test(message)) {
      throw new Error("Can’t reach this address.");
    }
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

export interface ExtensionProjectSkillBindings {
  transcription?: string;
  organization?: string;
  command?: string;
  ask?: string;
  draft?: string;
}

export interface ExtensionSkillRun {
  id: string;
  skill_id: string;
  skill_name: string;
  original_output?: string;
  adopted_output?: string;
  status: "running" | "complete" | "failed";
  error?: string;
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
  });
}

export async function adoptExtensionSkillRun(id: string, adoptedOutput: string) {
  return request<ExtensionSkillRun>("adopt-skill-run", { id, adoptedOutput });
}

export interface CaptureContext {
  personal_context: string;
  voice_profile: VoiceProfile;
  resolved_voice_profile: ResolvedVoiceProfile;
  recent_adopted: string[];
  recent_adopted_refs?: Array<{ id: string; text: string }>;
  suggested_project: string;
  projects: Array<{ name: string; overview?: string; transcription_profile: ProjectVoiceProfile; skill_bindings?: ExtensionProjectSkillBindings }>;
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

export interface ResolvedVoiceProfile {
  label: string;
  project_mode: "default" | "inherited" | "customized" | "disabled";
  project_name: string;
  primary_language: string;
  mixed_languages: string[];
  custom_instructions: string;
  vocabulary: string[];
  skill_id: string;
  personal_context: string;
  project_overview: string;
}

export interface AppliedContext {
  page_url: string;
  page_title: string;
  reference_project?: string;
  personal_context?: string;
  project_overview?: string;
  glossary?: string[];
  recent_adopted_ids?: string[];
  recent_adopted_texts?: string[];
  transcription_skill_id?: string;
  transcription_skill_name?: string;
  transcription_skill_revision?: number;
  voice_profile_label?: string;
  project_profile_mode?: string;
  primary_language?: string;
  mixed_languages?: string[];
  custom_instructions?: string;
}

export async function getCaptureContext(pageUrl: string, project = "") {
  return request<CaptureContext>("context", { pageUrl, project });
}

export async function getPageMaterials(pageUrl: string) {
  const result = await request<{
    items?: Array<{ id: string; content: string; annotation?: string; created_at: string }>;
  }>("page-materials", { pageUrl });
  return (result.items ?? [])
    .map((item): PageMaterial => ({
      id: item.id,
      content: item.content,
      annotation: item.annotation,
      createdAt: item.created_at,
    }))
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
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
  return request<{ capture_id: string; text: string; skill_id: string; skill_name: string; skill_revision: number; applied_context: AppliedContext }>("transcribe", {
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
  transcript?: string;
  appliedContext?: AppliedContext;
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
    transcript: input.transcript,
    applied_context: input.appliedContext,
  });
}

export async function cancelMaterialSave(requestId: string) {
  await request<null>("cancel-material-save", { requestId });
}

export async function saveSelection(input: {
  requestId: string;
  sourceContent: string;
  annotation?: string;
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
    transcript: input.transcript,
    source: input.source,
    projects: input.projects ?? [],
    tags: input.tags ?? [],
    capture_id: input.captureId,
    applied_context: input.appliedContext,
  });
}

export async function deleteCapture(id: string) {
  await request<null>("delete-capture", { id });
}
