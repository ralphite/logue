export type CaptureIntent = "page" | "selection" | "input" | "generate";

export interface CaptureSource {
  url: string;
  title: string;
  domain: string;
}

export interface CaptureOrganization {
  projects: string[];
  tags: string[];
}

export interface PageCaptureContext {
  source: CaptureSource;
  selectionText?: string;
  targetText?: string;
  targetAvailable: boolean;
}

export interface PendingInsert {
  text: string;
  materialId: string;
  sourceURL: string;
}

export interface PanelCaptureState {
  tabId: number;
  intent: CaptureIntent;
  source: CaptureSource;
  selectionText?: string;
  targetText?: string;
  targetAvailable: boolean;
  draft?: string;
  transcript?: string;
  projects?: string[];
  tags?: string[];
  pendingInsert?: PendingInsert;
  autoStartToken?: string;
  updatedAt: number;
}

export interface LocalError {
  kind: "microphone" | "transcription" | "save" | "target" | "service";
  message: string;
  action: "retry" | "copy" | "start-service";
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
  content: string;
  annotation?: string;
  createdAt: string;
}
