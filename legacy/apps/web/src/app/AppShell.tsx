import { LogueLogo, useFocusBoundary } from "@logue/ui";
import {
  ChevronRight,
  FileText,
  FolderKanban,
  Library,
  PanelLeftClose,
  PanelRightOpen,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { GlobalFindDialog } from "./GlobalFindDialog";
import { IconButton, PanelResizer, Tooltip, TooltipProvider, usePersistentPanelSize } from "../ui";

export type PrimaryRoute = "projects" | "library" | "documents" | "skills" | "settings";

export interface AppShellProps {
  route: PrimaryRoute;
  projectName?: string;
  projects?: Array<{ id: string; name: string }>;
  activeProjectId?: string;
  onRouteChange?: (route: PrimaryRoute) => void;
  onProjectChange?: (projectId: string) => void;
  topbarActions?: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  inspectorOpen?: boolean;
  onInspectorOpenChange?: (open: boolean) => void;
}

const primaryItems = [
  { id: "projects" as const, label: "Projects", icon: FolderKanban },
  { id: "library" as const, label: "Library", icon: Library },
  { id: "documents" as const, label: "Documents", icon: FileText },
  { id: "skills" as const, label: "Skills", icon: Sparkles },
];

const navRow = "flex w-full items-center gap-2.5 rounded-sm text-left text-ink-soft hover:bg-hover hover:text-ink [&_svg]:shrink-0 [&_svg]:text-[#666963]";

function navItemClass(active: boolean, collapsed: boolean) {
  return [
    navRow,
    "min-h-9",
    collapsed ? "justify-center px-0" : "px-2",
    active ? "bg-active font-[590] text-ink" : "",
  ].join(" ");
}

function readCollapsed() {
  try {
    return window.localStorage.getItem("logue.navigation.collapsed") === "true";
  } catch {
    return false;
  }
}

export function AppShell({ route, projectName, projects = [], activeProjectId, onRouteChange, onProjectChange, topbarActions, children, inspector, inspectorOpen = false, onInspectorOpenChange }: AppShellProps) {
  const [inspectorWidth, setInspectorWidth] = useState(400);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [globalFindOpen, setGlobalFindOpen] = useState(false);
  const { size: navigationWidth, setSize: setNavigationWidth } = usePersistentPanelSize({
    storageKey: "logue.navigation.width",
    defaultSize: 232,
    min: 200,
    max: 320,
  });
  const inspectorRef = useFocusBoundary<HTMLElement>({
    open: Boolean(inspector && inspectorOpen),
    onClose: () => onInspectorOpenChange?.(false),
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("logue.navigation.collapsed", String(collapsed));
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }, [collapsed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setGlobalFindOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const setNavigationCollapsed = (next: boolean) => setCollapsed(next);
  const routeLabel = route === "projects" ? "Projects" : route === "library" ? "Library" : route === "documents" ? "Documents" : route === "skills" ? "Skills" : "Settings";
  const sectionClass = `flex flex-col gap-0.5 py-1 ${collapsed ? "px-[7px]" : "px-2.5"}`;

  return (
    <TooltipProvider>
      <div className="flex h-screen min-h-[720px] w-full overflow-hidden bg-canvas">
        <nav
          className="flex min-w-0 shrink-0 flex-col border-r border-line bg-nav max-[640px]:hidden"
          aria-label="Primary navigation"
          style={{ width: collapsed ? 56 : navigationWidth }}
        >
          <div className={`flex h-16 items-center justify-between ${collapsed ? "justify-center px-[7px]" : "px-2.5"}`}>
            <button
              type="button"
              className={`inline-flex h-9 items-center rounded-sm text-ink-soft hover:bg-hover hover:text-ink [&_svg]:size-[21px] [&_svg]:shrink-0 ${collapsed ? "w-10 shrink-0 justify-center px-0" : "min-w-0 flex-1 gap-[9px] px-2 text-left"}`}
              aria-label={collapsed ? "Open sidebar" : "Logue home"}
              aria-expanded={!collapsed}
              onClick={() => collapsed ? setNavigationCollapsed(false) : onRouteChange?.("projects")}
            >
              <LogueLogo compact />
              {!collapsed ? <span className="text-[20px] font-[680] tracking-[-0.035em] text-ink">Logue</span> : null}
            </button>
            {!collapsed ? (
              <Tooltip content="Close sidebar">
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-sm text-ink-soft opacity-70 hover:bg-hover hover:text-ink" aria-label="Close sidebar" onClick={() => setNavigationCollapsed(true)}>
                  <PanelLeftClose size={18} aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
          </div>
          <div className={sectionClass}>
            <Tooltip content="Search · ⌘K" disabled={!collapsed}>
              <button className={navItemClass(false, collapsed)} type="button" aria-label="Search" onClick={() => setGlobalFindOpen(true)}>
                <span className="inline-flex w-7 shrink-0 items-center justify-center"><Search aria-hidden="true" size={18} /></span>
                {!collapsed ? <span className="truncate">Search</span> : null}
                {!collapsed ? <kbd className="ml-auto font-sans text-[11px] text-faint">⌘K</kbd> : null}
              </button>
            </Tooltip>
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <div key={item.id}>
                  <Tooltip content={item.label} disabled={!collapsed}>
                    <button className={navItemClass(active, collapsed)} type="button" aria-label={item.label} aria-current={active ? "page" : undefined} onClick={() => onRouteChange?.(item.id)}>
                      <span className="inline-flex w-7 shrink-0 items-center justify-center"><Icon aria-hidden="true" size={18} /></span>
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </button>
                  </Tooltip>
                  {!collapsed && item.id === "projects" && active && projects.length ? (
                    <div className="flex flex-col gap-px pt-[3px] pr-0.5 pb-2 pl-8" aria-label="Projects">
                      {projects.map((project) => {
                        const current = project.id === activeProjectId;
                        return (
                          <button key={project.id} type="button" className={`${navRow} min-h-8 px-2 text-sm ${current ? "bg-active font-[590] text-ink" : ""}`} aria-current={current ? "page" : undefined} onClick={() => onProjectChange?.(project.id)}>
                            <span className={`size-[5px] shrink-0 rounded-full ${current ? "bg-[#747770]" : "bg-[#b8bab4]"}`} aria-hidden="true" />
                            <span className="truncate">{project.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex-1" />
          <div className={sectionClass}>
            <Tooltip content="Settings" disabled={!collapsed}>
              <button className={navItemClass(route === "settings", collapsed)} type="button" aria-label="Settings" aria-current={route === "settings" ? "page" : undefined} onClick={() => onRouteChange?.("settings")}>
                <span className="inline-flex w-7 shrink-0 items-center justify-center"><Settings aria-hidden="true" size={18} /></span>
                {!collapsed ? <span className="truncate">Settings</span> : null}
              </button>
            </Tooltip>
          </div>
        </nav>
        {!collapsed ? (
          <PanelResizer label="Resize primary navigation" value={navigationWidth} min={200} max={320} defaultValue={232} onChange={setNavigationWidth} className="z-30 max-[640px]:hidden" />
        ) : null}
        <main className="@container min-w-0 flex-1 overflow-hidden">
          <div className="relative flex h-full w-full min-w-0 bg-canvas">
            <section className="flex min-w-0 flex-1 flex-col">
              <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-6">
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
                  <span>{routeLabel}</span>
                  {projectName ? <><ChevronRight aria-hidden="true" size={14} /><strong className="truncate font-[580] text-ink-soft">{projectName}</strong></> : null}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  {topbarActions}
                  {inspector && !inspectorOpen ? <Tooltip content="Open sources"><IconButton label="Open sources" variant="ghost" onClick={() => onInspectorOpenChange?.(true)}><PanelRightOpen aria-hidden="true" size={18} /></IconButton></Tooltip> : null}
                </div>
              </header>
              {children}
            </section>
            {inspector && inspectorOpen ? (
              <>
                <PanelResizer edge="left" label="Resize source inspector" value={inspectorWidth} min={360} max={640} defaultValue={400} onChange={setInspectorWidth} className="max-[980px]:hidden" />
                <aside
                  ref={inspectorRef}
                  className="flex min-w-0 flex-col border-l border-line bg-panel max-[980px]:absolute max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:z-12 max-[980px]:!w-[min(520px,calc(100vw-64px))] max-[980px]:shadow-[-16px_0_36px_rgba(28,29,27,0.1)]"
                  style={{ width: inspectorWidth }}
                  aria-label="Sources used"
                  tabIndex={-1}
                >{inspector}</aside>
              </>
            ) : null}
          </div>
        </main>
        <GlobalFindDialog open={globalFindOpen} onOpenChange={setGlobalFindOpen} />
      </div>
    </TooltipProvider>
  );
}
