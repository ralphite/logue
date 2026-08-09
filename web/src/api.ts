/** The Host's contract, typed once. Every call goes through `request`. */

/**
 * A build is only ever served by the Host, so it talks to where it came from —
 * which also means opening it as `localhost` instead of `127.0.0.1` does not
 * turn every call into a cross-origin one. In dev, vite serves the page and the
 * Host is somewhere else.
 */
const HOST =
  import.meta.env.VITE_LOGUE_HOST ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : window.location.origin);

export interface Material {
  id: string;
  kind: "voice" | "selection" | "text" | "page" | "derived";
  content: string;
  /** The passage the quote sits in, kept at capture time. */
  context?: string;
  transcript?: string;
  source?: { url?: string; title?: string; domain?: string };
  projects: string[];
  tags?: string[];
  parent_ids?: string[];
  capture_id?: string;
  /** How long that recording ran, measured when it was made. */
  capture_seconds?: number;
  excluded?: boolean;
  orphaned?: boolean;
  actor?: string;
  purpose?: string;
  /** What shaped this transcript, frozen when it was made. */
  applied_context?: {
    profile?: string;
    project?: string;
    language?: string;
    terms?: string[];
    vocabulary?: string;
    custom_instructions?: string;
    skill?: { id: string; name?: string; revision?: number } | null;
    page_context_characters?: number;
    instructions?: string;
    at?: string;
    /** Written by earlier versions; kept readable rather than orphaned. */
    reference_project?: string;
    glossary?: string[];
  };
  /** What automatic filing proposed, and what became of it. */
  organization?: {
    status?: string;
    confidence?: number;
    reason?: string;
    suggested_projects?: string[];
    suggested_tags?: string[];
    duplicate_of?: string;
    decided?: "accepted" | "dismissed";
  };
  created_at: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  overview: string;
  count?: number;
  transcription_profile?: Record<string, unknown>;
  updated_at?: string;
}

export interface Document {
  id: string;
  title: string;
  /** Who named it: the first line, a model, or the person. */
  title_state?: "auto" | "generated" | "edited";
  content: string;
  source_ids: string[];
  revision: number;
  run_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  purpose: string;
  instructions: string;
  task: string;
  output: string;
  surfaces: string[];
  contexts: string[];
  enabled: boolean;
  system?: boolean;
  built_in_key?: string;
  revision: number;
}

export interface Run {
  id: string;
  skill_id: string;
  skill_name?: string;
  skill_revision?: number;
  instruction: string;
  project?: string;
  output_type?: string;
  sources: string[];
  citations?: number[];
  status: "running" | "complete" | "failed";
  original_output?: string;
  adopted_output?: string;
  /** What the person did with it: kept, inserted, copied, or made a Document. */
  adoption?: "keep" | "insert" | "copy" | "document";
  adoption_undone?: boolean;
  adoption_target?: string;
  error?: string;
  activity_source_id?: string;
  created_at: string;
}

/** One version of something that keeps a history — a document, or a Skill's prompt. */
export interface Version {
  /** Empty for the version that is the thing as it stands. */
  id: string;
  revision: number;
  created_at?: string;
  added: number;
  removed: number;
  current?: boolean;
  /** What changed, in words. Written by a model, so it arrives late — documents only. */
  summary?: string;
  summary_state?: "pending" | "ready" | "failed";
}

/** One decision in a proposed rewrite: a kept stretch, or a change with both sides. */
export type RewriteHunk =
  | { kind: "same"; lines: string[] }
  | { kind: "change"; before: string[]; after: string[] };

export interface DiffLine {
  kind: "same" | "added" | "removed";
  text: string;
  old: number | null;
  new: number | null;
}

export interface TranscriptRevision {
  id: string;
  material_id: string;
  revision?: number;
  transcript?: string;
  /** Written by earlier versions under a different name. */
  text?: string;
  created_at: string;
}

export interface Correction {
  spoken: string;
  preferred: string;
  at?: string;
}

