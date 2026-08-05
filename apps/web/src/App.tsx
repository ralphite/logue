import { useEffect, useState } from "react";
import { getStatus } from "./api";
import { LibraryPage } from "./components/LibraryPage";
import { pageColumnClass } from "./components/layout";
import { NavRail, type Section } from "./components/NavRail";
import { PanelResizer, usePersistentPanelSize } from "./components/PanelResizer";
import { PageHeader } from "./components/ui";
import { navigationURL, parseNavigation, type AppNavigation } from "./navigation";

const navigationCollapsedStorageKey = "logue.navigation.collapsed";

function initialNavigationCollapsed() {
  try {
    return window.localStorage.getItem(navigationCollapsedStorageKey) === "true";
  } catch {
    return false;
  }
}

function PendingWorkspace({ title }: { title: string }) {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <PageHeader title={title} />
      <div className="scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={`${pageColumnClass} py-24`}>
          <p className="text-[15px] leading-6 text-[#6d6e69]">This workspace is being rebuilt around Sources and Pages.</p>
        </div>
      </div>
    </main>
  );
}

export function App() {
  const [navigation, setNavigation] = useState<AppNavigation>(() => parseNavigation(window.location.search));
  const [connected, setConnected] = useState(true);
  const [collapsed, setCollapsed] = useState(initialNavigationCollapsed);
  const navigationSize = usePersistentPanelSize({ storageKey: "logue.navigation.width", defaultSize: 252, min: 200, max: 320 });

  useEffect(() => {
    const updateNavigation = () => setNavigation(parseNavigation(window.location.search));
    window.addEventListener("popstate", updateNavigation);
    return () => window.removeEventListener("popstate", updateNavigation);
  }, []);

  useEffect(() => {
    document.title = `Logue | ${navigation.section[0].toUpperCase() + navigation.section.slice(1)}`;
  }, [navigation.section]);

  useEffect(() => {
    let active = true;
    void getStatus().then(() => active && setConnected(true)).catch(() => active && setConnected(false));
    return () => { active = false; };
  }, []);

  function changeSection(section: Section) {
    const next: AppNavigation = { section };
    const url = navigationURL(window.location, next);
    window.history.pushState({}, "", url);
    setNavigation(next);
  }

  function changeCollapsed(next: boolean) {
    setCollapsed(next);
    try { window.localStorage.setItem(navigationCollapsedStorageKey, String(next)); } catch { /* unavailable storage */ }
  }

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-white text-[#33342f]">
      <NavRail active={navigation.section} onChange={changeSection} connected={connected} collapsed={collapsed} onCollapsedChange={changeCollapsed} width={navigationSize.size} onWidthChange={navigationSize.setSize} />
      {navigation.section === "library" ? <LibraryPage /> : <PendingWorkspace title={navigation.section === "projects" ? "Projects" : "Settings"} />}
    </div>
  );
}
