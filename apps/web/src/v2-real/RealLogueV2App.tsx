import type { Material } from "@logue/ui";
import {
  PanelRightClose,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDocuments,
  getMaterials,
  getProjects,
  getSkillRuns,
  getStatus,
  getWorkspaceSettings,
  updateMaterial,
  type LogueDocument,
  type ProjectSummary,
  type ServiceStatus,
  type SkillRun,
  type WorkspaceSettings,
} from "../api";
import { groupLibraryMaterials, type LibraryMaterialGroup } from "../commentBundles";
import {
  getSkills,
  type LogueSkill,
} from "../skillApi";
import { Button, IconButton } from "../components/ui";
import { OriginLabel, type OriginLabelType } from "../v2-mock/primitives/OriginLabel";
import { ProjectShell, type V2PrimaryRoute } from "../v2-mock/web/ProjectShell";
import { SettingsRoute } from "./SettingsRoute";
import { V2ProjectRoute } from "./V2ProjectRoute";
import { V2SkillsRoute } from "./V2SkillsRoute";
import { V2DocumentsRoute } from "./V2DocumentsRoute";
import { V2LibraryRoute } from "./V2LibraryRoute";
import { V2SetupRoute } from "./V2SetupRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import "../v2-mock/styles/surfaces.css";

type LibraryTab = "saved" | "activity";

function routeFromLocation(): V2PrimaryRoute {
  const value = new URLSearchParams(window.location.search).get("view");
  if (value === "projects" || value === "documents" || value === "skills" || value === "settings") return value;
  if (value === "stream" || value === "library") return "library";
  return "projects";
}

function sourceOrigin(material: Material): OriginLabelType {
  if (material.actor && material.actor.toLowerCase() !== "user") return "ai";
  if (material.kind === "selection") return "web";
  return "you";
}

function materialTitle(material: Material) {
  return material.source?.title?.trim()
    || material.source?.domain?.trim()
    || (material.kind === "voice" ? "Voice input" : material.kind === "selection" ? "Saved selection" : "Saved note");
}

function groupCopy(group: LibraryMaterialGroup) {
  return group.bundle?.primaryComment.content.trim()
    || group.representative.content.trim();
}

