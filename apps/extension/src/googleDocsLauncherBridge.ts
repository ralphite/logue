import type { InlineVoicePhase } from "./v2-real/V2InlineVoiceSurface";
import type { CommandLauncherPhase } from "./v2-real/V2CommandLauncherSurface";
import type { CaptureContext, VoiceProfileOverrides } from "./api";
import type { VoiceCandidateRetranscribeInput, VoiceCandidateState } from "./v2-real/V2VoiceCandidateSurface";
import type { ExtensionDocument } from "./api";

const messageType = "logue:google-docs-launcher";

export type GoogleDocsLauncherAction = "start" | "stop" | "cancel" | "candidate-text" | "candidate-copy" | "candidate-insert" | "candidate-undo" | "candidate-retry" | "candidate-dismiss" | "candidate-retranscribe" | "candidate-overrides" | "command-open" | "command-text" | "command-project" | "command-scope" | "command-submit" | "command-start-voice" | "command-stop-voice" | "command-cancel-voice" | "command-retry" | "command-switch-write" | "command-close" | "command-candidate-text" | "command-candidate-primary" | "command-candidate-copy" | "command-candidate-keep" | "command-candidate-keep-undo" | "command-candidate-document" | "command-candidate-document-undo" | "command-candidate-dismiss";
export interface GoogleDocsLauncherCommand {
  action: GoogleDocsLauncherAction;
  overrides?: VoiceProfileOverrides;
  text?: string;
  project?: string;
  scope?: "selection" | "page" | "project";
  scopeExplicit?: boolean;
  sessionId?: string;
  activitySourceId?: string;
  pendingVoiceId?: string;
  document?: ExtensionDocument;
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
  command?: {
    phase: CommandLauncherPhase;
    instruction: string;
    project: string;
    scope: "selection" | "page" | "project";
    scopeExplicit: boolean;
    selectionAvailable: boolean;
    projects: string[];
    error: string;
    retryAvailable: boolean;
    switchWriteAvailable: boolean;
    recorderSessionId?: string;
    activitySourceId?: string;
    pendingVoiceId?: string;
  };
  commandCandidate?: {
    skillName: string;
    text: string;
    primaryAction: "Replace" | "Insert" | "Copy";
    busyAction?: "primary" | "copy" | "keep" | "document";
    error: string;
    project?: string;
    documents?: ExtensionDocument[];
    keepUndoAvailable?: boolean;
    documentUndoAvailable?: boolean;
    documentUndoAction?: "document" | "replace";
    documentUndoRetryable?: boolean;
  };
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
  return ["start", "stop", "cancel", "candidate-text", "candidate-copy", "candidate-insert", "candidate-undo", "candidate-retry", "candidate-dismiss", "candidate-retranscribe", "candidate-overrides", "command-open", "command-text", "command-project", "command-scope", "command-submit", "command-start-voice", "command-stop-voice", "command-cancel-voice", "command-retry", "command-switch-write", "command-close", "command-candidate-text", "command-candidate-primary", "command-candidate-copy", "command-candidate-keep", "command-candidate-keep-undo", "command-candidate-document", "command-candidate-document-undo", "command-candidate-dismiss"].includes(String(message.action))
    ? {
      action: message.action as GoogleDocsLauncherAction,
      overrides: (value as GoogleDocsLauncherCommand).overrides,
      text: (value as GoogleDocsLauncherCommand).text,
      project: (value as GoogleDocsLauncherCommand).project,
      scope: (value as GoogleDocsLauncherCommand).scope,
      scopeExplicit: (value as GoogleDocsLauncherCommand).scopeExplicit,
      sessionId: (value as GoogleDocsLauncherCommand).sessionId,
      activitySourceId: (value as GoogleDocsLauncherCommand).activitySourceId,
      pendingVoiceId: (value as GoogleDocsLauncherCommand).pendingVoiceId,
      document: (value as GoogleDocsLauncherCommand).document,
      retranscribeInput: (value as GoogleDocsLauncherCommand).retranscribeInput,
    }
    : undefined;
}
