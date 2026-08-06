import type { InlineVoicePhase } from "./InlineVoiceControls";
import type { VoiceProfileOverrides } from "./api";

const messageType = "logue:google-docs-launcher";

export type GoogleDocsLauncherAction = "start" | "stop" | "cancel";
export interface GoogleDocsLauncherCommand { action: GoogleDocsLauncherAction; overrides?: VoiceProfileOverrides; }

export interface GoogleDocsLauncherState {
  visible: boolean;
  phase: InlineVoicePhase;
  error: string;
  pendingCopyText: string;
}

export function googleDocsLauncherStateMessage(state: GoogleDocsLauncherState) {
  return { type: messageType, kind: "state" as const, state };
}

export function googleDocsLauncherActionMessage(action: GoogleDocsLauncherAction, overrides?: VoiceProfileOverrides) {
  return { type: messageType, kind: "action" as const, action, overrides };
}

export function readGoogleDocsLauncherState(value: unknown): GoogleDocsLauncherState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const message = value as Partial<{ type: string; kind: string; state: Partial<GoogleDocsLauncherState> }>;
  const state = message.state;
  if (
    message.type !== messageType || message.kind !== "state" || !state ||
    typeof state.visible !== "boolean" || typeof state.error !== "string" ||
    typeof state.pendingCopyText !== "string" ||
    !["idle", "starting", "recording", "processing", "error"].includes(String(state.phase))
  ) return undefined;
  return state as GoogleDocsLauncherState;
}

export function readGoogleDocsLauncherAction(value: unknown): GoogleDocsLauncherCommand | undefined {
  if (!value || typeof value !== "object") return undefined;
  const message = value as Partial<{ type: string; kind: string; action: string }>;
  if (message.type !== messageType || message.kind !== "action") return undefined;
  return message.action === "start" || message.action === "stop" || message.action === "cancel"
    ? { action: message.action, overrides: (value as { overrides?: VoiceProfileOverrides }).overrides }
    : undefined;
}
