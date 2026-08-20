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
  /** Where the act happened. `kind` names the surface: dictation, panel, a
      page's own field — the extension writes it and the verbs read it. */
  source?: { kind?: string; url?: string; title?: string; domain?: string };
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
  /** What automatic filing did, why, and exactly what it added. */
  organization?: {
    status?: string;
    confidence?: number;
    reason?: string;
    suggested_projects?: string[];
    suggested_tags?: string[];
    /** What filing actually added — the exact set an undo takes back. */
    accepted_projects?: string[];
    accepted_tags?: string[];
    duplicate_of?: string;
    /** An earlier Source this one seems to overrule, waiting for a person. */
    supersedes?: { id: string; why?: string };
    accepted_supersedes?: string;
    /** "auto" until a person confirms, undoes, or edits. */
    decided?: "auto" | "undone" | "accepted" | "dismissed";
  };
  /** Set once someone agreed a newer Source overrules this one. */
  superseded_by?: { id: string; at: string; why?: string };
  /** The earlier Sources this one was agreed to overrule. */
  supersedes?: string[];
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
  /** The first line of the text, kept by the Host so a list need not open it. */
  title: string;
  /** Where it sits: under another document, or at the top. */
  parent_id?: string | null;
  /** Its place among its siblings. */
  position?: number;
  /** Markdown, which is what the editor holds and what the export writes. */
  content: string;
  source_ids: string[];
  revision: number;
  run_id?: string;
  /** An agent finished while the working copy had moved; its result waits here. */
  pending_agent?: PendingAgent | null;
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
  /** Where the person put it. Absent until the first reorder places it. */
  position?: number;
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
  /** Empty for the entry that is the working copy as it stands. */
  id: string;
  revision: number;
  created_at?: string;
  added: number;
  removed: number;
  current?: boolean;
  /** On the current entry: the working copy holds words no version does. */
  unsaved?: boolean;
  /** Who saved this state. Everything not an agent's is the person's. */
  author?: "user" | "agent";
  label?: string;
  /** What changed, in words. Written by a model, so it arrives late — documents only. */
  summary?: string;
  summary_state?: "pending" | "ready" | "failed";
}

/** An agent result waiting beside a document for the person to rule on. */
export interface PendingAgent {
  content: string;
  base_version_id?: string;
  label?: string;
  created_at?: string;
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
  /** Where model calls are being reported, and any endpoint declined for not being this machine. */
  trace?: { to: string; refused: string };
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

  /**
   * Whether the workspace has moved. Asked on a short timer by every surface,
   * so it reads no files — see `sync.ts`.
   */
  changes: () => request<{ at: number; kinds: Record<string, number> }>("/v1/changes"),

  materials: (query?: { q?: string; project?: string; kind?: string }) =>
    request<{ materials: Material[] }>(`/v1/materials?${new URLSearchParams(query ?? {})}`),
  /**
   * The same search, plus whatever this query is also called.
   *
   * Separate from `materials` because it asks a model: it belongs to a person
   * who has stopped typing and pressed something, never to a keystroke.
   */
  findWider: (q: string) =>
    request<{ materials: Material[]; also: string[] }>(
      `/v1/materials?${new URLSearchParams({ q, wider: "1" })}`,
    ),
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
  resolveOrganization: (
    id: string,
    body: { accept: boolean; projects?: string[]; tags?: string[]; supersede?: boolean },
  ) =>
    send<{ material: Material }>("POST", `/v1/materials/${id}/organization`, body),
  /** Take back what automatic filing added — that, and nothing else. */
  undoOrganization: (id: string) =>
    send<{ material: Material }>("POST", `/v1/materials/${id}/organization/undo`, {}),
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
  /** The same documents, ordered by where they sit rather than when they changed. */
  documentTree: () => request<{ documents: Document[] }>("/v1/documents?tree=1"),
  document: (id: string) => request<{ document: Document; sources: Material[] }>(`/v1/documents/${id}`),
  createDocument: (body: { content?: string; source_ids?: string[]; parent_id?: string }) =>
    send<{ document: Document }>("POST", "/v1/documents", body),
  /** Under another document, or back to the top — and where among its siblings. */
  moveDocument: (id: string, body: { parent_id?: string | null; before?: string | null }) =>
    send<{ document: Document }>("POST", `/v1/documents/${id}/move`, body),
  reorderDocuments: (parent: string | null, order: string[]) =>
    send<{ documents: Document[] }>("POST", "/v1/documents/reorder", { parent_id: parent, order }),
  /** The working copy as a new version — `saved: false` when nothing changed. */
  saveVersion: (id: string) =>
    send<{ saved: boolean; version: { id: string; revision: number; author: string } | null }>(
      "POST",
      `/v1/documents/${id}/versions`,
      {},
    ),
  /** The agent change waiting for a decision, with what applying it would change. */
  pendingChange: (id: string) =>
    request<{ pending: PendingAgent | null; lines: DiffLine[] }>(`/v1/documents/${id}/pending`),
  applyPendingChange: (id: string) =>
    send<{ document: Document }>("POST", `/v1/documents/${id}/pending/apply`, {}),
  discardPendingChange: (id: string) =>
    send<{ document: Document }>("POST", `/v1/documents/${id}/pending/discard`, {}),
  /** `expected_revision` is what the editor last saw; a mismatch comes back 409. */
  updateDocument: (
    id: string,
    changes: Partial<Pick<Document, "content" | "source_ids">> & {
      expected_revision?: number;
    },
  ) => send<{ document: Document }>("PATCH", `/v1/documents/${id}`, changes),
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
  /** The whole order, ids in a list — the same shape Documents reorder with. */
  reorderSkills: (order: string[]) => send<{ skills: Skill[] }>("POST", "/v1/skills/reorder", { order }),
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
