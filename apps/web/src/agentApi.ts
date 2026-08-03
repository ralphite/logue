import { logueApiBase } from "./apiBase";

const apiBase = logueApiBase;

// The server stores Skills through the existing agent endpoint. Keep a useful
// default in the client so creating or editing a blank Skill never depends on
// a backend-specific empty-purpose validation rule.
export const defaultSkillPurpose = "Create a useful result from the selected context.";

function normalizedSkillPurpose(value?: string) {
  return value?.trim() || defaultSkillPurpose;
}

export type AgentTask = "transcribe" | "organize" | "generate";
export type AgentOutput = "insert" | "material" | "qa" | "document";
export type AgentSurface = "web" | "extension" | "background";
export type AgentContext = "page" | "target" | "selection" | "project" | "materials" | "personal";

export interface LogueAgent {
  id: string;
  name: string;
  purpose: string;
  instructions: string;
  task: AgentTask;
  output: AgentOutput;
  surfaces: AgentSurface[];
  contexts: AgentContext[];
  enabled: boolean;
  system: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface AgentRunSource {
  id: string;
  content: string;
  projects: string[];
  tags: string[];
  created_at: string;
}

export interface LogueAgentRun {
  id: string;
  request_id?: string;
  agent_id: string;
  agent_revision: number;
  agent_name: string;
  agent_instructions: string;
  task: AgentTask;
  output_type: AgentOutput;
  instruction: string;
  project?: string;
  sources: AgentRunSource[];
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

export async function getAgents() {
  return (await parse<{ agents: LogueAgent[] }>(await fetch(`${apiBase}/v1/agents`))).agents;
}

export async function createAgent(input: Omit<LogueAgent, "id" | "system" | "revision" | "created_at" | "updated_at">) {
  return parse<LogueAgent>(await fetch(`${apiBase}/v1/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, purpose: normalizedSkillPurpose(input.purpose) }),
  }));
}

export async function updateAgent(id: string, changes: Partial<Pick<LogueAgent, "name" | "purpose" | "instructions" | "task" | "output" | "surfaces" | "contexts" | "enabled">> & { expected_revision?: number }) {
  return parse<LogueAgent>(await fetch(`${apiBase}/v1/agents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...changes,
      ...(changes.purpose !== undefined ? { purpose: normalizedSkillPurpose(changes.purpose) } : {}),
    }),
  }));
}

export async function deleteAgent(id: string) {
  const response = await fetch(`${apiBase}/v1/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
}

export async function getAgentRuns() {
  return (await parse<{ runs: LogueAgentRun[] }>(await fetch(`${apiBase}/v1/agent-runs`))).runs;
}

export async function createAgentRun(input: { agent_id: string; instruction: string; project?: string; source_ids?: string[] }) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return parse<LogueAgentRun>(await fetch(`${apiBase}/v1/agent-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, request_id: requestId }),
  }));
}

export async function adoptAgentRun(id: string, adoptedOutput: string) {
  return parse<LogueAgentRun>(await fetch(`${apiBase}/v1/agent-runs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adopted_output: adoptedOutput }),
  }));
}
