import type { MaterialKind, SourceInfo } from "@logue/ui";
import { createRequestId } from "./requestId";

const apiBase = "http://127.0.0.1:8787";

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
  return request<{ ok: boolean; ai_configured: boolean; model: string }>("status");
}

export interface ExtensionAgent {
  id: string;
  name: string;
  purpose: string;
  task: "transcribe" | "organize" | "generate";
  output: "insert" | "material" | "qa" | "document";
  surfaces: Array<"web" | "extension" | "background">;
  contexts: Array<"page" | "target" | "selection" | "project" | "materials" | "personal">;
  enabled: boolean;
}

export interface ExtensionSettings {
  default_extension_agent: string;
}

export interface ExtensionAgentRun {
  id: string;
  agent_id: string;
  agent_name: string;
  original_output?: string;
  adopted_output?: string;
  status: "running" | "complete" | "failed";
  error?: string;
  sources?: Array<{ id: string }>;
}

export async function getExtensionAgents() {
  const response = await request<{ agents: ExtensionAgent[] }>("agents");
  return response.agents.filter((agent) => agent.enabled && agent.task === "generate" && agent.surfaces.includes("extension"));
}

export async function getExtensionSettings() {
  return request<ExtensionSettings>("settings");
}

export async function createExtensionAgentRun(input: {
  agentId: string;
  instruction: string;
  project?: string;
  sourceIds?: string[];
  pageTitle?: string;
  pageUrl?: string;
  targetText?: string;
  selection?: string;
}) {
  return request<ExtensionAgentRun>("agent-run", {
    request_id: createRequestId(),
    agent_id: input.agentId,
    instruction: input.instruction,
    project: input.project,
    source_ids: input.sourceIds ?? [],
    page_title: input.pageTitle,
    page_url: input.pageUrl,
    target_text: input.targetText,
    selection: input.selection,
  });
}

export async function adoptExtensionAgentRun(id: string, adoptedOutput: string) {
  return request<ExtensionAgentRun>("adopt-agent-run", { id, adoptedOutput });
}

export interface CaptureContext {
  personal_context: string;
  personal_glossary: string[];
  recent_adopted: string[];
  recent_adopted_refs?: Array<{ id: string; text: string }>;
  suggested_project: string;
  projects: Array<{ name: string; overview?: string; glossary: string[] }>;
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
}

export async function getCaptureContext(pageUrl: string, project = "") {
  return request<CaptureContext>("context", { pageUrl, project });
}

export interface PageMaterial {
  id: string;
  content: string;
  annotation?: string;
  createdAt: string;
}

export async function getPageMaterials(pageUrl: string) {
  const query = new URLSearchParams({ source_url: pageUrl });
  const response = await fetch(`${apiBase}/v1/items?${query.toString()}`);
  if (!response.ok) {
    throw new Error((await response.text()) || `Request failed (${response.status})`);
  }
  const result = await response.json() as {
    items?: Array<{ id: string; content: string; annotation?: string; created_at: string }>;
  };
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
  return request<{ capture_id: string; text: string }>("transcribe", {
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
