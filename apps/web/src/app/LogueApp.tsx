import type { Material } from "@logue/ui";
import { useCallback, useEffect, useState } from "react";
import {
  getDocuments,
  getMaterials,
  getProjects,
  getSkillRuns,
  getStatus,
  getWorkspaceSettings,
  type LogueDocument,
  type ProjectSummary,
  type ServiceStatus,
  type SkillRun,
  type WorkspaceSettings,
} from "../lib/api";
import {
  getSkills,
  type LogueSkill,
} from "../lib/skillApi";
import { Button } from "../ui/Button";
import { AppShell, type PrimaryRoute } from "./AppShell";
import { SettingsRoute } from "./SettingsRoute";
import { ProjectRoute } from "./ProjectRoute";
import { SkillsRoute } from "./SkillsRoute";
import { DocumentsRoute } from "./DocumentsRoute";
import { LibraryRoute } from "./LibraryRoute";
import { SetupRoute } from "./SetupRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { Card, CardText, PageAxis, PageHeading, PageScroll } from "./layout";

function routeFromLocation(): PrimaryRoute {
  const value = new URLSearchParams(window.location.search).get("view");
  if (value === "projects" || value === "documents" || value === "skills" || value === "settings") return value;
  if (value === "library") return "library";
  return "projects";
}

export function LogueApp() {
  const [route, setRoute] = useState<PrimaryRoute>(routeFromLocation);
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
  const navigate = useCallback((next: PrimaryRoute) => { const url = new URL(window.location.href); url.searchParams.set("view", next); window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`); setRoute(next); }, []);

  if (error) {
    return (
      <AppShell route={route} onRouteChange={navigate}>
        <PageScroll>
          <PageAxis>
            <PageHeading title="Logue Host" lead="Your interface is ready, but the local Host needs attention." />
            <Card>
              <CardText>{error}</CardText>
              <div className="mt-3"><Button variant="primary" onClick={() => void refresh()}>Retry</Button></div>
            </Card>
          </PageAxis>
        </PageScroll>
      </AppShell>
    );
  }
  const hasExplicitLocalRoute = new URLSearchParams(window.location.search).has("view");
  if (status && !status.overall_ready && !hasExplicitLocalRoute) {
    return <SetupRoute status={status} onReady={refresh} onBrowseLocal={() => navigate("library")} />;
  }
  const content = route === "projects"
    ? <ProjectRoute projects={projects} materials={materials} documents={documents} runs={runs} skills={skills} settings={settings} aiReady={Boolean(status?.generation_ready)} loading={loading} onRoute={navigate} onRefresh={refresh} />
    : route === "documents"
      ? <DocumentsRoute documents={documents} projects={projects} materials={materials} skills={skills} aiReady={Boolean(status?.generation_ready)} loading={loading} onRoute={navigate} onRefresh={refresh} />
      : route === "skills"
        ? <SkillsRoute skills={skills} settings={settings} onRoute={navigate} onRefresh={refresh} />
        : route === "settings"
          ? <SettingsRoute status={status} settings={settings} projects={projects} skills={skills} runs={runs} onRoute={navigate} onRefresh={refresh} />
          : <LibraryRoute materials={materials} runs={runs} projects={projects} documents={documents} loading={loading} onRoute={navigate} onRefresh={refresh} />;
  return <RouteErrorBoundary resetKey={`${route}:${window.location.search}`} route={route} onRoute={navigate}>{content}</RouteErrorBoundary>;
}
