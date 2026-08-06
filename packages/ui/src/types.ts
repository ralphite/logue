export type MaterialKind = "voice" | "selection" | "text" | "derived";

export type MaterialStatus = "unfiled" | "organized" | "draft";

export interface MaterialOrganization {
  status: "pending" | "organized" | "needs_review" | "confirmed";
  confidence?: number;
  reason?: string;
  suggested_projects?: string[];
  suggested_tags?: string[];
  membership_origins?: Record<string, "auto_added" | "added">;
  duplicate_of?: string;
  user_correction?: {
    id: string;
    bundle_root_id: string;
    source_ids: string[];
    content_excerpt: string;
    original_suggested_projects: string[];
    outcomes: Array<{
      project: string;
      state: "added" | "saved_only" | "excluded";
    }>;
    tags_context: string[];
    created_at: string;
  };
  updated_at?: string;
}

export interface SourceInfo {
  url?: string;
  title?: string;
  domain?: string;
  document_id?: string;
  document_revision?: number;
  selection?: string;
  context_before?: string;
  context_after?: string;
  anchor?: {
    status: "anchored" | "page_changed" | "reanchored" | "snapshot_only";
    quote: string;
    context_before?: string;
    context_after?: string;
    revision: number;
    updated_at: string;
  };
  anchor_history?: Array<{
    status: "anchored" | "page_changed" | "reanchored" | "snapshot_only";
    quote: string;
    context_before?: string;
    context_after?: string;
    revision: number;
    updated_at: string;
  }>;
}

export interface AppliedContext {
  page_url?: string;
  page_title?: string;
  reference_project?: string;
  personal_context?: string;
  project_overview?: string;
  glossary?: string[];
  recent_adopted_ids?: string[];
  recent_adopted_texts?: string[];
  transcription_skill_id?: string;
  transcription_skill_name?: string;
  transcription_skill_revision?: number;
  transcription_skill_instructions?: string;
  voice_profile_label?: string;
  project_profile_mode?: string;
  primary_language?: string;
  mixed_languages?: string[];
  custom_instructions?: string;
  phrases?: string[];
  avoid_terms?: string[];
  formatting_preference?: string;
  disable_project_profile?: boolean;
  language_override?: string;
  topic_vocabulary_id?: string;
  topic_vocabulary_name?: string;
  correction_spoken?: string;
  correction_preferred?: string;
  correction_scope?: "only" | "topic" | "project" | "global";
}

export interface Material {
  id: string;
  kind: MaterialKind;
  status: MaterialStatus;
  content: string;
  rawTranscript?: string;
  transcript?: string;
  annotation?: string;
  source?: SourceInfo;
  projects: string[];
  excludedProjects?: string[];
  savedOnlyProjects?: string[];
  tags: string[];
  parentIds?: string[];
  captureId?: string;
  transcriptRevision?: number;
  revision?: number;
  createdAt: string;
  actor?: string;
  activityType?: "voice-command" | "text-command" | "ask" | "draft";
  adoptedRevisions?: Array<{
    id: string;
    revision: number;
    content: string;
    target?: { surface?: string; url?: string; target_key?: string };
    undone: boolean;
    created_at: string;
    undone_at?: string;
  }>;
  appliedContext?: AppliedContext;
  organization?: MaterialOrganization;
  tombstone?: boolean;
  deletedAt?: string;
}

export type CaptureMode = "input" | "selection";
export type CapturePhase =
  "idle" | "recording" | "processing" | "review" | "error";

export interface ContextSource {
  id: string;
  label: string;
  type: "page" | "selection" | "project" | "glossary";
  removable?: boolean;
}

export interface ExtensionInputTarget {
  id: string;
  label: string;
  pageTitle: string;
  domain: string;
  url: string;
  lastFocusedAt: number;
}

export type ExtensionTargetBridgeRequest = {
  source: "logue-web";
  type: "logue:target-bridge-request";
  requestId: string;
  action:
    | "list"
    | "insert"
    | "undo"
    | "shortcuts"
    | "update-shortcut"
    | "reset-shortcut";
  sessionId?: string;
  text?: string;
  undoToken?: string;
  command?: "start-voice-write" | "start-voice-command";
  shortcut?: string;
};

export interface ExtensionShortcut {
  command: "start-voice-write" | "start-voice-command";
  shortcut: string;
}

export type ExtensionTargetBridgeResponse = {
  source: "logue-extension";
  type: "logue:target-bridge-response";
  requestId: string;
  ok: boolean;
  targets?: ExtensionInputTarget[];
  target?: ExtensionInputTarget;
  undoToken?: string;
  shortcuts?: ExtensionShortcut[];
  error?: string;
};
