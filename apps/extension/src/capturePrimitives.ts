import type { CaptureIntent, CaptureOrganization, CaptureSource, CommandResult, LocalError, PageCaptureContext, PanelCaptureState, PendingInsert } from "./sidePanelModels";

export type { CaptureIntent, CaptureOrganization, CaptureSource, CommandResult, LocalError, PageCaptureContext, PanelCaptureState, PendingInsert } from "./sidePanelModels";

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
  patch: Partial<Pick<PanelCaptureState, "draft" | "transcript" | "projectExplicit" | "tags">> & {
    projects?: string[] | null;
    projectAssociationId?: string | null;
    projectAssociationScope?: PanelCaptureState["projectAssociationScope"] | null;
    pendingInsert?: PendingInsert | null;
    commandResult?: CommandResult | null;
    commandActivitySourceId?: string | null;
    commandRunRequestId?: string | null;
  },
): PanelCaptureState {
  const { commandResult, commandActivitySourceId, commandRunRequestId, pendingInsert, projects, projectAssociationId, projectAssociationScope, ...rest } = patch;
  const next = {
    ...current,
    ...rest,
    ...(projects !== undefined && projects !== null ? { projects: explicitProjects({ projects }) } : {}),
    updatedAt: Date.now(),
  };
  if (projects === null) delete next.projects;
  if (pendingInsert === null) {
    delete next.pendingInsert;
  } else if (pendingInsert) {
    next.pendingInsert = pendingInsert;
  }
  if (commandResult === null) {
    delete next.commandResult;
  } else if (commandResult) {
    next.commandResult = commandResult;
  }
  if (commandActivitySourceId === null) delete next.commandActivitySourceId;
  else if (commandActivitySourceId) next.commandActivitySourceId = commandActivitySourceId;
  if (commandRunRequestId === null) delete next.commandRunRequestId;
  else if (commandRunRequestId) next.commandRunRequestId = commandRunRequestId;
  if (projectAssociationId === null) delete next.projectAssociationId;
  else if (projectAssociationId) next.projectAssociationId = projectAssociationId;
  if (projectAssociationScope === null) delete next.projectAssociationScope;
  else if (projectAssociationScope) next.projectAssociationScope = projectAssociationScope;
  return next;
}

/** A tab can authorize at most one Project. Empty means the Source stays saved only. */
export function explicitProjects(state?: Pick<PanelCaptureState, "projects">): string[] {
  const project = state?.projects?.find((value) => typeof value === "string" && value.trim())?.trim();
  return project ? [project] : [];
}

export function captureOrganization(state?: Pick<PanelCaptureState, "projects" | "tags">): CaptureOrganization {
  return {
    projects: Array.from(new Set(state?.projects?.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()) ?? [])),
    tags: state?.tags?.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()) ?? [],
  };
}

/** Project authorization belongs to the tab, not to a URL or capture intent. */
export function preserveTabProjects(next: PanelCaptureState, current?: PanelCaptureState): PanelCaptureState {
  if (!current || current.tabId !== next.tabId || current.projects === undefined) return next;
  return {
    ...next,
    projects: explicitProjects(current),
    projectExplicit: current.projectExplicit,
    projectAssociationId: current.projectAssociationId,
    projectAssociationScope: current.projectAssociationScope,
  };
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
  if (kind === "model") {
    const runSaved =
      cause instanceof Error &&
      "run" in cause &&
      Boolean((cause as Error & { run?: unknown }).run);
    return {
      kind,
      message: runSaved
        ? `${message || "Generation failed."} The failed Run and its Sources are saved.`
        : message || "Generation failed. Check the provider in Logue Settings.",
      action: "retry",
    };
  }
  return { kind, message: kind === "save" ? "Not saved yet. Try again." : "Could not start recording.", action: "retry" };
}

export function stopMediaStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
