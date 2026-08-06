export type MaterialKind = "voice" | "selection" | "text" | "derived";

export type MaterialStatus = "unfiled" | "organized" | "draft";

export interface MaterialOrganization {
  status: "pending" | "organized" | "needs_review" | "confirmed";
  confidence?: number;
  reason?: string;
  suggested_projects?: string[];
  suggested_tags?: string[];
  updated_at?: string;
}

export interface SourceInfo {
  url?: string;
  title?: string;
  domain?: string;
  selection?: string;
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
}

export interface Material {
  id: string;
  kind: MaterialKind;
  status: MaterialStatus;
  content: string;
  transcript?: string;
  annotation?: string;
  source?: SourceInfo;
  projects: string[];
  excludedProjects?: string[];
  savedOnlyProjects?: string[];
  tags: string[];
  parentIds?: string[];
  captureId?: string;
  createdAt: string;
  actor?: string;
  appliedContext?: AppliedContext;
  organization?: MaterialOrganization;
}

export type CaptureMode = "input" | "selection";
export type CapturePhase =
  | "idle"
  | "recording"
  | "processing"
  | "review"
  | "error";

export interface ContextSource {
  id: string;
  label: string;
  type: "page" | "selection" | "project" | "glossary";
  removable?: boolean;
}
