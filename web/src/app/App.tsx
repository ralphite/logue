import { useEffect, useState } from "react";
import { api } from "../api";
import { AppShell, ROUTES, type Route } from "./AppShell";
import { DocumentsRoute } from "./DocumentsRoute";
import { FindDialog, type FindTarget } from "./FindDialog";
import { ProjectsRoute } from "./ProjectsRoute";
import { DocumentsRail, ProjectsRail, SkillsRail, StreamRail } from "./Rails";
import { SettingsRoute } from "./SettingsRoute";
import { SkillsRoute } from "./SkillsRoute";
import { StreamRoute } from "./StreamRoute";
import { useHost } from "./useHost";

function isRoute(value: string): value is Route {
  return (ROUTES as readonly string[]).includes(value);
}

function routeFromHash(): Route {
  const value = window.location.hash.replace("#/", "");
  return isRoute(value) ? value : "stream";
}

/**
 * Which route is showing, and what is open inside it.
 *
 * The routes do not own that any more: find can land on a Source, a Document
 * or a Project from anywhere, and something has to be able to say "go there".
 */
export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [documentId, setDocumentId] = useState<string>();
  const [projectId, setProjectId] = useState<string>();
  const [sourceId, setSourceId] = useState<string>();
  const [skillId, setSkillId] = useState<string>();
  const [finding, setFinding] = useState(false);
  const status = useHost(() => api.status(), []);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFinding(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (next: Route) => {
    window.location.hash = `#/${next}`;
    setRoute(next);
  };

  const openDocument = (id: string) => {
    setDocumentId(id);
    go("documents");
  };

  const goTo = (target: FindTarget) => {
    if (target.kind === "document") return openDocument(target.id);
    if (target.kind === "project") {
      setProjectId(target.id);
      return go("projects");
    }
    setSourceId(target.id);
    go("stream");
  };

  // The rail carries the open section's list; the main area carries the one
  // thing chosen from it.
  const list =
    route === "stream" ? (
      <StreamRail selectedId={sourceId} onSelect={setSourceId} />
    ) : route === "projects" ? (
      <ProjectsRail selectedId={projectId} onSelect={setProjectId} />
    ) : route === "documents" ? (
      <DocumentsRail selectedId={documentId} onSelect={setDocumentId} />
    ) : route === "skills" ? (
      <SkillsRail selectedId={skillId} onSelect={setSkillId} />
    ) : undefined;

  return (
    <AppShell
      route={route}
      onRoute={go}
      offline={Boolean(status.error)}
      onFind={() => setFinding(true)}
      list={list}
    >
      {route === "stream" && <StreamRoute openId={sourceId} onOpen={setSourceId} onOpenDocument={openDocument} />}
      {route === "projects" && (
        <ProjectsRoute openId={projectId} onOpen={setProjectId} onOpenDocument={openDocument} />
      )}
      {route === "documents" && <DocumentsRoute openId={documentId} onOpen={setDocumentId} />}
      {route === "skills" && <SkillsRoute openId={skillId} onOpen={setSkillId} />}
      {route === "settings" && <SettingsRoute />}
      <FindDialog open={finding} onClose={() => setFinding(false)} onGo={goTo} />
    </AppShell>
  );
}