/** A word Logue has learned to spell, and the reason it knows it. */
export interface LearnedTerm {
  term: string;
  reason: string;
  at?: string;
}

/** A proper noun written by hand often enough to be worth asking about. */
export interface TermCandidate {
  term: string;
  count: number;
  example: string;
}

export interface Topic {
  id: string;
  name: string;
  /** What made this a group: a tag, a Project, or a domain. */
  seed_key?: string;
  automatic?: boolean;
  hidden?: boolean;
  source_ids: string[];
  reason?: string;
}

export interface BackupFile {
  id: string;
  bytes: number;
  created_at: string;
}

export interface ModelStatus {
  /** Which wire format answers: "gemini" or "openai" (Groq and kin). */
  provider?: string;
  configured: boolean;
  model: string;
  transcription_model?: string;
  base_url?: string;
  generation: string;
  voice: string;
  generation_error: string;
  voice_error: string;
}

export interface HostStatus {
  ok: boolean;
  /** Which build the Host is serving. Empty when nothing is deployed. */
  build?: string;
  data_dir: string;
  bytes: number;
  model: ModelStatus & { generation_ready: boolean; voice_ready: boolean };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Headers, not an object spread: HeadersInit may be an array of pairs, which
  // spreads into numeric keys and silently drops the real headers.
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  // Forces a preflight on every write, which is where the Host checks the
  // origin. Without it a page you happened to have open could post here.
  headers.set("X-Logue-Client", "web");

