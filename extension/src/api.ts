/** The Host, as the extension needs it. */

import { send, type HostReply } from "./messages";

export const HOST = "http://127.0.0.1:8787";

export interface Skill {
  id: string;
  name: string;
  output: string;
  contexts: string[];
  enabled: boolean;
  built_in_key?: string;
}

export interface Context {
  voice_profile: { label: string; project_name: string; primary_language: string };
  projects: { id: string; name: string }[];
  vocabularies: { id: string; name: string }[];
  skills: Skill[];
  /** The Skill each surface reaches for first, chosen once in Settings. */
  defaults?: { qa?: string; document?: string; extension?: string; transcription?: string };
}

export interface Material {
  id: string;
  kind: string;
  content: string;
  projects: string[];
  tags?: string[];
  /** Present on a voice Source: the recording it was transcribed from. */
  capture_id?: string;
  created_at: string;
  source?: { url?: string; title?: string; domain?: string };
}

export interface ProjectDetail {
  id: string;
  name: string;
  overview?: string;
  /** Terms live under `vocabulary`, which is what the Host reads when transcribing. */
  transcription_profile?: { mode?: string; vocabulary?: { terms?: string[] } };
}

export class HostError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /**
     * What the failure kept, if it kept anything.
     *
     * A transcription that fails has already written the audio to disk, and
     * without the id that comes back here the recording is saved and
     * unreachable — which is the same as lost, to the person who spoke it.
     */
    readonly captureId?: string,
  ) {
    super(message);
  }
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Relayed through the service worker rather than fetched here.
 *
 * A content script's request carries the page's origin, so a direct call would
 * only work if the Host allowed every origin on the web — and then so would
 * every other page you have open. The worker calls under the extension's own
 * origin, which the Host can recognise.
 */
async function call<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
  const reply = await send<HostReply>({ type: "logue:host", path, method: init?.method, body: init?.body });
  if (!reply) throw new HostError("Logue's background service is restarting. Try again in a moment.", 0);
  if (!reply.ok) throw new HostError(reply.message, 0);
  const payload = parse(reply.text);
  if (reply.status >= 400) {
    const body = payload && typeof payload === "object" ? payload : {};
    const message = "error" in body ? String(body.error) : `HTTP ${reply.status}`;
    // The id of what the failure kept, when it kept something.
    const kept = "capture_id" in body && typeof body.capture_id === "string" ? body.capture_id : undefined;
    throw new HostError(message, reply.status, kept);
  }
  // The single trust boundary: the Host is ours and its route table is the contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return payload as T;
}

const post = <T,>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export const host = {
  context: (project = "") => call<Context>(`/v1/context?project=${encodeURIComponent(project)}`),

  transcribe: (body: {
    audio: string;
    media_type: string;
    project?: string;
    overrides?: unknown;
    /** The text around the caret, so names are spelled the way the page spells them. */
    nearby?: string;
  }) => post<{ capture_id: string; text: string; applied_context?: unknown }>("/v1/transcribe", body),

  /** Try again on a recording the Host already has — the way back from a failed model call. */
  transcribeKept: (
    captureId: string,
    body: { project?: string; overrides?: unknown; nearby?: string },
  ) =>
    post<{ capture_id: string; text: string; applied_context?: unknown }>(
      `/v1/captures/${captureId}/transcribe`,
      body,
    ),

  saveVoice: (body: {
    capture_id: string;
    text: string;
    source?: unknown;
    project?: string;
    parent_ids?: string[];
    /** What shaped the transcript, frozen alongside it. */
    applied_context?: unknown;
  }) => post<{ material: Material }>("/v1/voice-materials", body),

  saveMaterial: (body: {
    kind: string;
    content: string;
    context?: string;
    source?: unknown;
    projects?: string[];
    parent_ids?: string[];
  }) => post<{ material: Material }>("/v1/materials", body),

  run: (body: { skill_id: string; instruction: string; project?: string; source_ids?: string[] }) =>
    post<{ run: { id: string; original_output?: string; status: string; error?: string }; sources: Material[] }>(
      "/v1/runs",
      body,
    ),

  /** What the person did with an answer. Silence here reads as "never used". */
  adopt: (runId: string, text: string, action: "insert" | "copy") =>
    post<{ run: unknown }>(`/v1/runs/${runId}/adopt`, { text, action }),

  /** Everything the Side Panel needs beyond capture and asking. */
  status: () => call<{ model: { generation_ready: boolean; voice_ready: boolean; model: string } }>("/v1/status"),
  documents: () => call<{ documents: { id: string; title: string; updated_at: string }[] }>("/v1/documents"),
  appendToDocument: (id: string, text: string, sourceIds: string[]) =>
    post<{ document: { id: string } }>(`/v1/documents/${id}/append`, { text, source_ids: sourceIds }),
  project: (id: string) => call<{ project: ProjectDetail }>(`/v1/projects/${id}`),
  updateProject: (
    id: string,
    changes: { overview?: string; transcription_profile?: { mode: string; vocabulary: { terms: string[] } } },
  ) =>
    call<{ project: ProjectDetail }>(`/v1/projects/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  tagMaterial: (id: string, tags: string[]) =>
    call<{ material: Material }>(`/v1/materials/${id}`, { method: "PATCH", body: JSON.stringify({ tags }) }),
  setMembership: (materialId: string, project: string, member: boolean) =>
    post<{ material: Material }>("/v1/project-membership", { material_id: materialId, project, member }),
  audioUrl: (captureId: string) => `${HOST}/v1/captures/${captureId}/audio`,

  pageMaterials: (url: string) =>
    call<{ materials: Material[] }>(`/v1/materials?${new URLSearchParams({ q: url })}`),
};
