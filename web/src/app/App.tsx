import { useEffect, useState } from "react";
import { api } from "../api";
import { AppShell, ROUTES, type Route } from "./AppShell";
import { DocumentsRoute } from "./DocumentsRoute";
import { ProjectsRoute } from "./ProjectsRoute";
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

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [documentId, setDocumentId] = useState<string>();
  const status = useHost(() => api.status(), []);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const go = (next: Route) => {
    window.location.hash = `#/${next}`;
    setRoute(next);
  };

  const openDocument = (id: string) => {
    setDocumentId(id);
    go("documents");
  };

  return (
    <AppShell
      route={route}
      onRoute={go}
      status={
        status.error ? (
          <p className="px-2 py-1 text-[11px] leading-[1.4] text-warning">Logue is not running on this Mac.</p>
        ) : null
      }
    >
      {route === "stream" && <StreamRoute />}
      {route === "projects" && <ProjectsRoute onOpenDocument={openDocument} />}
      {route === "documents" && <DocumentsRoute openId={documentId} onOpen={setDocumentId} />}
      {route === "skills" && <SkillsRoute />}
      {route === "settings" && <SettingsRoute />}
    </AppShell>
  );
}
