import type { SourceInfo } from "@logue/ui";

export type CaptureIntent = "page" | "selection" | "input" | "generate";

export interface CaptureSource {
  url: string;
  title: string;
  domain: string;
  selection?: string;
  context_before?: string;
  context_after?: string;
}

export interface CaptureOrganization {
  projects: string[];
  tags: string[];
}

export interface PanelProject {
  name: string;
}

export interface PageCaptureContext {
  source: CaptureSource;
  candidateServerURL?: string;
  selectionText?: string;
  targetText?: string;
  targetAvailable: boolean;
  pageText?: string;
}

export interface PendingInsert {
  text: string;
  materialId: string;
  sourceURL: string;
}

export interface CommandSourceSnapshot {
  id: string;
  kind?: string;
  actor?: string;
  content: string;
  projects: string[];
  tags: string[];
  createdAt?: string;
  source?: {
    url?: string;
    title?: string;
    domain?: string;
    selection?: string;
  };
}

export interface CommandResult {
  runId: string;
  originalText: string;
  text: string;
  sources: CommandSourceSnapshot[];
  targetKey: string;
  sourceURL: string;
  undoToken?: string;
  materialId?: string;
  adopted?: boolean;
  adoptionPending?: "insert";
  allowInsert?: boolean;
}

export interface PanelCaptureState {
  tabId: number;
  intent: CaptureIntent;
  source: CaptureSource;
  candidateServerURL?: string;
  selectionText?: string;
  targetText?: string;
  targetAvailable: boolean;
  pageText?: string;
  draft?: string;
  transcript?: string;
  projects?: string[];
  projectExplicit?: boolean;
  projectAssociationId?: string;
  projectAssociationScope?: "page" | "site";
  tags?: string[];
  pendingInsert?: PendingInsert;
  commandResult?: CommandResult;
  generationSourceIds?: string[];
  pinnedSourceIds?: string[];
  autoStartToken?: string;
  updatedAt: number;
}

export interface LocalError {
  kind: "microphone" | "transcription" | "save" | "target" | "service";
  message: string;
  action: "retry" | "copy" | "change-server";
}

export interface ExtensionSkill {
  id: string;
  name: string;
  purpose: string;
  task: "transcribe" | "organize" | "generate";
  output: "insert" | "material" | "qa" | "document";
  surfaces: Array<"web" | "extension" | "background">;
  contexts: Array<"page" | "target" | "selection" | "project" | "materials" | "personal">;
  enabled: boolean;
}

export interface PageMaterial {
  id: string;
  kind?: "voice" | "selection" | "text" | "derived";
  actor?: string;
  content: string;
  annotation?: string;
  parentIds?: string[];
  captureId?: string;
  commentState?: "unlinked" | "linked";
  source?: SourceInfo;
  createdAt: string;
  projects: string[];
  excludedProjects: string[];
  savedOnlyProjects: string[];
  tags: string[];
  organization?: {
    status?: string;
    reason?: string;
    suggestedProjects?: string[];
    membershipOrigins?: Record<string, "auto_added" | "added">;
    duplicateOf?: string;
  };
}

export interface PageMaterialChanges {
  content?: string;
  projects?: string[];
  excludedProjects?: string[];
  savedOnlyProjects?: string[];
  tags?: string[];
}
