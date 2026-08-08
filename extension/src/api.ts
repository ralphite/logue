/** The Host, as the extension needs it. */

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

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${HOST}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new HostError("Logue is not running on this Mac.", 0);
  }
  if (!response.ok) {
    const detail: unknown = await response.json().catch(() => null);
    const message =
      detail && typeof detail === "object" && "error" in detail ? String(detail.error) : response.statusText;
    throw new HostError(message, response.status);
  }
  const payload: unknown = await response.json();
  // The single trust boundary: the Host is ours and its route table is the contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return payload as T;
}

const post = <T,>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export const host = {
  status: () => call<{ ok: boolean; model: { voice_ready: boolean; generation_ready: boolean } }>("/v1/status"),

  context: (project = "") => call<Context>(`/v1/context?project=${encodeURIComponent(project)}`),

  transcribe: (body: { audio: string; media_type: string; project?: string; overrides?: unknown }) =>
    post<{ capture_id: string; text: string }>("/v1/transcribe", body),

  saveVoice: (body: { capture_id: string; text: string; source?: unknown; project?: string; parent_ids?: string[] }) =>
    post<{ material: Material }>("/v1/voice-materials", body),

  saveMaterial: (body: {
    kind: string;
    content: string;
    source?: unknown;
    projects?: string[];
    parent_ids?: string[];
  }) => post<{ material: Material }>("/v1/materials", body),

  run: (body: { skill_id: string; instruction: string; project?: string; source_ids?: string[] }) =>
    post<{ run: { id: string; original_output?: string; status: string; error?: string }; sources: Material[] }>(
      "/v1/runs",
      body,
    ),

  adopt: (runId: string, text: string) => post<unknown>(`/v1/runs/${runId}/adopt`, { text }),

  pageMaterials: (url: string) =>
    call<{ materials: Material[] }>(`/v1/materials?${new URLSearchParams({ q: url })}`),
};
