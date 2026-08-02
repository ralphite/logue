import type { Section } from "./components/NavRail";
import type { GenerationMode } from "./components/GenerationWorkspace";

export interface AppNavigation {
  section: Section;
  materialId?: string;
  projectName?: string;
  documentId?: string;
  generationMode?: GenerationMode;
}

const canonicalView: Record<Section, string> = {
  stream: "stream",
  projects: "projects",
  views: "generate",
  settings: "settings",
};

function value(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() || undefined;
}

export function parseNavigation(search: string): AppNavigation {
  const params = new URLSearchParams(search);
  const rawView = value(params, "view")?.toLowerCase();
  const section: Section = rawView === "stream"
    ? "stream"
    : rawView === "projects"
      ? "projects"
      : rawView === "settings"
        ? "settings"
        : "views";

  if (section === "stream") return { section, materialId: value(params, "material") };
  if (section === "projects") return { section, projectName: value(params, "project") };
  if (section === "views") {
    const rawMode = value(params, "tab")?.toLowerCase();
    const generationMode: GenerationMode = value(params, "doc") || rawView === "docs" || rawMode === "documents"
      ? "documents"
      : rawMode === "agents"
        ? "agents"
        : "new";
    return {
      section,
      generationMode,
      documentId: value(params, "doc"),
      projectName: value(params, "project"),
    };
  }
  return { section };
}

export function navigationURL(
  location: Pick<Location, "pathname" | "search" | "hash">,
  navigation: AppNavigation,
) {
  const params = new URLSearchParams(location.search);
  for (const key of ["view", "material", "project", "doc", "tab"]) params.delete(key);
  params.set("view", canonicalView[navigation.section]);

  if (navigation.section === "stream" && navigation.materialId) {
    params.set("material", navigation.materialId);
  } else if (navigation.section === "projects" && navigation.projectName) {
    params.set("project", navigation.projectName);
  } else if (navigation.section === "views") {
    if (navigation.documentId || (navigation.generationMode && navigation.generationMode !== "new")) params.set("tab", navigation.generationMode ?? "documents");
    if (navigation.documentId) params.set("doc", navigation.documentId);
    if (navigation.projectName) params.set("project", navigation.projectName);
  }

  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}
