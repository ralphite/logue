import { ChevronRight, FolderKanban, Library, PanelRightOpen, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { IconButton } from "../../components/ui";
import { PanelResizer } from "../../components/PanelResizer";
import { Tooltip, TooltipProvider } from "../../components/Tooltip";
import "../styles/surfaces.css";

export type V2PrimaryRoute = "projects" | "library" | "settings";

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

export function ProjectShell({ route, projectName, projects = [], activeProjectId, onRouteChange, onProjectChange, topbarActions, children, inspector, inspectorOpen = false, onInspectorOpenChange }: ProjectShellProps) {
  const [inspectorWidth, setInspectorWidth] = useState(400);
  return (
    <div className="logue-v2 v2-app-shell">
      <nav className="v2-app-nav" aria-label="Logue">
        <div className="v2-app-brand"><span className="v2-app-wordmark">Logue</span></div>
        <div className="v2-nav-section">
          <button className={`v2-nav-item${route === "projects" ? " is-active" : ""}`} onClick={() => onRouteChange?.("projects")}><FolderKanban aria-hidden="true" size={18} /><span className="v2-nav-label">Projects</span></button>
          {route === "projects" && projects.length ? <div className="v2-project-list">{projects.map((project) => <button key={project.id} className={`v2-project-row${project.id === activeProjectId ? " is-active" : ""}`} onClick={() => onProjectChange?.(project.id)}><span className="v2-nav-label">{project.name}</span></button>)}</div> : null}
          <button className={`v2-nav-item${route === "library" ? " is-active" : ""}`} onClick={() => onRouteChange?.("library")}><Library aria-hidden="true" size={18} /><span className="v2-nav-label">Library</span></button>
        </div>
        <div className="v2-app-nav-spacer" />
        <div className="v2-nav-section">
          <button className={`v2-nav-item${route === "settings" ? " is-active" : ""}`} onClick={() => onRouteChange?.("settings")}><Settings aria-hidden="true" size={18} /><span className="v2-nav-label">Settings</span></button>
        </div>
      </nav>
      <main className="v2-app-stage">
        <div className="v2-project-shell">
          <section className="v2-project-main">
            <header className="v2-project-topbar">
              <div className="v2-breadcrumbs"><span>{route === "projects" ? "Projects" : route === "library" ? "Library" : "Settings"}</span>{projectName ? <><ChevronRight aria-hidden="true" size={14} /><strong>{projectName}</strong></> : null}</div>
              <div className="v2-topbar-actions">
                {topbarActions}
                {inspector && !inspectorOpen ? <TooltipProvider><Tooltip content="Open sources"><IconButton label="Open sources" variant="ghost" onClick={() => onInspectorOpenChange?.(true)}><PanelRightOpen aria-hidden="true" size={18} /></IconButton></Tooltip></TooltipProvider> : null}
              </div>
            </header>
            {children}
          </section>
          {inspector && inspectorOpen ? <><PanelResizer edge="left" label="Resize source inspector" value={inspectorWidth} min={360} max={640} defaultValue={400} onChange={setInspectorWidth} className="max-[980px]:hidden" /><aside className="v2-inspector" style={{ width: inspectorWidth }} aria-label="Sources used">{inspector}</aside></> : null}
        </div>
      </main>
    </div>
  );
}
