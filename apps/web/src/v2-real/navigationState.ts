export type SavedProjectView = "workspace" | "context" | "history" | "settings";
export type SavedRequestMode = "ask" | "compare" | "draft";

export interface DocumentPosition {
  caret: number;
  scrollTop: number;
}

export interface V2NavigationState {
  project?: {
    id?: string;
    name?: string;
    view?: SavedProjectView;
    mode?: SavedRequestMode;
    documentId?: string;
  };
  documents?: {
    selectedId?: string;
    positions?: Record<string, DocumentPosition>;
  };
}

const storageKey = "logue:v2-navigation-state";

export function readNavigationState(): V2NavigationState {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function updateNavigationState(
  update: (current: V2NavigationState) => V2NavigationState,
) {
  const next = update(readNavigationState());
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

export function saveDocumentPosition(
  documentId: string,
  position: Partial<DocumentPosition>,
) {
  if (!documentId) return;
  updateNavigationState((current) => {
    const previous = current.documents?.positions?.[documentId] ?? {
      caret: 0,
      scrollTop: 0,
    };
    return {
      ...current,
      documents: {
        ...current.documents,
        selectedId: documentId,
        positions: {
          ...current.documents?.positions,
          [documentId]: { ...previous, ...position },
        },
      },
    };
  });
}
