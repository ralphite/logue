import type { InlineVoicePhase } from "./v2-real/V2InlineVoiceSurface";
import type { CaptureContext, VoiceProfileOverrides } from "./api";
import type { VoiceCandidateRetranscribeInput, VoiceCandidateState } from "./v2-real/V2VoiceCandidateSurface";

const messageType = "logue:google-docs-launcher";

export type GoogleDocsLauncherAction = "start" | "stop" | "cancel" | "candidate-text" | "candidate-copy" | "candidate-insert" | "candidate-undo" | "candidate-retry" | "candidate-dismiss" | "candidate-retranscribe" | "candidate-overrides";
export interface GoogleDocsLauncherCommand {
  action: GoogleDocsLauncherAction;
  overrides?: VoiceProfileOverrides;
  text?: string;
  retranscribeInput?: VoiceCandidateRetranscribeInput;
}

export interface GoogleDocsLauncherState {
  visible: boolean;
  phase: InlineVoicePhase;
  error: string;
  pendingCopyText: string;
  candidate?: VoiceCandidateState;
  profileContext?: CaptureContext;
  profileOverrides?: VoiceProfileOverrides;
}

export function googleDocsLauncherStateMessage(state: GoogleDocsLauncherState) {
  return { type: messageType, kind: "state" as const, state };
}

export function googleDocsLauncherActionMessage(action: GoogleDocsLauncherAction, values: Omit<GoogleDocsLauncherCommand, "action"> = {}) {
  return { type: messageType, kind: "action" as const, action, ...values };
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
  return ["start", "stop", "cancel", "candidate-text", "candidate-copy", "candidate-insert", "candidate-undo", "candidate-retry", "candidate-dismiss", "candidate-retranscribe", "candidate-overrides"].includes(String(message.action))
    ? {
      action: message.action as GoogleDocsLauncherAction,
      overrides: (value as GoogleDocsLauncherCommand).overrides,
      text: (value as GoogleDocsLauncherCommand).text,
      retranscribeInput: (value as GoogleDocsLauncherCommand).retranscribeInput,
    }
    : undefined;
}
