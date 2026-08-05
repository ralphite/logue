import { useState } from "react";
import { useMockSession } from "../runtime/MockSessionProvider";
import { LibraryView } from "./LibraryView";
import { ContextReview } from "./ContextReview";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { SettingsView } from "./SettingsView";
import type { SettingsSection } from "./SettingsView";
import type { SkillSettingsView } from "./SkillSettings";
import type { V2PrimaryRoute } from "./ProjectShell";

export function LogueWebApp({ initialRoute = "projects", initialLibraryView = "saved", initialLibrarySourceId, initialLibraryCandidateId, initialSettingsSection = "Host", initialSkillsView = "Built-ins", initialProjectSkillsOpen = false }: { initialRoute?: V2PrimaryRoute; initialLibraryView?: "saved" | "activity"; initialLibrarySourceId?: string; initialLibraryCandidateId?: string; initialSettingsSection?: SettingsSection; initialSkillsView?: SkillSettingsView; initialProjectSkillsOpen?: boolean }) {
  const { state, dispatch } = useMockSession();
  const [route, setRoute] = useState<V2PrimaryRoute>(initialRoute);
  const [contextOpen, setContextOpen] = useState(false);
  const [librarySourceId, setLibrarySourceId] = useState<string | undefined>(initialLibrarySourceId);
  const activeTabId = state.surface.activeTabId;
  const changeProject = (projectId: string) => dispatch({ type: "set-tab-project", tabId: activeTabId, projectId });
  const changeRoute = (nextRoute: V2PrimaryRoute) => { setContextOpen(false); setRoute(nextRoute); };
  if (contextOpen) return <ContextReview onRouteChange={changeRoute} onBack={() => setContextOpen(false)} onOpenSource={(sourceId) => { setLibrarySourceId(sourceId); setContextOpen(false); setRoute("library"); }} />;
  if (route === "library") return <LibraryView onRouteChange={changeRoute} initialView={initialLibraryView} initialSourceId={librarySourceId} initialCandidateId={initialLibraryCandidateId} />;
  if (route === "settings") return <SettingsView onRouteChange={setRoute} initialSection={initialSettingsSection} initialSkillsView={initialSkillsView} />;
  return <ProjectWorkspace onRouteChange={changeRoute} onProjectChange={changeProject} onOpenContext={() => setContextOpen(true)} initialProjectSkillsOpen={initialProjectSkillsOpen} />;
}
