import { useState } from "react";
import { useMockSession } from "../runtime/MockSessionProvider";
import { LibraryView } from "./LibraryView";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { SettingsView } from "./SettingsView";
import type { SettingsSection } from "./SettingsView";
import type { V2PrimaryRoute } from "./ProjectShell";

export function LogueWebApp({ initialRoute = "projects", initialLibraryView = "saved", initialLibrarySourceId, initialLibraryCandidateId, initialSettingsSection = "Host" }: { initialRoute?: V2PrimaryRoute; initialLibraryView?: "saved" | "activity"; initialLibrarySourceId?: string; initialLibraryCandidateId?: string; initialSettingsSection?: SettingsSection }) {
  const { state, dispatch } = useMockSession();
  const [route, setRoute] = useState<V2PrimaryRoute>(initialRoute);
  const activeTabId = state.surface.activeTabId;
  const changeProject = (projectId: string) => dispatch({ type: "set-tab-project", tabId: activeTabId, projectId });
  if (route === "library") return <LibraryView onRouteChange={setRoute} initialView={initialLibraryView} initialSourceId={initialLibrarySourceId} initialCandidateId={initialLibraryCandidateId} />;
  if (route === "settings") return <SettingsView onRouteChange={setRoute} initialSection={initialSettingsSection} />;
  return <ProjectWorkspace onRouteChange={setRoute} onProjectChange={changeProject} />;
}
