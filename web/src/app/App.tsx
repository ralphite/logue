import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { AppShell, ROUTES, type Route } from "./AppShell";
import { DocumentsRoute } from "./DocumentsRoute";
import { FindDialog, type FindTarget } from "./FindDialog";
import { PinsProvider } from "./pins";
import { ProjectsRoute } from "./ProjectsRoute";
import { DocumentsRail, ProjectsRail, SkillsRail, StreamRail } from "./Rails";
import { SettingsRoute } from "./SettingsRoute";
import { ShortcutsDialog } from "./ShortcutsDialog";
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

/** A key that belongs to whatever is being typed into, not to the app. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
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
  const [helping, setHelping] = useState(false);
  const status = useHost(() => api.status(), []);

  // What the rail is showing, in the order it shows it. A ref rather than
  // state: it changes on every filter keystroke and nothing renders from it.
  const order = useRef<string[]>([]);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openHere = useCallback(
    (id: string) => {
      if (route === "stream") setSourceId(id);
      else if (route === "projects") setProjectId(id);
      else if (route === "documents") setDocumentId(id);
      else if (route === "skills") setSkillId(id);
    },
    [route],
  );

  const here = route === "stream" ? sourceId : route === "projects" ? projectId : route === "documents" ? documentId : skillId;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFinding(true);
        return;
      }
      // ⌥⌘↑/↓ steps through the rail. Plain arrows belong to the list you are
      // reading; ⌘↑/↓ belongs to the text you are editing.
      if (event.altKey && (event.metaKey || event.ctrlKey) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        const ids = order.current;
        if (ids.length === 0) return;
        event.preventDefault();
        const at = here ? ids.indexOf(here) : -1;
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = ids[(at + step + ids.length) % ids.length];
        if (next) openHere(next);
        return;
      }
      if (event.key === "?" && !typing(event.target)) {
        event.preventDefault();
        setHelping(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [here, openHere]);

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

  const onVisibleOrder = useCallback((ids: string[]) => {
    order.current = ids;
  }, []);

  // Bumped when something is made from the rail's `+`, which is outside the
  // list that has to show it.
  const [made, setMade] = useState(0);

  const newProject = async () => {
    const { project } = await api.createProject("New Project", "");
    setProjectId(project.id);
    setMade((n) => n + 1);
    go("projects");
  };

  const newDocument = async () => {
    const { document } = await api.createDocument({});
    setDocumentId(document.id);
    setMade((n) => n + 1);
    go("documents");
  };

  // The rail carries the open section's list; the main area carries the one
  // thing chosen from it.
  const list =
    route === "stream" ? (
      <StreamRail selectedId={sourceId} onSelect={setSourceId} onVisibleOrder={onVisibleOrder} />
    ) : route === "projects" ? (
      <ProjectsRail selectedId={projectId} onSelect={setProjectId} onVisibleOrder={onVisibleOrder} made={made} />
    ) : route === "documents" ? (
      <DocumentsRail selectedId={documentId} onSelect={setDocumentId} onVisibleOrder={onVisibleOrder} made={made} />
    ) : route === "skills" ? (
      <SkillsRail selectedId={skillId} onSelect={setSkillId} onVisibleOrder={onVisibleOrder} />
    ) : undefined;

  return (
    <PinsProvider>
      <AppShell
        route={route}
        onRoute={go}
        offline={Boolean(status.error)}
        onFind={() => setFinding(true)}
        onNew={{ projects: () => void newProject(), documents: () => void newDocument() }}
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
        <ShortcutsDialog open={helping} onClose={() => setHelping(false)} />
      </AppShell>
    </PinsProvider>
  );
}
