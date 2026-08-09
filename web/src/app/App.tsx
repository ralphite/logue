import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { AppShell, DRAFT, ROUTES, type Route } from "./AppShell";
import { DocumentsRoute } from "./DocumentsRoute";
import { FindDialog, type FindTarget } from "./FindDialog";
import { somethingUnsaved, useNewerBuild } from "./freshness";
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

/** Where the URL says we are: a section, and what is open inside it. */
interface Where {
  route: Route;
  id?: string;
}

/**
 * `/documents/doc_1a2b` — the section and the one thing chosen from it.
 *
 * A real path, not a hash: the Host answers every non-file path with the app
 * (http.py), so a deep link survives a reload and reads like an address.
 * Old `#/...` bookmarks still resolve — the first read prefers the hash if
 * one is present, and the URL is then rewritten without it.
 */
function readWhere(): Where {
  const legacy = window.location.hash.replace(/^#\/?/, "");
  const source = legacy || window.location.pathname.replace(/^\/+/, "");
  const [route = "", ...rest] = source.split("/");
  return { route: isRoute(route) ? route : "stream", id: rest.join("/") || undefined };
}

function pathFor(route: Route, id?: string): string {
  return id ? `/${route}/${id}` : `/${route}`;
}

/**
 * A section with nothing chosen opens on a fresh draft, and the address says
 * so (`/skills/new`). The list is already in the rail — a page whose whole
 * message is "pick from the list" made a person click twice for nothing.
 * Stream and Settings are the honest exceptions: their content arrives or
 * is configured, it cannot be "made new".
 */
function normalize(where: Where): Where {
  if (where.id || where.route === "stream" || where.route === "settings") return where;
  return { route: where.route, id: DRAFT };
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
  const first = normalize(readWhere());
  const [route, setRoute] = useState<Route>(first.route);
  const [documentId, setDocumentId] = useState<string | undefined>(
    first.route === "documents" ? first.id : undefined,
  );
  const [projectId, setProjectId] = useState<string | undefined>(
    first.route === "projects" ? first.id : undefined,
  );
  const [sourceId, setSourceId] = useState<string | undefined>(
    first.route === "stream" ? first.id : undefined,
  );
  const [skillId, setSkillId] = useState<string | undefined>(first.route === "skills" ? first.id : undefined);
  const [finding, setFinding] = useState(false);
  const [helping, setHelping] = useState(false);
  const status = useHost(() => api.status(), []);
  // The build the Host is serving, once it stops being the one this page
  // loaded with. See freshness.ts: this page's chunks are deleted by the
  // deploy that replaces them, so an open tab does not age — it breaks.
  const newerBuild = useNewerBuild();
  const [postponed, setPostponed] = useState(false);

  useEffect(() => {
    if (!newerBuild || postponed) return;
    // Nothing of the person's is in the air: just go. Something is: say so
    // and let them press it, because a reload that eats a paragraph is a
    // worse bug than the one it fixes.
    if (!somethingUnsaved()) window.location.reload();
  }, [newerBuild, postponed]);

  // What the rail is showing, in the order it shows it. A ref rather than
  // state: it changes on every filter keystroke and nothing renders from it.
  const order = useRef<string[]>([]);

  /** Put the app where a Where says. The URL is handled by the callers. */
  const apply = useCallback(({ route: next, id }: Where) => {
    setRoute(next);
    if (next === "stream") setSourceId(id);
    else if (next === "projects") setProjectId(id);
    else if (next === "documents") setDocumentId(id);
    else if (next === "skills") setSkillId(id);
  }, []);

  // The URL is the one place that says where we are. Every way of moving —
  // a rail row, ⌘K, the nav, the browser's own Back — goes through the
  // address, and this puts the state back in step when the browser moves it.
  useEffect(() => {
    const onPopState = () => {
      const where = normalize(readWhere());
      const path = pathFor(where.route, where.id);
      // A bare section address is made honest in place — replace, not push,
      // so Back is not padded with corrections.
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
      apply(where);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [apply]);

  // The first address is aligned once: a legacy `#/...` or a bare section
  // becomes the real path it meant, without adding a history entry.
  useEffect(() => {
    const path = pathFor(first.route, first.id);
    if (window.location.pathname !== path || window.location.hash)
      window.history.replaceState(null, "", path);
    // `first` is from the initial render by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Go somewhere. Writing the address is what actually moves the app. */
  const openIn = useCallback(
    (next: Route, id?: string) => {
      const wanted = normalize({ route: next, id });
      const path = pathFor(wanted.route, wanted.id);
      if (window.location.pathname === path) return;
      window.history.pushState(null, "", path);
      // pushState fires no event; the app is moved by hand.
      apply(wanted);
    },
    [apply],
  );

  const openHere = useCallback((id: string) => openIn(readWhere().route, id), [openIn]);

  const here =
    route === "stream"
      ? sourceId
      : route === "projects"
        ? projectId
        : route === "documents"
          ? documentId
          : skillId;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFinding(true);
        return;
      }
      // ⌥⌘↑/↓ steps through the rail. Plain arrows belong to the list you are
      // reading; ⌘↑/↓ belongs to the text you are editing.
      if (
        event.altKey &&
        (event.metaKey || event.ctrlKey) &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
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

  /** The nav. A section reopens whatever was last open in it. */
  const go = (next: Route) => {
    const last = {
      stream: sourceId,
      projects: projectId,
      documents: documentId,
      skills: skillId,
      settings: undefined,
    };
    openIn(next, last[next]);
  };

  const openDocument = (id: string) => openIn("documents", id);

  /** A Source lives in the Stream, wherever it happens to be listed. */
  const openSource = (id: string) => openIn("stream", id);

  const goTo = (target: FindTarget) => {
    if (target.kind === "document") return openDocument(target.id);
    if (target.kind === "project") return openIn("projects", target.id);
    if (target.kind === "skill") return openIn("skills", target.id);
    openSource(target.id);
  };

  const onVisibleOrder = useCallback((ids: string[]) => {
    order.current = ids;
  }, []);

  // Bumped when something is made from the rail's `+`, which is outside the
  // list that has to show it.
  const [made, setMade] = useState(0);

  // Pressing `+` opens an empty one; the Host hears about it at the first
  // keystroke. Pressing it again while a draft is open lands on that draft
  // rather than starting a second.
  const newProject = () => openIn("projects", DRAFT);
  const newDocument = () => openIn("documents", DRAFT);
  const newSkill = () => openIn("skills", DRAFT);

  /** A draft became real: point at it, and let the list go and find it. */
  const born = (next: Route) => (id: string) => {
    openIn(next, id);
    setMade((n) => n + 1);
  };

  // The rail carries the open section's list; the main area carries the one
  // thing chosen from it.
  const list =
    route === "stream" ? (
      <StreamRail
        selectedId={sourceId}
        onSelect={(id) => openIn("stream", id)}
        onVisibleOrder={onVisibleOrder}
      />
    ) : route === "projects" ? (
      <ProjectsRail
        selectedId={projectId}
        onSelect={(id) => openIn("projects", id)}
        onVisibleOrder={onVisibleOrder}
        made={made}
        onNew={newProject}
      />
    ) : route === "documents" ? (
      <DocumentsRail
        selectedId={documentId}
        onSelect={(id) => openIn("documents", id)}
        onVisibleOrder={onVisibleOrder}
        made={made}
        onNew={newDocument}
      />
    ) : route === "skills" ? (
      <SkillsRail
        selectedId={skillId}
        onSelect={(id) => openIn("skills", id)}
        onVisibleOrder={onVisibleOrder}
        made={made}
        onNew={newSkill}
      />
    ) : undefined;

  return (
    <PinsProvider>
      <AppShell
        route={route}
        onRoute={go}
        offline={Boolean(status.error)}
        onFind={() => setFinding(true)}
        onNew={{
          projects: newProject,
          documents: newDocument,
          skills: newSkill,
        }}
        list={list}
      >
        {route === "stream" && (
          <StreamRoute
            openId={sourceId}
            onOpen={(id) => openIn("stream", id)}
            onOpenDocument={openDocument}
          />
        )}
        {route === "projects" && (
          <ProjectsRoute
            openId={projectId}
            onOpen={(id) => openIn("projects", id)}
            onOpenDocument={openDocument}
            onOpenSource={openSource}
            onCreated={born("projects")}
          />
        )}
        {route === "documents" && (
          <DocumentsRoute
            openId={documentId}
            onOpen={(id) => openIn("documents", id)}
            onCreated={born("documents")}
            onOpenSource={openSource}
          />
        )}
        {route === "skills" && (
          <SkillsRoute openId={skillId} onOpen={(id) => openIn("skills", id)} onCreated={born("skills")} />
        )}
        {route === "settings" && <SettingsRoute />}
        {newerBuild && (
          <div
            role="status"
            className="fixed inset-x-0 bottom-0 z-popover flex items-center justify-center gap-2 border-t border-line bg-surface px-3 py-2 text-[13px] text-ink shadow-lg"
          >
            <span>A newer Logue is ready. This page is running the previous one.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-accent px-2 py-1 text-xs font-[560] text-white hover:bg-accent-hover"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => setPostponed(true)}
              className="rounded-md px-2 py-1 text-xs text-muted hover:bg-hover hover:text-ink"
            >
              Not yet
            </button>
          </div>
        )}
        <FindDialog open={finding} onClose={() => setFinding(false)} onGo={goTo} />
        <ShortcutsDialog open={helping} onClose={() => setHelping(false)} />
      </AppShell>
    </PinsProvider>
  );
}