  let response: Response;
  try {
    response = await fetch(`${HOST}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Logue is not running on this Mac.", 0);
  }
  if (!response.ok) {
    const detail: unknown = await response.json().catch(() => null);
    const message =
      detail && typeof detail === "object" && "error" in detail ? String(detail.error) : response.statusText;
    throw new ApiError(message, response.status);
  }
  const payload: unknown = await response.json();
  // The one trust boundary in the app: the Host's response shape is asserted
  // here so no other file has to. The Host is ours and its route table is the
  // contract; if that drifts, this is the single place to add validation.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return payload as T;
}

const send = <T,>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  host: HOST,
  status: () => request<HostStatus>("/v1/status"),

  materials: (query?: { q?: string; project?: string; kind?: string }) =>
    request<{ materials: Material[] }>(`/v1/materials?${new URLSearchParams(query ?? {})}`),
  lineage: (id: string) =>
    request<{ material: Material; parents: Material[]; children: Material[] }>(`/v1/materials/${id}/lineage`),
  updateMaterial: (id: string, changes: Partial<Material>) =>
    send<{ material: Material }>("PATCH", `/v1/materials/${id}`, changes),
  deleteMaterial: (id: string) => send<{ ok: true }>("DELETE", `/v1/materials/${id}`),

  /** What has been built on this Source — and what a deletion would take with it. */
  dependencies: (id: string) =>
    request<{
      runs: { id: string; instruction: string; created_at: string }[];
      documents: { id: string; title: string }[];
      derived: { id: string; content: string }[];
    }>(`/v1/materials/${id}/dependencies`),

  /** Earlier transcripts of the same recording, newest kept last. */
  transcriptRevisions: (id: string) =>
    request<{ current: Material; revisions: TranscriptRevision[] }>(`/v1/materials/${id}/transcript-revisions`),
  retranscribe: (id: string, correction?: { spoken: string; preferred: string }) =>
    send<{ material: Material }>("POST", `/v1/materials/${id}/retranscribe`, { correction }),
  useRevision: (id: string, revisionId: string) =>
    send<{ material: Material }>("POST", `/v1/materials/${id}/use-revision`, { revision_id: revisionId }),
  corrections: () => request<{ corrections: Correction[] }>("/v1/corrections"),
  forgetCorrection: (spoken: string) =>
    send<{ corrections: Correction[] }>("DELETE", `/v1/corrections/${encodeURIComponent(spoken)}`),

  vocabulary: () =>
    request<{ learned: LearnedTerm[]; candidates: TermCandidate[] }>("/v1/vocabulary"),
  learnTerm: (term: string, reason?: string) =>
    send<{ learned: LearnedTerm[] }>("POST", "/v1/vocabulary", { term, reason }),
  dismissTerm: (term: string) =>
    send<{ candidates: TermCandidate[] }>("POST", "/v1/vocabulary/dismiss", { term }),
  forgetTerm: (term: string) =>
    send<{ learned: LearnedTerm[] }>("DELETE", `/v1/vocabulary/${encodeURIComponent(term)}`),

  /** Groupings Logue noticed: by tag, by Project, by where things came from. */
  topics: () => request<{ topics: Topic[] }>("/v1/topics"),
  regroupTopics: () => send<{ topics: Topic[] }>("POST", "/v1/topics/regroup", {}),
  renameTopic: (id: string, name: string) => send<{ topic: Topic }>("PATCH", `/v1/topics/${id}`, { name }),
  hideTopic: (id: string) => send<{ topic: Topic }>("PATCH", `/v1/topics/${id}`, { hidden: true }),

  /** Sources with a suggestion nobody has looked at, most confident first. */
  review: () => request<{ materials: Material[] }>("/v1/review"),
  organizeMaterial: (id: string) => send<{ material: Material }>("POST", `/v1/materials/${id}/organize`, {}),
  resolveOrganization: (id: string, body: { accept: boolean; projects?: string[]; tags?: string[] }) =>
    send<{ material: Material }>("POST", `/v1/materials/${id}/organization`, body),
  setMembership: (materialId: string, project: string, member: boolean) =>
    send<{ material: Material }>("POST", "/v1/project-membership", { material_id: materialId, project, member }),

  projects: () => request<{ projects: Project[] }>("/v1/projects"),
  project: (id: string) => request<{ project: Project; materials: Material[] }>(`/v1/projects/${id}`),
  createProject: (name: string, overview = "") =>
    send<{ project: Project }>("POST", "/v1/projects", { name, overview }),
  updateProject: (id: string, changes: Partial<Project>) =>
    send<{ project: Project }>("PATCH", `/v1/projects/${id}`, changes),
  projectDeletionPreview: (id: string) =>
    request<{ project: Project; materials_kept: number }>(`/v1/projects/${id}/deletion-preview`),
  deleteProject: (id: string) => send<{ ok: true }>("DELETE", `/v1/projects/${id}`),

  documents: () => request<{ documents: Document[] }>("/v1/documents"),
  document: (id: string) => request<{ document: Document; sources: Material[] }>(`/v1/documents/${id}`),
  createDocument: (body: { title?: string; content?: string; source_ids?: string[] }) =>
    send<{ document: Document }>("POST", "/v1/documents", body),
  /** `expected_revision` is what the editor last saw; a mismatch comes back 409. */
  updateDocument: (
    id: string,
    changes: Partial<Pick<Document, "title" | "content" | "source_ids" | "title_state">> & {
      expected_revision?: number;
    },
  ) => send<{ document: Document }>("PATCH", `/v1/documents/${id}`, changes),
  /** Ask a model to name a document nobody has named. Refused if one has. */
  nameDocument: (id: string) => send<{ document: Document }>("POST", `/v1/documents/${id}/name`, {}),
  deleteDocument: (id: string) => send<{ ok: true }>("DELETE", `/v1/documents/${id}`),
  documentMarkdownUrl: (id: string) => `${HOST}/v1/documents/${id}/markdown`,

  /** Every version of a document, newest first, each saying what it changed. */
  documentVersions: (id: string) => request<{ versions: Version[] }>(`/v1/documents/${id}/versions`),
  documentDiff: (id: string, revision: number) =>
    request<{ lines: DiffLine[] }>(`/v1/documents/${id}/versions/${revision}/diff`),
  /** A model's proposal for a selected passage. Nothing is applied here. */
  rewriteSelection: (id: string, selection: string, instruction: string) =>
    send<{ run_id: string; rewritten: string; hunks: RewriteHunk[] }>(
      "POST",
      `/v1/documents/${id}/rewrite`,
      { selection, instruction },
    ),

  /** Written forward as a new edit, so the versions in between survive. */
  restoreDocument: (id: string, revision: number) =>
    send<{ document: Document }>("POST", `/v1/documents/${id}/versions/${revision}/restore`, {}),

  skills: () => request<{ skills: Skill[] }>("/v1/skills"),
  createSkill: (body: Partial<Skill>) => send<{ skill: Skill }>("POST", "/v1/skills", body),
  updateSkill: (id: string, changes: Partial<Skill>) => send<{ skill: Skill }>("PATCH", `/v1/skills/${id}`, changes),
  skillImpact: (id: string) => request<{ runs: number; projects: string[] }>(`/v1/skills/${id}/archive-impact`),
  deleteSkill: (id: string) => send<{ ok: true }>("DELETE", `/v1/skills/${id}`),

  /** Every version of a Skill's prompt, newest first. Runs point at these numbers. */
  skillVersions: (id: string) => request<{ versions: Version[] }>(`/v1/skills/${id}/versions`),
  skillDiff: (id: string, revision: number) =>
    request<{ lines: DiffLine[] }>(`/v1/skills/${id}/versions/${revision}/diff`),
  /** Written forward as a new edit, so no Run is left pointing at a revision that went away. */
  restoreSkill: (id: string, revision: number) =>
    send<{ skill: Skill }>("POST", `/v1/skills/${id}/versions/${revision}/restore`, {}),

  runs: (project?: string) =>
    request<{ runs: Run[] }>(`/v1/runs${project ? `?project=${encodeURIComponent(project)}` : ""}`),
  run: (id: string) => request<{ run: Run; sources: Material[]; missing: string[] }>(`/v1/runs/${id}`),
  createRun: (body: { skill_id: string; instruction: string; project?: string; source_ids?: string[] }) =>
    send<{ run: Run; sources: Material[] }>("POST", "/v1/runs", body),
  adoptRun: (id: string, text: string, action: Run["adoption"] = "keep", target = "") =>
    send<{ run: Run }>("POST", `/v1/runs/${id}/adopt`, { text, action, target }),
  undoRun: (id: string) => send<{ run: Run }>("POST", `/v1/runs/${id}/undo`, {}),
  runToDocument: (id: string, title?: string) =>
    send<{ document: Document }>("POST", `/v1/runs/${id}/document`, { title }),

  settings: () => request<{ settings: Record<string, unknown> }>("/v1/settings"),
  updateSettings: (changes: Record<string, unknown>) =>
    send<{ settings: Record<string, unknown> }>("PATCH", "/v1/settings", changes),

  model: () => request<ModelStatus>("/v1/model"),
  testModel: (body: { api_key?: string; model?: string; provider?: string; base_url?: string }) =>
    send<{ generation: { ok: boolean; error: string }; voice: { ok: boolean; error: string } }>(
      "POST",
      "/v1/model/test",
      body,
    ),
  saveModel: (body: { api_key?: string; model?: string; provider?: string; base_url?: string }) =>
    send<ModelStatus>("PATCH", "/v1/model", body),

  backupPreview: () => request<{ counts: Record<string, number>; audio: number; bytes: number }>("/v1/backup/preview"),
  backups: () => request<{ backups: BackupFile[] }>("/v1/backups"),
  createBackup: () => send<{ backup: BackupFile }>("POST", "/v1/backups", {}),
  restoreBackup: (body: { backup_id?: string; bundle?: string }) =>
    send<{ restored: Record<string, number>; safety_backup: string }>("POST", "/v1/backups/restore", body),
  backupExportUrl: () => `${HOST}/v1/backup/export`,
  audioUrl: (captureId: string) => `${HOST}/v1/captures/${captureId}/audio`,
};
