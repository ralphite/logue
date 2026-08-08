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
  created_at: string;
  source?: { url?: string; title?: string; domain?: string };
}

export class HostError extends Error {
  constructor(
    message: string,
    readonly status: number,
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
    const message =
      payload && typeof payload === "object" && "error" in payload ? String(payload.error) : `HTTP ${reply.status}`;
    throw new HostError(message, reply.status);
  }
  // The single trust boundary: the Host is ours and its route table is the contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return payload as T;
}

const post = <T,>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export const host = {
  context: (project = "") => call<Context>(`/v1/context?project=${encodeURIComponent(project)}`),

  transcribe: (body: { audio: string; media_type: string; project?: string; overrides?: unknown }) =>
    post<{ capture_id: string; text: string }>("/v1/transcribe", body),

  saveVoice: (body: { capture_id: string; text: string; source?: unknown; project?: string; parent_ids?: string[] }) =>
    post<{ material: Material }>("/v1/voice-materials", body),

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

  pageMaterials: (url: string) =>
    call<{ materials: Material[] }>(`/v1/materials?${new URLSearchParams({ q: url })}`),
};
