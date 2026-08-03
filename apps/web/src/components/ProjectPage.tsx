import { ArrowLeft, ArrowRight, BookOpenText, FilePlus2, FileText, FolderKanban, Inbox, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import type { Material } from "@logue/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { createDocument, generateProjectOverviewDraft, getDocuments, getProjects, saveProject, type LogueDocument, type ProjectSummary } from "../api";
import { editorColumnClass, pageColumnClass } from "./layout";
import { Button, ContextHeader, PageHeader } from "./ui";

type SaveState = "saved" | "dirty" | "saving" | "error";

export function ProjectPage({
  materials,
  initialProject,
  onSelectedProjectChange,
  onOpenStream,
  onOpenMaterial,
  onOpenResults,
}: {
  materials: Material[];
  initialProject?: string;
  onSelectedProjectChange: (project?: string, replace?: boolean) => void;
  onOpenStream: (project?: string) => void;
  onOpenMaterial: (materialId: string) => void;
  onOpenResults: (project: string, documentId?: string) => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [documents, setDocuments] = useState<LogueDocument[]>([]);
  const [selectedName, setSelectedName] = useState<string | undefined>(undefined);
  const [overview, setOverview] = useState("");
  const [glossary, setGlossary] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [overviewDraft, setOverviewDraft] = useState("");
  const [draftSourceCount, setDraftSourceCount] = useState(0);
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draftError, setDraftError] = useState<string>();
  const [creatingDocument, setCreatingDocument] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const loadedRef = useRef<string | undefined>(undefined);

  async function loadWorkspace() {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [nextProjects, nextDocuments] = await Promise.all([getProjects(), getDocuments()]);
      setProjects(nextProjects);
      setDocuments(nextDocuments);
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
  const linkedMaterials = useMemo(
    () => (selectedName ? materials.filter((material) => material.projects.includes(selectedName)) : []),
    [materials, selectedName],
  );
  const linkedDocuments = useMemo(
    () => (selectedName ? documents.filter((document) => document.project === selectedName) : []),
    [documents, selectedName],
  );

  useEffect(() => {
    if (!selected || loadedRef.current === selected.name) return;
    loadedRef.current = selected.name;
    setOverview(selected.overview ?? "");
    setGlossary(selected.glossary ?? []);
    setSaveState("saved");
  }, [selected]);

  useEffect(() => {
    if (!selected || loadedRef.current !== selected.name || saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void saveProject(selected.name, { overview, glossary })
        .then((updated) => {
          setProjects((current) => current.map((project) => project.name === updated.name ? updated : project));
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [glossary, overview, saveState, selected]);

  function markDirty() {
    if (saveState !== "dirty") setSaveState("dirty");
  }

  function addTerm() {
    const value = term.trim();
    if (!value || glossary.includes(value)) return;
    setGlossary((current) => [...current, value]);
    setTerm("");
    markDirty();
  }

  async function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const created = await saveProject("", { name, overview: "", glossary: [] });
    setProjects((current) => [created, ...current]);
    setNewProjectOpen(false);
    setNewProjectName("");
    loadedRef.current = undefined;
    setSelectedName(created.name);
    onSelectedProjectChange(created.name);
  }

  async function createOverviewDraft() {
    if (!selected || draftGenerating) return;
    setDraftGenerating(true);
    setDraftError(undefined);
    try {
      const result = await generateProjectOverviewDraft(selected.name);
      setOverviewDraft(result.draft);
      setDraftSourceCount(result.source_ids.length);
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : "Could not draft a project overview");
    } finally {
      setDraftGenerating(false);
    }
  }

  async function createProjectDocument() {
    if (!selected || creatingDocument) return;
    setCreatingDocument(true);
    try {
      const created = await createDocument({ title: `${selected.name} document`, project: selected.name });
      setDocuments((current) => [created, ...current]);
      onOpenResults(selected.name, created.id);
    } finally {
      setCreatingDocument(false);
    }
  }

  if (selected) {
    return (
      <main className="scroll-surface min-w-0 flex-1 overflow-y-auto bg-white">
        <ContextHeader
          testId="project-detail-header-column"
          leading={<Button variant="ghost" size="sm" onClick={() => { setSelectedName(undefined); loadedRef.current = undefined; onSelectedProjectChange(undefined); }}><ArrowLeft size={14} /> All projects</Button>}
          actions={saveState === "error" ? <span className="text-[14px] text-[#a84d44]">Save failed</span> : undefined}
        />
        <div data-testid="project-detail-content-column" className={`${editorColumnClass} pb-24 pt-14`}>
          <div className="inline-flex size-11 items-center justify-center rounded-md bg-[#f0f0ed] text-[#666762]"><FolderKanban size={21} /></div>
          <h1 className="mt-5 text-[38px] font-bold tracking-[-0.045em] text-[#242522]">{selected.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[#8b8c87]"><span>{linkedMaterials.length} materials</span><span className="text-[#b8b9b4]">·</span><span>{linkedDocuments.length} documents</span><span className="text-[#b8b9b4]">·</span><span>{glossary.length} project terms</span></div>

          <section className="mt-10">
            <div className="flex items-center justify-between gap-3"><h2 className="text-[14px] font-semibold text-[#555651]">Project context</h2><button type="button" onClick={() => void createOverviewDraft()} disabled={draftGenerating || linkedMaterials.length === 0} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[14px] font-medium text-[#676863] hover:bg-[#f1f1ee] disabled:opacity-40">{draftGenerating ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />}{draftGenerating ? "Updating…" : "Update from materials"}</button></div>
            <textarea value={overview} onChange={(event) => { setOverview(event.target.value); markDirty(); }} placeholder="Capture the background, decisions, constraints, and goals…" className="mt-3 min-h-36 w-full resize-y rounded-md border border-transparent bg-[#f7f7f5] px-3.5 py-3 text-[15px] leading-6 text-[#3e3f3b] outline-none placeholder:text-[#b3b4af] focus:border-[#d8d8d3] focus:bg-white" />
            {draftError && <p className="mt-2 rounded-md bg-[#f9ece9] px-3 py-2 text-[14px] text-[#a24a42]">{draftError}</p>}
            {overviewDraft && <div className="mt-3 rounded-md bg-[#fafaf8] p-3.5"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#64655f]"><Sparkles size={12} /> Draft to review</span><span className="text-[14px] text-[#999a95]">Based on {draftSourceCount} materials</span></div><pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-[15px] leading-5 text-[#555651]">{overviewDraft}</pre><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOverviewDraft("")} className="h-7 rounded px-2 text-[14px] text-[#858680] hover:bg-[#eeeeeb]">Discard</button><button type="button" onClick={() => { setOverview((current) => [current.trim(), overviewDraft.trim()].filter(Boolean).join("\n\n")); setOverviewDraft(""); markDirty(); }} className="h-7 rounded bg-[#242522] px-2.5 text-[14px] font-medium text-white">Add to overview</button></div></div>}
          </section>

          <section className="mt-11">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-[#555651]">Documents</h2>
              <div className="flex shrink-0 items-center gap-1">
                {linkedDocuments.length > 0 && <button type="button" onClick={() => onOpenResults(selected.name)} className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[15px] font-medium text-[#62635e] hover:bg-[#f1f1ee]">View all <ArrowRight size={13} /></button>}
                <button type="button" onClick={() => void createProjectDocument()} disabled={creatingDocument} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#242522] px-2.5 text-[14px] font-medium text-white disabled:bg-[#bdbdb8]"><FilePlus2 size={12} /> {creatingDocument ? "Creating…" : "New document"}</button>
              </div>
            </div>
            {linkedDocuments.length > 0 ? <div className="mt-3 divide-y divide-[#eeeeeb]">{linkedDocuments.slice(0, 5).map((document) => <button key={document.id} type="button" onClick={() => onOpenResults(selected.name, document.id)} className="group flex w-full items-center gap-2.5 px-2 py-2.5 text-left hover:bg-[#f7f7f5]"><BookOpenText size={14} className="shrink-0 text-[#858680]" /><span className="min-w-0 flex-1 truncate text-[14px] text-[#50514d]">{document.title || "Untitled"}</span><span className="text-[14px] text-[#999a95]">{new Date(document.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><ArrowRight size={13} className="text-[#b1b2ad] transition group-hover:translate-x-0.5" /></button>)}</div> : <button type="button" onClick={() => void createProjectDocument()} className="mt-3 flex w-full items-center gap-2.5 rounded-md border border-dashed border-[#d7d7d2] px-3 py-4 text-left text-[15px] text-[#858680] hover:bg-[#fafaf8]"><BookOpenText size={15} /> Create the first project document</button>}
          </section>

          <section className="mt-11">
            <div className="flex items-center justify-between"><h2 className="text-[14px] font-semibold text-[#555651]">Materials</h2><button type="button" onClick={() => onOpenStream(selected.name)} className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[15px] font-medium text-[#62635e] hover:bg-[#f1f1ee]">View all <ArrowRight size={13} /></button></div>
            <div className="mt-3 divide-y divide-[#eeeeeb]">{linkedMaterials.slice(0, 6).map((material) => <button key={material.id} type="button" onClick={() => onOpenMaterial(material.id)} className="flex min-h-11 w-full items-center gap-2.5 px-2 py-2.5 text-left hover:bg-[#f7f7f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5b64f4]"><FileText size={14} className="shrink-0 text-[#858680]" /><span className="min-w-0 flex-1 truncate text-[14px] text-[#50514d]">{material.content}</span><span className="text-[14px] text-[#999a95]">{material.source?.domain || material.kind}</span></button>)}</div>
          </section>

          <section className="mt-11">
            <h2 className="text-[14px] font-semibold text-[#555651]">Terms</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">{glossary.map((value) => <span key={value} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#f0f0ed] px-2.5 text-[15px] text-[#555651]">{value}<button type="button" onClick={() => { setGlossary((current) => current.filter((item) => item !== value)); markDirty(); }} className="text-[#999a95] hover:text-[#555]" aria-label={`Remove ${value}`}><X size={11} /></button></span>)}</div>
            <div className="mt-3 flex max-w-md gap-2"><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTerm(); } }} placeholder="Add a term and press Enter" className="h-9 min-w-0 flex-1 rounded-md border border-[#dfdfda] px-3 text-[14px] outline-none focus:border-[#aaa]" /><button type="button" onClick={addTerm} disabled={!term.trim()} className="h-9 rounded-md border border-[#dadad6] px-3 text-[15px] font-medium text-[#61625d] hover:bg-[#f4f4f1] disabled:opacity-40">Add</button></div>
          </section>
        </div>
      </main>
    );
  }

  const unfiled = materials.filter((item) => item.projects.length === 0).length;
  return (
    <main className="scroll-surface min-w-0 flex-1 overflow-y-auto bg-white">
      <PageHeader title="Projects" testId="projects-header-column" actions={<Button variant="primary" size="sm" onClick={() => setNewProjectOpen(true)} className="max-[640px]:h-11"><Plus size={13} /> New project</Button>} />
      <div data-testid="projects-content-column" className={`${pageColumnClass} pb-16 pt-8 max-[640px]:pt-5`}>
        {!loading && !loadError && projects.length === 0 ? (
          <section className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#f0f0ed] text-[#71736d]"><FolderKanban size={19} /></span>
            <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[#3f413c]">Create your first project</h2>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => setNewProjectOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[14px] font-medium text-white hover:bg-[#3a3b37]"><Plus size={14} /> New project</button>
              {materials.length === 0 && <button type="button" onClick={() => onOpenStream()} className="h-9 rounded-md px-3 text-[14px] font-medium text-[#686a64] hover:bg-[#f1f1ee]">Add materials first</button>}
            </div>
          </section>
        ) : <div className="mt-6 border-t border-[#e7e7e4] max-[640px]:mt-[15px]">
          <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_44px] gap-3 border-b border-[#e7e7e4] px-3 py-2 text-[14px] font-medium text-[#92938e] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span>Name</span><span>Materials</span><span className="max-[640px]:hidden">Documents</span><span /></div>
          {loading ? <div className="space-y-1 py-2" aria-label="Loading projects">{[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}</div> : loadError ? <div className="py-10 text-center"><p className="text-[15px] text-[#a04b43]">{loadError}</p><button type="button" onClick={() => void loadWorkspace()} className="mt-3 h-8 rounded-md border border-[#d8d8d3] px-3 text-[14px] text-[#62635e] hover:bg-[#f4f4f1]">Reload</button></div> : <>{projects.map((project) => <button key={project.name} type="button" onClick={() => { loadedRef.current = undefined; setSelectedName(project.name); onSelectedProjectChange(project.name); }} className="group grid w-full grid-cols-[minmax(0,1fr)_90px_90px_44px] items-center gap-3 border-b border-[#eeeeeb] px-3 py-3 text-left hover:bg-[#f7f7f5] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-[#f0f0ed] text-[#676863]"><FolderKanban size={14} /></span><span className="min-w-0 truncate text-[15px] font-medium text-[#393a36]">{project.name}</span></span><span className="text-[15px] text-[#82837e]">{project.count}</span><span className="text-[15px] text-[#82837e] max-[640px]:hidden">{documents.filter((document) => document.project === project.name).length}</span><ArrowRight size={14} className="text-[#aaa] transition group-hover:translate-x-0.5" /></button>)}<button type="button" onClick={() => onOpenStream()} className="group grid w-full grid-cols-[minmax(0,1fr)_90px_90px_44px] items-center gap-3 border-b border-[#eeeeeb] px-3 py-3 text-left hover:bg-[#f7f7f5] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-[#f0f0ed] text-[#777873]"><Inbox size={14} /></span><span className="block text-[15px] font-medium text-[#393a36]">Unfiled</span></span><span className="text-[15px] text-[#82837e]">{unfiled}</span><span className="text-[15px] text-[#b0b1ad] max-[640px]:hidden">—</span><ArrowRight size={14} className="text-[#aaa]" /></button></>}
        </div>}
      </div>
      {newProjectOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20211e]/25 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewProjectOpen(false); }}><form onSubmit={(event) => { event.preventDefault(); void createProject(); }} className="w-full max-w-sm rounded-xl border border-[#deded9] bg-white p-5 shadow-[0_24px_70px_rgba(20,21,18,0.2)]"><h2 className="text-[14px] font-semibold text-[#30312d]">New project</h2><input autoFocus value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name" className="mt-4 h-10 w-full rounded-md border border-[#dcdcd7] px-3 text-[14px] outline-none focus:border-[#aaa]" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setNewProjectOpen(false)} className="h-8 rounded-md px-3 text-[15px] text-[#6d6e69] hover:bg-[#f0f0ed]">Cancel</button><button type="submit" disabled={!newProjectName.trim()} className="h-8 rounded-md bg-[#242522] px-3 text-[15px] font-medium text-white disabled:bg-[#bdbdb8]">Create</button></div></form></div>}
    </main>
  );
}
