export type PendingVoiceSaveKind = "material" | "selection";

export const PENDING_VOICE_CAPACITY = 20;

export interface PendingVoiceQueueStatus {
  writable: boolean;
  count: number;
  capacity: number;
  reason?: string;
}

export interface PendingVoiceTranscriptionRequest {
  pageUrl: string;
  pageTitle: string;
  targetText?: string;
  selectedText?: string;
  projectContext?: string;
  glossary?: string;
  instructions?: string;
  appliedContext?: unknown;
  profileRequest?: {
    project?: string;
    profile_project?: string;
    disable_project_profile?: boolean;
    use_default_profile?: boolean;
    primary_language?: string;
    topic_vocabulary_id?: string;
  };
}

export interface PendingVoicePlan {
  kind: PendingVoiceSaveKind;
  /** Existing Stop-first You Comment to update instead of creating another Source. */
  materialId?: string;
  transcription: PendingVoiceTranscriptionRequest;
  /** Body template for /v1/items or /v1/selections. Voice result fields are added on retry. */
  save: Record<string, unknown>;
  command?: {
    scope: "auto" | "selection" | "page" | "project";
    project?: string;
    source: { url: string; title: string; domain: string; selection?: string };
    selection?: string;
    pageText?: string;
    targetText?: string;
    targetSessionId?: string;
    targetAvailable: boolean;
  };
}

export interface PendingVoiceTranscription {
  captureId: string;
  rawTranscript: string;
  text: string;
  appliedContext?: unknown;
}

export interface PendingVoiceRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  audioBase64: string;
  mimeType: string;
  tabId?: number;
  frameId?: number;
  pageUrl?: string;
  pageTitle?: string;
  state: "pending" | "retrying" | "failed";
  attempts: number;
  error?: string;
  plan?: PendingVoicePlan;
  transcription?: PendingVoiceTranscription;
}

export type PendingVoiceSummary = Omit<PendingVoiceRecord, "audioBase64">;
