import type { Section } from "./components/NavRail";

export interface AppNavigation {
  section: Section;
}

const canonicalView: Record<Section, string> = {
  library: "library",
  projects: "projects",
  settings: "settings",
};

function value(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() || undefined;
}

export function parseNavigation(search: string): AppNavigation {
  const params = new URLSearchParams(search);
  const rawView = value(params, "view")?.toLowerCase();
  const section: Section = rawView === "library"
    ? "library"
    : rawView === "projects"
      ? "projects"
      : rawView === "settings"
        ? "settings"
        : "library";

  return { section };
}

export function navigationURL(
  location: Pick<Location, "pathname" | "search" | "hash">,
  navigation: AppNavigation,
) {
  const params = new URLSearchParams(location.search);
  for (const key of ["view", "material", "project", "doc", "tab"]) params.delete(key);
  params.set("view", canonicalView[navigation.section]);

  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}
