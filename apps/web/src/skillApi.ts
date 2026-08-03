import { logueApiBase } from "./apiBase";

const apiBase = logueApiBase;

// Keep a useful default in the client so creating or editing a blank Skill
// never depends on a backend-specific empty-purpose validation rule.
export const defaultSkillPurpose = "Create a useful result from the selected context.";

function normalizedSkillPurpose(value?: string) {
  return value?.trim() || defaultSkillPurpose;
}

export type SkillTask = "transcribe" | "organize" | "generate";
export type SkillOutput = "insert" | "material" | "qa" | "document";
export type SkillSurface = "web" | "extension" | "background";
export type SkillContext = "page" | "target" | "selection" | "project" | "materials" | "personal";

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
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface SkillRunSource {
  id: string;
  content: string;
  projects: string[];
  tags: string[];
  created_at: string;
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
  sources: SkillRunSource[];
  original_output?: string;
  adopted_output?: string;
  document_id?: string;
  material_id?: string;
  status: "running" | "complete" | "failed";
  error?: string;
  created_at: string;
  updated_at: string;
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

export async function getSkills() {
  return (await parse<{ skills: LogueSkill[] }>(await fetch(`${apiBase}/v1/skills`))).skills;
}

export async function createSkill(input: Omit<LogueSkill, "id" | "system" | "revision" | "created_at" | "updated_at">) {
  return parse<LogueSkill>(await fetch(`${apiBase}/v1/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, purpose: normalizedSkillPurpose(input.purpose) }),
  }));
}

export async function updateSkill(id: string, changes: Partial<Pick<LogueSkill, "name" | "purpose" | "instructions" | "task" | "output" | "surfaces" | "contexts" | "enabled">> & { expected_revision?: number }) {
  return parse<LogueSkill>(await fetch(`${apiBase}/v1/skills/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...changes,
      ...(changes.purpose !== undefined ? { purpose: normalizedSkillPurpose(changes.purpose) } : {}),
    }),
  }));
}

export async function deleteSkill(id: string) {
  const response = await fetch(`${apiBase}/v1/skills/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
}

export async function getSkillRuns() {
  return (await parse<{ runs: LogueSkillRun[] }>(await fetch(`${apiBase}/v1/skill-runs`))).runs;
}

export async function createSkillRun(input: { skill_id: string; instruction: string; project?: string; source_ids?: string[]; page_title?: string; page_url?: string; target_text?: string; selection?: string }) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return parse<LogueSkillRun>(await fetch(`${apiBase}/v1/skill-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, request_id: requestId }),
  }));
}

export async function adoptSkillRun(id: string, adoptedOutput: string) {
  return parse<LogueSkillRun>(await fetch(`${apiBase}/v1/skill-runs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adopted_output: adoptedOutput }),
  }));
}