function groupTitle(group: LibraryMaterialGroup) {
  return group.bundle ? materialTitle(group.bundle.source) : materialTitle(group.representative);
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function V2Empty({ children }: { children: string }) {
  return <div className="v2-recovery-card"><p>{children}</p></div>;
}

function MaterialInspector({ group, projects, onClose, onRefresh }: { group: LibraryMaterialGroup; projects: ProjectSummary[]; onClose: () => void; onRefresh: () => Promise<void> }) {
  const primary = group.bundle?.primaryComment ?? group.representative;
  const source = group.bundle?.source;
  const currentProject = projects.find((project) => group.projects.includes(project.name));
  const updateBundle = async (changes: Parameters<typeof updateMaterial>[1]) => {
    await Promise.all(group.items.map((item) => updateMaterial(item.id, changes)));
    await onRefresh();
  };
  return <>
    <header className="v2-inspector-header"><h2>Source</h2><IconButton label="Close source" variant="ghost" onClick={onClose}><PanelRightClose aria-hidden="true" size={17} /></IconButton></header>
    <div className="v2-inspector-scroll">
      <article className="v2-source-bundle is-active">
        <OriginLabel origin={sourceOrigin(primary)} detail={group.bundle ? "Comment bundle" : primary.kind === "voice" ? "Voice input" : "Saved content"} />
        <div className="v2-source-heading"><h3>{groupTitle(group)}</h3></div>
        <div className="v2-source-comment"><OriginLabel origin="you" detail={primary.captureId ? "Original voice retained" : "Saved text"} /><p>{groupCopy(group)}</p></div>
        {source ? <div className="v2-source-excerpt is-expanded"><OriginLabel origin="web" detail="Original evidence" /><p>{source.content}</p></div> : null}
        <div className="v2-source-meta">{shortDate(primary.createdAt)} · {primary.source?.domain || "This Mac"}</div>
      </article>
      <section className="v2-settings-section">
        <h2>Project context</h2>
        <div className="v2-setting-row"><div><strong>{currentProject?.name ?? "Saved only"}</strong><p>{currentProject ? "Included in this Project Context." : "Private in Library; not used by a Project."}</p></div><div className="v2-inline-actions">
          {currentProject ? <Button size="sm" onClick={() => void updateBundle({ projects: [], savedOnlyProjects: [currentProject.name] })}>Remove</Button> : projects[0] ? <Button size="sm" variant="primary" onClick={() => void updateBundle({ projects: [projects[0].name], excludedProjects: [], savedOnlyProjects: [] })}>Add</Button> : null}
          {projects[0] ? <Button size="sm" onClick={() => void updateBundle({ projects: [], excludedProjects: [projects[0].name], savedOnlyProjects: [] })}>Exclude</Button> : null}
        </div></div>
      </section>
    </div>
  </>;
}

function LibraryRoute({ materials, runs, projects, onRoute, onRefresh }: { materials: Material[]; runs: SkillRun[]; projects: ProjectSummary[]; onRoute: (route: V2PrimaryRoute) => void; onRefresh: () => Promise<void> }) {
  const [tab, setTab] = useState<LibraryTab>("saved");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string>();
  const groups = useMemo(() => groupLibraryMaterials(
    materials.filter((item) => !item.activityType && `${materialTitle(item)} ${item.content} ${item.projects.join(" ")} ${item.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())),
    materials,
  ), [materials, query]);
  const openGroup = groups.find((group) => group.key === openKey);
  const activityMaterials = materials.filter((item) => Boolean(item.activityType));
  return <ProjectShell route="library" onRouteChange={onRoute} inspectorOpen={Boolean(openGroup)} onInspectorOpenChange={(open) => { if (!open) setOpenKey(undefined); }} inspector={openGroup ? <MaterialInspector group={openGroup} projects={projects} onClose={() => setOpenKey(undefined)} onRefresh={onRefresh} /> : undefined}>
    <div className="v2-editor-scroll"><div className="v2-list-axis">
      <div className="v2-page-heading"><div className="v2-page-heading-copy"><h1>Library</h1><p>Everything you capture stays private on this Host until you delete it.</p></div></div>
      <div className="v2-segmented" role="tablist" aria-label="Library content"><button role="tab" aria-selected={tab === "saved"} className={tab === "saved" ? "is-active" : ""} onClick={() => setTab("saved")}>Saved content</button><button role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "is-active" : ""} onClick={() => setTab("activity")}>All activity</button></div>
      <div className="v2-filter-row" style={{ marginTop: 18 }}><label className="v2-search-field"><Search aria-hidden="true" size={17} /><span className="sr-only">Find saved content</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find by words, project, site, or topic" /></label><IconButton label="Filter library" variant="secondary"><SlidersHorizontal aria-hidden="true" size={16} /></IconButton></div>
      {tab === "saved" ? <div className="v2-library-list">{groups.map((group) => {
        const material = group.bundle?.primaryComment ?? group.representative;
        return <article className="v2-library-row" key={group.key}><button type="button" className="v2-skill-row-main" onClick={() => setOpenKey(group.key)}><OriginLabel origin={group.bundle ? "you" : sourceOrigin(material)} detail={group.bundle ? "Web + You" : material.kind === "voice" ? "Voice" : "Saved"} /><h3>{groupTitle(group)}</h3><p>{groupCopy(group)}</p><div className="v2-library-meta">{shortDate(material.createdAt)} · {material.source?.domain || "This Mac"}{group.projects.length ? ` · ${group.projects.join(", ")}` : " · Saved only"}</div></button><Button size="sm" onClick={() => setOpenKey(group.key)}>Open</Button></article>;
      })}{groups.length === 0 ? <V2Empty>No saved content matches this search.</V2Empty> : null}</div> : <div className="v2-review-list">{activityMaterials.map((item) => <article className="v2-review-row" key={item.id}><div><OriginLabel origin="you" detail={item.activityType === "voice-command" ? "Voice Command" : "Command"} /><h3>{materialTitle(item)}</h3><p>{item.content}</p><div className="v2-library-meta">{shortDate(item.createdAt)} · Activity only · never added to Project Context</div></div></article>)}{runs.map((run) => <article className="v2-review-row" key={run.id}><div><OriginLabel origin="ai" detail={run.status} /><h3>{run.skill_name}</h3><p>{run.instruction}</p><div className="v2-library-meta">{shortDate(run.created_at)} · {run.sources.length} actual sources{run.adopted_output ? " · adopted" : ""}</div></div></article>)}{runs.length === 0 && activityMaterials.length === 0 ? <V2Empty>No activity yet.</V2Empty> : null}</div>}
    </div></div>
  </ProjectShell>;
}

export function RealLogueV2App() {
  const [route, setRoute] = useState<V2PrimaryRoute>(routeFromLocation);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [documents, setDocuments] = useState<LogueDocument[]>([]);
  const [skills, setSkills] = useState<LogueSkill[]>([]);
  const [runs, setRuns] = useState<SkillRun[]>([]);
  const [status, setStatus] = useState<ServiceStatus>();
  const [settings, setSettings] = useState<WorkspaceSettings>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [nextMaterials, nextProjects, nextDocuments, nextSkills, nextRuns, nextStatus, nextSettings] = await Promise.all([getMaterials(), getProjects(), getDocuments(), getSkills(), getSkillRuns(), getStatus(), getWorkspaceSettings()]);
      setMaterials(nextMaterials); setProjects(nextProjects); setDocuments(nextDocuments); setSkills(nextSkills); setRuns(nextRuns); setStatus(nextStatus); setSettings(nextSettings); setError(undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reach the Logue Host."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const listener = () => setRoute(routeFromLocation()); window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); }, []);
  const navigate = useCallback((next: V2PrimaryRoute) => { const url = new URL(window.location.href); url.searchParams.set("view", next === "library" ? "stream" : next); window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`); setRoute(next); }, []);

  if (error) return <ProjectShell route={route} onRouteChange={navigate}><div className="v2-editor-scroll"><div className="v2-list-axis"><div className="v2-page-heading-copy"><h1>Logue Host</h1><p>Your interface is ready, but the local Host needs attention.</p></div><div className="v2-recovery-card"><p>{error}</p><Button variant="primary" onClick={() => void refresh()}>Retry</Button></div></div></div></ProjectShell>;
  const hasExplicitLocalRoute = new URLSearchParams(window.location.search).has("view");
  if (status && !status.ai_configured && !hasExplicitLocalRoute) {
    return <V2SetupRoute status={status} onReady={refresh} onBrowseLocal={() => navigate("library")} />;
  }
  const content = route === "projects"
    ? <V2ProjectRoute projects={projects} materials={materials} documents={documents} runs={runs} skills={skills} settings={settings} aiReady={Boolean(status?.ai_configured)} loading={loading} onRoute={navigate} onRefresh={refresh} />
    : route === "documents"
      ? <V2DocumentsRoute documents={documents} projects={projects} materials={materials} skills={skills} aiReady={Boolean(status?.ai_configured)} loading={loading} onRoute={navigate} onRefresh={refresh} />
      : route === "skills"
        ? <V2SkillsRoute skills={skills} settings={settings} onRoute={navigate} onRefresh={refresh} />
        : route === "settings"
          ? <SettingsRoute status={status} settings={settings} projects={projects} skills={skills} runs={runs} onRoute={navigate} onRefresh={refresh} />
          : <V2LibraryRoute materials={materials} runs={runs} projects={projects} documents={documents} loading={loading} onRoute={navigate} onRefresh={refresh} />;
  return <RouteErrorBoundary resetKey={`${route}:${window.location.search}`} route={route} onRoute={navigate}>{content}</RouteErrorBoundary>;
}
