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
import { GlobalFindDialog } from "../../components/GlobalFindDialog";
import { IconButton } from "../../components/ui";
import { PanelResizer, usePersistentPanelSize } from "../../components/PanelResizer";
import { Tooltip, TooltipProvider } from "../../components/Tooltip";
import "../styles/surfaces.css";

export type V2PrimaryRoute = "projects" | "library" | "documents" | "skills" | "settings";

export interface ProjectShellProps {
  route: V2PrimaryRoute;
  projectName?: string;
  projects?: Array<{ id: string; name: string }>;
  activeProjectId?: string;
  onRouteChange?: (route: V2PrimaryRoute) => void;
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

function readCollapsed() {
  try {
    return window.localStorage.getItem("logue.navigation.collapsed") === "true";
  } catch {
    return false;
  }
}

export function ProjectShell({ route, projectName, projects = [], activeProjectId, onRouteChange, onProjectChange, topbarActions, children, inspector, inspectorOpen = false, onInspectorOpenChange }: ProjectShellProps) {
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

  return (
    <TooltipProvider>
      <div className="logue-v2 v2-app-shell">
        <nav
          className="v2-app-nav"
          aria-label="Primary navigation"
          data-collapsed={collapsed ? "true" : "false"}
          style={{ width: collapsed ? 56 : navigationWidth }}
        >
          <div className="v2-app-brand">
            <button
              type="button"
              className="v2-app-logo"
              aria-label={collapsed ? "Open sidebar" : "Logue home"}
              aria-expanded={!collapsed}
              onClick={() => collapsed ? setNavigationCollapsed(false) : onRouteChange?.("projects")}
            >
              <LogueLogo compact />
              {!collapsed ? <span className="v2-app-wordmark">Logue</span> : null}
            </button>
            {!collapsed ? (
              <Tooltip content="Close sidebar">
                <button type="button" className="v2-sidebar-collapse" aria-label="Close sidebar" onClick={() => setNavigationCollapsed(true)}>
                  <PanelLeftClose size={18} aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
          </div>
          <div className="v2-nav-section">
            <Tooltip content="Search · ⌘K" disabled={!collapsed}>
              <button className="v2-nav-item" type="button" aria-label="Search" onClick={() => setGlobalFindOpen(true)}>
                <span className="v2-nav-icon"><Search aria-hidden="true" size={18} /></span>
                {!collapsed ? <span className="v2-nav-label">Search</span> : null}
                {!collapsed ? <kbd>⌘K</kbd> : null}
              </button>
            </Tooltip>
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <div key={item.id}>
                  <Tooltip content={item.label} disabled={!collapsed}>
                    <button className={`v2-nav-item${active ? " is-active" : ""}`} type="button" aria-label={item.label} aria-current={active ? "page" : undefined} onClick={() => onRouteChange?.(item.id)}>
                      <span className="v2-nav-icon"><Icon aria-hidden="true" size={18} /></span>
                      {!collapsed ? <span className="v2-nav-label">{item.label}</span> : null}
                    </button>
                  </Tooltip>
                  {!collapsed && item.id === "projects" && active && projects.length ? (
                    <div className="v2-project-list" aria-label="Projects">
                      {projects.map((project) => (
                        <button key={project.id} type="button" className={`v2-project-row${project.id === activeProjectId ? " is-active" : ""}`} aria-current={project.id === activeProjectId ? "page" : undefined} onClick={() => onProjectChange?.(project.id)}>
                          <span className="v2-project-dot" aria-hidden="true" />
                          <span className="v2-nav-label">{project.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="v2-app-nav-spacer" />
          <div className="v2-nav-section v2-nav-section-bottom">
            <Tooltip content="Settings" disabled={!collapsed}>
              <button className={`v2-nav-item${route === "settings" ? " is-active" : ""}`} type="button" aria-label="Settings" aria-current={route === "settings" ? "page" : undefined} onClick={() => onRouteChange?.("settings")}>
                <span className="v2-nav-icon"><Settings aria-hidden="true" size={18} /></span>
                {!collapsed ? <span className="v2-nav-label">Settings</span> : null}
              </button>
            </Tooltip>
          </div>
        </nav>
        {!collapsed ? (
          <PanelResizer label="Resize primary navigation" value={navigationWidth} min={200} max={320} defaultValue={232} onChange={setNavigationWidth} className="v2-navigation-resizer" />
        ) : null}
        <main className="v2-app-stage">
          <div className="v2-project-shell" data-inspector-open={inspector && inspectorOpen ? "true" : "false"}>
            <section className="v2-project-main">
              <header className="v2-project-topbar">
                <div className="v2-breadcrumbs"><span>{routeLabel}</span>{projectName ? <><ChevronRight aria-hidden="true" size={14} /><strong>{projectName}</strong></> : null}</div>
                <div className="v2-topbar-actions">
                  {topbarActions}
                  {inspector && !inspectorOpen ? <Tooltip content="Open sources"><IconButton label="Open sources" variant="ghost" onClick={() => onInspectorOpenChange?.(true)}><PanelRightOpen aria-hidden="true" size={18} /></IconButton></Tooltip> : null}
                </div>
              </header>
              {children}
            </section>
            {inspector && inspectorOpen ? <><PanelResizer edge="left" label="Resize source inspector" value={inspectorWidth} min={360} max={640} defaultValue={400} onChange={setInspectorWidth} className="v2-inspector-resizer max-[980px]:hidden" /><aside ref={inspectorRef} className="v2-inspector" style={{ width: inspectorWidth }} aria-label="Sources used" tabIndex={-1}>{inspector}</aside></> : null}
          </div>
        </main>
        <GlobalFindDialog open={globalFindOpen} onOpenChange={setGlobalFindOpen} />
      </div>
    </TooltipProvider>
  );
}
