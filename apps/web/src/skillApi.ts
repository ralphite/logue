import { logueApiBase } from "./apiBase";
import type { LogueDocument } from "./api";

const apiBase = logueApiBase;

// Keep a useful default in the client so creating or editing a blank Skill
// never depends on a backend-specific empty-purpose validation rule.
export const defaultSkillPurpose =
  "Create a useful result from the selected context.";

function normalizedSkillPurpose(value?: string) {
  return value?.trim() || defaultSkillPurpose;
}

export type SkillTask = "transcribe" | "organize" | "generate";
export type SkillOutput = "insert" | "material" | "qa" | "document";
export type SkillSurface = "web" | "extension" | "background";
export type SkillContext =
  "page" | "target" | "selection" | "project" | "materials" | "personal";

export interface LogueSkill {
  id: string;
  name: string;
  purpose: string;
  instructions: string;
  task: SkillTask;
  output: SkillOutput;
  surfaces: SkillSurface[];
  contexts: SkillContext[];
  enabled: boolean;
  system: boolean;
  pinned?: boolean;
  hidden?: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface SkillRevision extends LogueSkill {
  skill_id: string;
  current: boolean;
}

export interface SkillRunSource {
  id: string;
  kind?: string;
  actor?: string;
  content: string;
  projects: string[];
  tags: string[];
  created_at: string;
  source?: {
    url?: string;
    title?: string;
    domain?: string;
    selection?: string;
  } | null;
}

export interface LogueSkillRun {
  id: string;
  request_id?: string;
  skill_id: string;
  skill_revision: number;
  skill_name: string;
  skill_instructions: string;
  task: SkillTask;
  output_type: SkillOutput;
  instruction: string;
  project?: string;
  page_title?: string;
  page_url?: string;
  target_text?: string;
  selection?: string;
  continue_run_id?: string;
  sources: SkillRunSource[];
  original_output?: string;
  adopted_output?: string;
  document_id?: string;
  material_id?: string;
  adoption?: "copy" | "insert" | "replace" | "keep" | "document";
  adoption_undone?: boolean;
  adoption_target?: { surface?: string; url?: string; target_key?: string };
  status: "running" | "complete" | "failed";
  error?: string;
  created_at: string;
  updated_at: string;
}

export class SkillRunFailure extends Error {
  run: LogueSkillRun;

  constructor(message: string, run: LogueSkillRun) {
    super(message);
    this.name = "SkillRunFailure";
    this.run = run;
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const value = JSON.parse(body) as { error?: string };
      message = value.error || body;
    } catch {
      // Keep a plain-text server response as-is.
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function parseSkillRun(response: Response): Promise<LogueSkillRun> {
  const body = await response.text();
  let value: { error?: string; run?: LogueSkillRun } | LogueSkillRun | undefined;
  try {
    value = body ? (JSON.parse(body) as typeof value) : undefined;
  } catch {
    // A plain-text failure still becomes an actionable request error below.
  }
  if (!response.ok) {
    const failure = value as { error?: string; run?: LogueSkillRun } | undefined;
    const message = failure?.error || body || `Request failed (${response.status})`;
    if (failure?.run) throw new SkillRunFailure(message, failure.run);
    throw new Error(message);
  }
  return value as LogueSkillRun;
}

export async function getSkills() {
  return (
    await parse<{ skills: LogueSkill[] }>(await fetch(`${apiBase}/v1/skills`))
  ).skills;
}

export async function createSkill(
  input: Omit<
    LogueSkill,
    "id" | "system" | "revision" | "created_at" | "updated_at"
  >,
) {
  return parse<LogueSkill>(
    await fetch(`${apiBase}/v1/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        purpose: normalizedSkillPurpose(input.purpose),
      }),
    }),
  );
}

export async function updateSkill(
  id: string,
  changes: Partial<
    Pick<
      LogueSkill,
      | "name"
      | "purpose"
      | "instructions"
      | "task"
      | "output"
      | "surfaces"
      | "contexts"
      | "enabled"
    >
  > & { expected_revision?: number },
) {
  return parse<LogueSkill>(
    await fetch(`${apiBase}/v1/skills/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...changes,
        ...(changes.purpose !== undefined
          ? { purpose: normalizedSkillPurpose(changes.purpose) }
          : {}),
      }),
    }),
  );
}

export async function getSkillRevisions(id: string) {
  return (
    await parse<{ revisions: SkillRevision[] }>(
      await fetch(`${apiBase}/v1/skills/${encodeURIComponent(id)}/revisions`),
    )
  ).revisions;
}

export async function restoreSkillRevision(id: string, revision: number) {
  return parse<LogueSkill>(
    await fetch(`${apiBase}/v1/skills/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
    }),
  );
}

export async function updateBuiltInSkillPreferences(
  id: string,
  changes: { pinned?: boolean; hidden?: boolean },
) {
  return parse<LogueSkill>(
    await fetch(`${apiBase}/v1/skills/${encodeURIComponent(id)}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }),
  );
}

export async function deleteSkill(id: string) {
  const response = await fetch(
    `${apiBase}/v1/skills/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok)
    throw new Error(
      (await response.text()) || `Request failed (${response.status})`,
    );
}

export async function getSkillRuns() {
  return (
    await parse<{ runs: LogueSkillRun[] }>(
      await fetch(`${apiBase}/v1/skill-runs`),
    )
  ).runs;
}

export async function createSkillRun(input: {
  skill_id: string;
  instruction: string;
  project?: string;
  source_ids?: string[];
  page_title?: string;
  page_url?: string;
  target_text?: string;
  selection?: string;
  continue_run_id?: string;
  auto_search?: boolean;
  activity_source_id?: string;
}) {
  const requestId =
    globalThis.crypto?.randomUUID?.() ??
    `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return parseSkillRun(
    await fetch(`${apiBase}/v1/skill-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, request_id: requestId }),
    }),
  );
}

export async function retrySkillRun(run: LogueSkillRun) {
  return parseSkillRun(
    await fetch(`${apiBase}/v1/skill-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retry_run_id: run.id,
        request_id:
          globalThis.crypto?.randomUUID?.() ??
          `web-retry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }),
    }),
  );
}

export async function adoptSkillRun(
  id: string,
  adoptedOutput: string,
  result: {
    action?: "copy" | "insert" | "replace" | "keep" | "undo";
    target?: { surface?: string; url?: string; target_key?: string };
  } = {},
) {
  const response = await parse<{ run: LogueSkillRun }>(
    await fetch(`${apiBase}/v1/skill-runs/${encodeURIComponent(id)}/adopt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        output: adoptedOutput,
        action: result.action ?? "copy",
        target: result.target,
      }),
    }),
  );
  return response.run;
}

export async function saveSkillRunAsDocument(
  id: string,
  input: {
    title?: string;
    content: string;
    documentId?: string;
    project?: string;
    sourceIds?: string[];
    contextSourceIds?: string[];
    expectedRevision?: number;
  },
) {
  return parse<{ run: LogueSkillRun; document: LogueDocument }>(
    await fetch(`${apiBase}/v1/skill-runs/${encodeURIComponent(id)}/document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        document_id: input.documentId,
        project: input.project,
        source_ids: input.sourceIds,
        context_source_ids: input.contextSourceIds,
        expected_revision: input.expectedRevision,
      }),
    }),
  );
}
