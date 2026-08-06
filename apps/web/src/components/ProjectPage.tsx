import { ArrowRight, FolderKanban, Inbox, Plus } from "lucide-react";
import type { Material } from "@logue/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDocuments, getProjects, getWorkspaceSettings, saveProject, type LogueDocument, type ProjectSkillBindings, type ProjectSummary, type WorkspaceSettings } from "../api";
import { getSkills, type LogueSkill } from "../skillApi";
import { pageColumnClass } from "./layout";
import { Button, PageHeader } from "./ui";
import { groupLibraryMaterials } from "../commentBundles";
import { RealProjectWorkspace } from "./RealProjectWorkspace";

type SaveState = "saved" | "dirty" | "saving" | "error";

export function ProjectPage({
  materials,
  initialProject,
  onSelectedProjectChange,
  onOpenStream,
  onOpenMaterial,
  onUpdateMaterialClassification = async () => undefined,
}: {
  materials: Material[];
  initialProject?: string;
  onSelectedProjectChange: (project?: string, replace?: boolean) => void;
  onOpenStream: (project?: string) => void;
  onOpenMaterial: (materialId: string) => void;
  onUpdateMaterialClassification?: (id: string, projects: string[], tags: string[], excludedProjects: string[]) => Promise<void>;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [documents, setDocuments] = useState<LogueDocument[]>([]);
  const [skills, setSkills] = useState<LogueSkill[]>([]);
  const [globalDefaults, setGlobalDefaults] = useState<WorkspaceSettings>({ personal_context: "", glossary: [], ignored_terms: [] });
  const [selectedName, setSelectedName] = useState<string | undefined>(undefined);
  const [overview, setOverview] = useState("");
  const [glossary, setGlossary] = useState<string[]>([]);
  const [skillBindings, setSkillBindings] = useState<ProjectSkillBindings>({});
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const loadedRef = useRef<string | undefined>(undefined);

  async function loadWorkspace() {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [nextProjects, nextDocuments, nextSkills, nextSettings] = await Promise.all([getProjects(), getDocuments(), getSkills(), getWorkspaceSettings()]);
      setProjects(nextProjects);
      setDocuments(nextDocuments);
      setSkills(nextSkills);
      setGlobalDefaults(nextSettings);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Could not load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!initialProject) {
      if (selectedName) {
        loadedRef.current = undefined;
        setSelectedName(undefined);
      }
      return;
    }
    if (projects.some((project) => project.name === initialProject)) {
      if (selectedName !== initialProject) {
        loadedRef.current = undefined;
        setSelectedName(initialProject);
      }
    } else {
      loadedRef.current = undefined;
      setSelectedName(undefined);
      onSelectedProjectChange(undefined, true);
    }
  }, [initialProject, loading, onSelectedProjectChange, projects, selectedName]);

  const selected = projects.find((project) => project.name === selectedName);
  const sourceCountByProject = useMemo(
    () => new Map(projects.map((project) => [
      project.name,
      groupLibraryMaterials(materials.filter((item) => item.projects.includes(project.name)), materials).length,
    ])),
    [materials, projects],
  );

  useEffect(() => {
    if (!selected || loadedRef.current === selected.name) return;
    loadedRef.current = selected.name;
    setOverview(selected.overview ?? "");
    setGlossary(selected.glossary ?? []);
    setSkillBindings(selected.skill_bindings ?? {});
    setSaveState("saved");
  }, [selected]);

  useEffect(() => {
    if (!selected || loadedRef.current !== selected.name || saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void saveProject(selected.name, { overview, glossary, skillBindings })
        .then((updated) => {
          setProjects((current) => current.map((project) => project.name === updated.name ? updated : project));
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [glossary, overview, saveState, selected, skillBindings]);

  function markDirty() {
    if (saveState !== "dirty") setSaveState("dirty");
  }

  async function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const created = await saveProject("", { name, overview: "", glossary: [], skillBindings: {} });
    setProjects((current) => [created, ...current]);
    setNewProjectOpen(false);
    setNewProjectName("");
    loadedRef.current = undefined;
    setSelectedName(created.name);
    onSelectedProjectChange(created.name);
  }

  if (selected) {
    return <RealProjectWorkspace
      project={selected}
      materials={materials}
      documents={documents}
      overview={overview}
      glossary={glossary}
      skills={skills}
      globalDefaults={globalDefaults}
      skillBindings={skillBindings}
      onOverviewChange={(value) => { setOverview(value); markDirty(); }}
      onGlossaryChange={(value) => { setGlossary(value); markDirty(); }}
      onSkillBindingsChange={(value) => { setSkillBindings(value); markDirty(); }}
      onDocumentsChange={setDocuments}
      onOpenMaterial={onOpenMaterial}
      onUpdateMaterialClassification={onUpdateMaterialClassification}
      onBack={() => { setSelectedName(undefined); loadedRef.current = undefined; onSelectedProjectChange(undefined); }}
    />;
  }

  const unfiled = groupLibraryMaterials(materials.filter((item) => item.projects.length === 0), materials).length;
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <PageHeader title="Projects" testId="projects-header-column" actions={<Button variant="primary" size="sm" onClick={() => setNewProjectOpen(true)} className="max-[640px]:h-11"><Plus size={13} /> New project</Button>} />
      <div data-testid="projects-scroll-surface" className="scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div data-testid="projects-content-column" className={`${pageColumnClass} pb-16 pt-8 max-[640px]:pt-5`}>
        {!loading && !loadError && projects.length === 0 ? (
          <section className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#f0f0ed] text-[#71736d]"><FolderKanban size={19} /></span>
            <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[#3f413c]">Create your first project</h2>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => setNewProjectOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[14px] font-medium text-white hover:bg-[#3a3b37]"><Plus size={14} /> New project</button>
              {materials.length === 0 && <button type="button" onClick={() => onOpenStream()} className="h-9 rounded-md px-3 text-[14px] font-medium text-[#686a64] hover:bg-[#f1f1ee]">Add sources first</button>}
            </div>
          </section>
        ) : <div className="mt-6 border-t border-[#e7e7e4] max-[640px]:mt-[15px]">
          <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_44px] gap-3 border-b border-[#e7e7e4] px-3 py-2 text-[14px] font-medium text-[#92938e] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span>Name</span><span>Sources</span><span className="max-[640px]:hidden">Documents</span><span /></div>
          {loading ? <div className="space-y-1 py-2" aria-label="Loading projects">{[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}</div> : loadError ? <div className="py-10 text-center"><p className="text-[15px] text-[#a04b43]">{loadError}</p><button type="button" onClick={() => void loadWorkspace()} className="mt-3 h-8 rounded-md border border-[#d8d8d3] px-3 text-[14px] text-[#62635e] hover:bg-[#f4f4f1]">Reload</button></div> : <>{projects.map((project) => <button key={project.name} type="button" onClick={() => { loadedRef.current = undefined; setSelectedName(project.name); onSelectedProjectChange(project.name); }} className="group grid w-full grid-cols-[minmax(0,1fr)_90px_90px_44px] items-center gap-3 border-b border-[#eeeeeb] px-3 py-3 text-left hover:bg-[#f7f7f5] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-[#f0f0ed] text-[#676863]"><FolderKanban size={14} /></span><span className="min-w-0 truncate text-[15px] font-medium text-[#393a36]">{project.name}</span></span><span className="text-[15px] text-[#82837e]">{sourceCountByProject.get(project.name) ?? 0}</span><span className="text-[15px] text-[#82837e] max-[640px]:hidden">{documents.filter((document) => document.project === project.name).length}</span><ArrowRight size={14} className="text-[#aaa] transition group-hover:translate-x-0.5" /></button>)}<button type="button" onClick={() => onOpenStream()} className="group grid w-full grid-cols-[minmax(0,1fr)_90px_90px_44px] items-center gap-3 border-b border-[#eeeeeb] px-3 py-3 text-left hover:bg-[#f7f7f5] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-[#f0f0ed] text-[#777873]"><Inbox size={14} /></span><span className="block text-[15px] font-medium text-[#393a36]">Unfiled</span></span><span className="text-[15px] text-[#82837e]">{unfiled}</span><span className="text-[15px] text-[#b0b1ad] max-[640px]:hidden">—</span><ArrowRight size={14} className="text-[#aaa]" /></button></>}
        </div>}
      </div>
      </div>
      {newProjectOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20211e]/25 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewProjectOpen(false); }}><form onSubmit={(event) => { event.preventDefault(); void createProject(); }} className="w-full max-w-sm rounded-xl border border-[#deded9] bg-white p-5 shadow-[0_24px_70px_rgba(20,21,18,0.2)]"><h2 className="text-[14px] font-semibold text-[#30312d]">New project</h2><input autoFocus value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name" className="mt-4 h-10 w-full rounded-md border border-[#dcdcd7] px-3 text-[14px] outline-none focus:border-[#aaa]" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setNewProjectOpen(false)} className="h-8 rounded-md px-3 text-[15px] text-[#6d6e69] hover:bg-[#f0f0ed]">Cancel</button><button type="submit" disabled={!newProjectName.trim()} className="h-8 rounded-md bg-[#242522] px-3 text-[15px] font-medium text-white disabled:bg-[#bdbdb8]">Create</button></div></form></div>}
    </main>
  );
}
