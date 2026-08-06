import type { Section } from "./components/NavRail";

export interface AppNavigation {
  section: Section;
  materialId?: string;
  projectName?: string;
  documentId?: string;
}

const canonicalView: Record<Section, string> = {
  stream: "stream",
  projects: "projects",
  documents: "documents",
  skills: "skills",
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
      : rawView === "documents"
        ? "documents"
        : rawView === "skills"
          ? "skills"
      : rawView === "settings"
        ? "settings"
        : "stream";

  if (section === "stream") return { section, materialId: value(params, "material") };
  if (section === "projects") {
    return {
      section,
      projectName: value(params, "project"),
      materialId: value(params, "material"),
    };
  }
  if (section === "documents") {
    return {
      section,
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
  } else if (navigation.section === "projects") {
    if (navigation.projectName) params.set("project", navigation.projectName);
    if (navigation.materialId) params.set("material", navigation.materialId);
  } else if (navigation.section === "documents") {
    if (navigation.documentId) params.set("doc", navigation.documentId);
    if (navigation.projectName) params.set("project", navigation.projectName);
  }

  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}
