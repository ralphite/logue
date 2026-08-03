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

export function sourceFromTab(tab: Pick<chrome.tabs.Tab, "url" | "title">): CaptureSource {
  const url = tab.url ?? "";
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    // Chrome pages and freshly opened tabs may not have a normal URL.
  }
  return { url, title: tab.title || domain || "Current page", domain };
}

export function mergePanelCaptureState(
  current: PanelCaptureState,
  patch: Partial<Pick<PanelCaptureState, "draft" | "transcript" | "projects" | "tags">> & { pendingInsert?: PendingInsert | null },
): PanelCaptureState {
  const { pendingInsert, ...rest } = patch;
  const next = { ...current, ...rest, updatedAt: Date.now() };
  if (pendingInsert === null) {
    delete next.pendingInsert;
  } else if (pendingInsert) {
    next.pendingInsert = pendingInsert;
  }
  return next;
}

export function friendlyLocalError(cause: unknown, kind: LocalError["kind"]): LocalError {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (/permission|notallowed|denied/i.test(message)) {
    return { kind: "microphone", message: "Allow microphone access, then try again.", action: "retry" };
  }
  if (/failed to fetch|network|connection|service/i.test(message)) {
    return { kind: "service", message: "Start the Logue app, then try again.", action: "start-service" };
  }
  if (/target|input field|editor/i.test(message)) {
    return { kind: "target", message: "The original editor is no longer available. Your text is saved in Logue.", action: "copy" };
  }
  if (kind === "transcription") {
    return { kind, message: "Transcription failed. The recording is still available.", action: "retry" };
  }
  return { kind, message: kind === "save" ? "Not saved yet. Try again." : "Could not start recording.", action: "retry" };
}

export function stopMediaStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
