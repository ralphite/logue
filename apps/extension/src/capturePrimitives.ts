import type { CaptureIntent, CaptureOrganization, CaptureSource, LocalError, PageCaptureContext, PanelCaptureState, PendingInsert } from "./sidePanelModels";

export type { CaptureIntent, CaptureOrganization, CaptureSource, LocalError, PageCaptureContext, PanelCaptureState, PendingInsert } from "./sidePanelModels";

export function sourceFromTab(tab: Pick<chrome.tabs.Tab, "url" | "pendingUrl" | "title">): CaptureSource {
  const url = tab.url ?? tab.pendingUrl ?? "";
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    // Chrome pages and freshly opened tabs may not have a normal URL.
  }
  const title = tab.title?.trim();
  // A generic fallback is not useful provenance. The panel derives a readable
  // domain from a real URL and stays quiet when Chrome has neither yet.
  return { url, title: title && title !== "Current page" ? title : domain, domain };
}

export function mergePanelCaptureState(
  current: PanelCaptureState,
  patch: Partial<Pick<PanelCaptureState, "draft" | "transcript" | "projects" | "tags">> & { pendingInsert?: PendingInsert | null },
): PanelCaptureState {
  const { pendingInsert, ...rest } = patch;
  const next = {
    ...current,
    ...rest,
    ...(rest.projects !== undefined ? { projects: explicitProjects({ projects: rest.projects }) } : {}),
    updatedAt: Date.now(),
  };
  if (pendingInsert === null) {
    delete next.pendingInsert;
  } else if (pendingInsert) {
    next.pendingInsert = pendingInsert;
  }
  return next;
}

/** A tab can authorize at most one Project. Empty means the Source stays saved only. */
export function explicitProjects(state?: Pick<PanelCaptureState, "projects">): string[] {
  const project = state?.projects?.find((value) => typeof value === "string" && value.trim())?.trim();
  return project ? [project] : [];
}

export function captureOrganization(state?: Pick<PanelCaptureState, "projects" | "tags">): CaptureOrganization {
  return {
    projects: explicitProjects(state),
    tags: state?.tags?.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()) ?? [],
  };
}

/** Project authorization belongs to the tab, not to a URL or capture intent. */
export function preserveTabProjects(next: PanelCaptureState, current?: PanelCaptureState): PanelCaptureState {
  if (!current || current.tabId !== next.tabId || current.projects === undefined) return next;
  return { ...next, projects: explicitProjects(current) };
}

/** Content scripts cannot choose the tab whose Project authorization they read. */
export function tabProjectRequestSender(message: unknown, senderTabId?: number): number | undefined {
  if (
    !message ||
    typeof message !== "object" ||
    (message as { type?: unknown }).type !== "logue:get-tab-projects" ||
    !Number.isSafeInteger(senderTabId) ||
    (senderTabId ?? 0) <= 0
  ) return undefined;
  return senderTabId;
}

export function friendlyLocalError(cause: unknown, kind: LocalError["kind"]): LocalError {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (kind === "service") {
    return { kind: "service", message: "Can’t reach Logue.", action: "change-server" };
  }
  if (/permission|notallowed|denied/i.test(message)) {
    return { kind: "microphone", message: "Allow microphone access, then try again.", action: "retry" };
  }
  if (/failed to fetch|network|connection|service/i.test(message)) {
    return { kind: "service", message: "Can’t reach Logue.", action: "change-server" };
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
