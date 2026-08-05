import type { Material } from "@logue/ui";
import { CheckCircle2, ChevronDown, Clipboard, Copy, FileText, LoaderCircle, Plus, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adoptSkillRun, createSkill, createSkillRun, defaultSkillPurpose, getSkillRuns, getSkills, updateSkill, type LogueSkill, type LogueSkillRun, type SkillContext, type SkillOutput, type SkillSurface, type SkillTask } from "../skillApi";
import { createDocument, getDocuments, getWorkspaceSettings, saveWorkspaceSettings, type LogueDocument } from "../api";
import { groupIdenticalMaterials } from "../materialGroups";
import { matchesMaterialSearchText, orderMaterialSearchResults, useDocumentSearch, useMaterialSearch } from "../materialSearch";
import { ViewWorkspace } from "./DocumentWorkspace";
import { MaterialGroupPicker } from "./MaterialGroupPicker";
import { PanelResizer, usePersistentPanelSize } from "./PanelResizer";
import { SearchPending } from "./SearchPending";
import { editorColumnClass } from "./layout";

export type WorkspaceSection = "skills" | "documents";
type WorkspaceMode = "new" | WorkspaceSection;

const outputLabels: Record<SkillOutput, string> = {
  insert: "Text",
  material: "Material",
  qa: "Q&A",
  document: "Document",
};
const surfaceLabels: Record<SkillSurface, string> = {
  web: "Web",
  extension: "Extension",
  background: "Background",
};
const contextLabels: Record<SkillContext, string> = {
  page: "Page",
  target: "Input field",
  selection: "Selection",
  project: "Project",
  materials: "Materials",
  personal: "Preferences",
};

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function GenerationWorkspace({ materials, initialMode = "documents", initialDocumentId, initialProject, onModeChange, onSelectedDocumentChange, onOpenMaterials, onLeaveGuardChange }: { materials: Material[]; initialMode?: WorkspaceSection; initialDocumentId?: string; initialProject?: string; onModeChange: (mode: WorkspaceSection) => void; onSelectedDocumentChange: (documentId?: string, replace?: boolean) => void; onOpenMaterials: () => void; onLeaveGuardChange?: (guard?: () => Promise<boolean>) => void }) {
  const [mode, setMode] = useState<WorkspaceMode>(initialMode);
  const [skills, setSkills] = useState<LogueSkill[]>([]);
  const [runs, setRuns] = useState<LogueSkillRun[]>([]);
  const [documents, setDocuments] = useState<LogueDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(initialDocumentId);
  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [documentQuery, setDocumentQuery] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"none" | "list">("none");
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string>();
  const [documentsError, setDocumentsError] = useState<string>();
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [creatingDocument, setCreatingDocument] = useState(false);
  const [documentCreateError, setDocumentCreateError] = useState<string>();
  const documentLeaveGuardRef = useRef<(() => Promise<boolean>) | undefined>(undefined);
  const { size: navigationWidth, setSize: setNavigationWidth } = usePersistentPanelSize({
    storageKey: "logue.panel.workspace-list.width",
    defaultSize: 252,
    min: 200,
    max: 360,
  });

  const refreshSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(undefined);
    try {
      const [nextSkills, nextRuns] = await Promise.all([getSkills(), getSkillRuns()]);
      setSkills(nextSkills);
      setRuns(nextRuns);
      setSelectedSkillId((current) => (nextSkills.some((skill) => skill.id === current) ? current : (nextSkills.find((skill) => skill.id === "sk_reply")?.id ?? nextSkills.find((skill) => skill.task === "generate" && skill.enabled)?.id ?? nextSkills[0]?.id)));
    } catch (cause) {
      setSkillsError(cause instanceof Error ? cause.message : "Could not load skills");
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(undefined);
    try {
      setDocuments(await getDocuments());
    } catch (cause) {
      setDocumentsError(cause instanceof Error ? cause.message : "Could not load documents");
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  useEffect(() => {
    if (initialDocumentId) setSelectedDocumentId(initialDocumentId);
  }, [initialDocumentId]);
  useEffect(() => {
    void refreshSkills();
    void refreshDocuments();
  }, [refreshSkills, refreshDocuments]);

  useEffect(() => {
    if (mode !== "documents" || documentsLoading || selectedDocumentId || documents.length === 0) return;
    const firstDocumentId = documents[0].id;
    setSelectedDocumentId(firstDocumentId);
    onSelectedDocumentChange(firstDocumentId, true);
  }, [documents, documentsLoading, mode, onSelectedDocumentChange, selectedDocumentId]);

  const registerDocumentLeaveGuard = useCallback(
    (guard?: () => Promise<boolean>) => {
      documentLeaveGuardRef.current = guard;
      onLeaveGuardChange?.(guard);
    },
    [onLeaveGuardChange],
  );

  function applyMode(next: WorkspaceMode, nextMobilePanel: "none" | "list" = "none") {
    const changed = mode !== next;
    setMode(next);
    setSelectedRunId(undefined);
    setMobilePanel(nextMobilePanel);
    if (changed && next !== "new") onModeChange(next);
  }

  async function canLeaveDocument() {
    return mode !== "documents" || !documentLeaveGuardRef.current || (await documentLeaveGuardRef.current());
  }

  async function openSkills(showList = false) {
    if (!(await canLeaveDocument())) return;
    applyMode("skills", showList ? "list" : "none");
  }

  async function startGeneration() {
    if (!(await canLeaveDocument())) return;
    if (!skills.length) await refreshSkills();
    applyMode("new");
  }

  async function addSkill() {
    if (creatingSkill || !(await canLeaveDocument())) return;
    setCreatingSkill(true);
    setSkillsError(undefined);
    try {
      const created = await createSkill({
        name: "New skill",
        purpose: defaultSkillPurpose,
        instructions: "Transform only the selected text. Preserve its meaning and formatting. Return only the replacement text.",
        task: "generate",
        output: "insert",
        surfaces: ["web", "extension"],
        contexts: ["selection"],
        enabled: true,
      });
      setSkills((current) => [created, ...current.filter((skill) => skill.id !== created.id)]);
      setSelectedSkillId(created.id);
      applyMode("skills");
    } catch (cause) {
      setSkillsError(cause instanceof Error ? cause.message : "Could not create skill");
    } finally {
      setCreatingSkill(false);
    }
  }

  async function addDocument() {
    if (creatingDocument || !(await canLeaveDocument())) return;
    setCreatingDocument(true);
    setDocumentCreateError(undefined);
    try {
      const created = await createDocument({ title: "Untitled", project: initialProject });
      setDocuments((current) => [created, ...current.filter((document) => document.id !== created.id)]);
      setSelectedDocumentId(created.id);
      applyMode("documents");
      onSelectedDocumentChange(created.id);
    } catch (cause) {
      setDocumentCreateError(cause instanceof Error ? cause.message : "Could not create document");
    } finally {
      setCreatingDocument(false);
    }
  }

  async function openDocument(id: string) {
    if (mode === "documents" && id !== selectedDocumentId && !(await canLeaveDocument())) return;
    setSelectedDocumentId(id);
    applyMode("documents");
    onSelectedDocumentChange(id);
  }

  const listSection = mode === "skills" ? "skills" : "documents";
  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const documentSearch = useDocumentSearch(documentQuery, documents);
  const visibleDocuments = useMemo(() => {
    if (!documentSearch.normalizedQuery) return documents;
    if (documentSearch.result) {
      const documentsByID = new Map(documents.map((document) => [document.id, document]));
      return documentSearch.result.matches
        .map((match) => documentsByID.get(match.id))
        .filter((document): document is LogueDocument => Boolean(document));
    }
    return documents.filter((document) =>
      [document.title, document.content, document.project]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(documentSearch.normalizedQuery)),
    );
  }, [documentSearch.normalizedQuery, documentSearch.result, documents]);
  const documentSearchReason = useCallback((document: LogueDocument) => {
    const match = documentSearch.matches.get(document.id);
    return match?.match === "related" ? match.reason : "";
  }, [documentSearch.matches]);
  const workspaceList = (section: "documents" | "skills") => (
    <WorkspaceNavigationList
      section={section}
      skills={skills}
      documents={section === "documents" ? visibleDocuments : documents}
      selectedSkillId={selectedSkillId}
      selectedDocumentId={selectedDocumentId}
      loading={section === "skills" ? skillsLoading : documentsLoading}
      error={section === "skills" ? skillsError : documentsError}
      documentSearchActive={section === "documents" && Boolean(documentSearch.normalizedQuery)}
      documentSearchPending={section === "documents" && documentSearch.pending}
      documentSearchReason={documentSearchReason}
      onClearDocumentSearch={() => setDocumentQuery("")}
      onSelectSkill={(id) => {
        setSelectedSkillId(id);
        setMobilePanel("none");
      }}
      onSelectDocument={(id) => void openDocument(id)}
      onRetry={() => void (section === "skills" ? refreshSkills() : refreshDocuments())}
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-white text-[#242522] max-[900px]:flex-col">
      <aside style={{ width: navigationWidth }} className="flex shrink-0 flex-col bg-[#f7f7f5] max-[900px]:hidden" aria-label={`${listSection === "skills" ? "Skills" : "Documents"} navigation`}>
        <header className="flex h-12 shrink-0 items-center justify-between px-4">
          <h1 className="text-[14px] font-semibold text-[#555651]">{listSection === "skills" ? "Skills" : "Documents"}</h1>
          <button
            type="button"
            onClick={() => void (listSection === "skills" ? addSkill() : addDocument())}
            disabled={listSection === "skills" ? creatingSkill : creatingDocument}
            className={`inline-flex h-8 items-center justify-center rounded-md text-[#777873] hover:bg-[#e8e8e5] focus-visible:outline-2 focus-visible:outline-[#777873] disabled:cursor-wait disabled:opacity-60 ${listSection === "documents" ? "gap-1.5 px-2 text-[13px] font-medium" : "w-8"}`}
            aria-label={listSection === "skills" ? "New skill" : "New document"}
            title={listSection === "skills" ? "New skill" : "New document"}
          >
            {(listSection === "skills" ? creatingSkill : creatingDocument) ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" /> : <><Plus size={15} />{listSection === "documents" && <span>New document</span>}</>}
          </button>
        </header>
        {listSection === "documents" && (
          <label className="relative mx-2.5 mb-1.5 block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999a96]" />
            <input
              aria-label="Search documents"
              value={documentQuery}
              onChange={(event) => setDocumentQuery(event.target.value)}
              placeholder="Search documents"
              className="h-8 w-full rounded-md border border-transparent bg-[#eeeeeb] pl-8 pr-2 text-[14px] text-[#2e302b] outline-none placeholder:text-[#92938f] focus:border-[#d9d9d5] focus:bg-white"
            />
            {documentSearch.pending && <span className="sr-only" aria-live="polite">Searching documents</span>}
          </label>
        )}
        {documentCreateError && <p role="alert" className="mx-3 mb-2 rounded-md bg-[#f8ece9] px-3 py-2 text-[14px] leading-4 text-[#9f4a42]">{documentCreateError}</p>}
        <div className="mx-4 border-t border-[#e2e2df]" />
        <div className="mt-1.5 min-h-0 flex-1">
          <div hidden={listSection !== "documents"} className="scroll-surface h-full overflow-y-auto px-2 pb-3" aria-label="Documents list">
            {workspaceList("documents")}
          </div>
          <div hidden={listSection !== "skills"} className="scroll-surface h-full overflow-y-auto px-2 pb-3" aria-label="Skills list">
            {workspaceList("skills")}
          </div>
        </div>
      </aside>
      <PanelResizer label="Resize workspace navigation" value={navigationWidth} min={200} max={360} defaultValue={252} onChange={setNavigationWidth} className="max-[900px]:hidden" />

      <div className="hidden h-12 shrink-0 items-center justify-between border-b border-[#e7e7e4] bg-[#fafaf8] px-3 max-[900px]:flex">
        <button type="button" onClick={() => setMobilePanel((current) => current === "list" ? "none" : "list")} className="h-10 rounded-md px-2 text-[14px] font-semibold text-[#555651] hover:bg-[#ececea]">{listSection === "skills" ? "Skills" : "Documents"}</button>
        <button type="button" onClick={() => void (listSection === "skills" ? addSkill() : addDocument())} className="inline-flex size-10 items-center justify-center rounded-md text-[#777873] hover:bg-[#e8e8e5]" aria-label={listSection === "skills" ? "New skill" : "New document"}><Plus size={16} /></button>
      </div>

      {mobilePanel === "list" ? (
        <main className="scroll-surface min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#f7f7f5] px-3 py-3" data-testid="mobile-workspace-list" aria-label={listSection === "skills" ? "Skills list" : "Documents list"}>
          {workspaceList(listSection)}
        </main>
      ) : mode === "documents" ? (
        <ViewWorkspace
          materials={materials}
          initialDocumentId={selectedDocumentId}
          initialProject={initialProject}
          onSelectedDocumentChange={(id, replace) => {
            setSelectedDocumentId(id);
            onSelectedDocumentChange(id, replace);
          }}
          onOpenMaterials={onOpenMaterials}
          onLeaveGuardChange={registerDocumentLeaveGuard}
          onOpenGenerate={() => void startGeneration()}
          onManageSkills={() => void openSkills(false)}
          showDocumentSidebar={false}
          showEmptyDocumentAction={false}
          documents={documents}
          documentsLoading={documentsLoading}
          onDocumentsChange={setDocuments}
        />
      ) : mode === "skills" ? (
        skillsLoading ? <WorkspaceEditorLoading label="Loading skills" /> : <SkillEditor skills={skills} selectedSkillId={selectedSkillId} onSelect={setSelectedSkillId} onSkillsChange={setSkills} />
      ) : selectedRun ? (
        <RunResult run={selectedRun} onRunChange={(updated) => setRuns((current) => current.map((run) => (run.id === updated.id ? updated : run)))} onOpenDocument={(id) => void openDocument(id)} onBack={() => setSelectedRunId(undefined)} />
      ) : (
        <NewGeneration
          skills={skills}
          materials={materials}
          initialProject={initialProject}
          onCreated={(run) => {
            setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
            setSelectedRunId(run.id);
          }}
        />
      )}
    </div>
  );
}

function WorkspaceEditorLoading({ label }: { label: string }) {
  return (
    <main className="scroll-surface min-h-0 min-w-0 flex-1 overflow-y-auto bg-white" aria-label={label} aria-busy="true">
      <div className={`${editorColumnClass} space-y-7 pt-14`} aria-hidden="true">
        <div className="h-10 w-56 animate-pulse rounded-md bg-[#eeeeeb] motion-reduce:animate-none" />
        <div className="space-y-3">
          <div className="h-4 w-14 animate-pulse rounded bg-[#eeeeeb] motion-reduce:animate-none" />
          <div className="h-40 w-full animate-pulse rounded-md bg-[#f4f4f2] motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}

function WorkspaceNavigationList({ section, skills, documents, selectedSkillId, selectedDocumentId, loading, error, documentSearchActive, documentSearchPending, documentSearchReason, onClearDocumentSearch, onSelectSkill, onSelectDocument, onRetry }: { section: "documents" | "skills"; skills: LogueSkill[]; documents: LogueDocument[]; selectedSkillId?: string; selectedDocumentId?: string; loading: boolean; error?: string; documentSearchActive: boolean; documentSearchPending: boolean; documentSearchReason: (document: LogueDocument) => string; onClearDocumentSearch: () => void; onSelectSkill: (id: string) => void; onSelectDocument: (id: string) => void; onRetry: () => void }) {
  if (loading)
    return (
      <div className="space-y-1 px-1 py-1" aria-label={`Loading ${section === "skills" ? "skills" : section}`}>
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-11 animate-pulse rounded-md bg-[#ecece9] motion-reduce:animate-none" />
        ))}
      </div>
    );
  if (error)
    return (
      <div className="mx-2 mt-3 rounded-md bg-[#f8ece9] px-3 py-3 text-[14px] leading-4 text-[#9f4a42]">
        <p>{error}</p>
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  if (section === "skills")
    return skills.length ? (
      <>
        {skills.map((skill) => (
          <button key={skill.id} type="button" onClick={() => onSelectSkill(skill.id)} className={`flex min-h-11 w-full items-start gap-2 rounded-md px-2 py-2 text-left ${skill.id === selectedSkillId ? "bg-[#e7e7e4]" : "hover:bg-[#ececea]"}`}>
            <Sparkles size={14} className="mt-0.5 shrink-0 text-[#777a72]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-[#50514d]">{skill.name}</span>
            </span>
            {!skill.enabled && <span className="mt-0.5 text-[12px] text-[#aaa]">Off</span>}
          </button>
        ))}
      </>
    ) : (
      <p className="px-3 py-5 text-[14px] leading-4 text-[#999a95]">No skills yet.</p>
    );
  return documents.length ? (
    <>
      {documents.map((document) => (
        <button key={document.id} type="button" onClick={() => onSelectDocument(document.id)} className={`flex min-h-11 w-full items-start gap-2 rounded-md px-2 py-2 text-left ${document.id === selectedDocumentId ? "bg-[#e7e7e4]" : "hover:bg-[#ececea]"}`}>
          <FileText size={14} className="mt-0.5 shrink-0 text-[#777a72]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-[#50514d]">{document.title.trim() || "Untitled"}</span>
            <span className="mt-0.5 block truncate text-[14px] text-[#979893]">{documentSearchReason(document) || document.project || shortDate(document.updated_at)}</span>
          </span>
        </button>
      ))}
    </>
  ) : documentSearchActive && documentSearchPending ? (
    <SearchPending label="documents" className="min-h-16" />
  ) : documentSearchActive ? (
    <div className="px-3 py-6 text-center">
      <p className="text-[14px] text-[#999a95]">No matching documents</p>
      <button type="button" onClick={onClearDocumentSearch} className="mt-2 text-[14px] font-medium text-[#666762] underline underline-offset-2">Clear search</button>
    </div>
  ) : (
    <p className="px-3 py-5 text-[14px] leading-4 text-[#999a95]">No documents yet.</p>
  );
}

function NewGeneration({ skills, materials, initialProject, onCreated }: { skills: LogueSkill[]; materials: Material[]; initialProject?: string; onCreated: (run: LogueSkillRun) => void }) {
  const generationSkills = skills.filter((skill) => skill.enabled && skill.task === "generate" && skill.surfaces.includes("web"));
  const [skillId, setSkillId] = useState(generationSkills.find((skill) => skill.id === "sk_reply")?.id ?? generationSkills[0]?.id ?? "");
  const [instruction, setInstruction] = useState("");
  const [project, setProject] = useState(initialProject ?? "");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [showSources, setShowSources] = useState(Boolean(initialProject));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const projects = useMemo(() => Array.from(new Set(materials.flatMap((item) => item.projects))).sort(), [materials]);
  const sourceCandidates = useMemo(
    () => materials.filter((item) => !project || item.projects.includes(project)),
    [materials, project],
  );
  const sourceSearch = useMaterialSearch(sourceQuery, sourceCandidates);
  const visibleSources = useMemo(() => {
    const filtered = !sourceSearch.normalizedQuery
      ? sourceCandidates
      : sourceSearch.result
        ? orderMaterialSearchResults(sourceCandidates, sourceSearch.result)
        : sourceCandidates.filter((item) => matchesMaterialSearchText(item, sourceSearch.normalizedQuery));
    return groupIdenticalMaterials(filtered)
      .slice(0, 30)
      .flatMap((group) => group.items);
  }, [sourceCandidates, sourceSearch.normalizedQuery, sourceSearch.result]);
  const sourceSearchReason = useCallback((material: Material) => {
    const match = sourceSearch.matches.get(material.id);
    return match?.match !== "content" ? match?.reason ?? "" : "";
  }, [sourceSearch.matches]);

  useEffect(() => {
    if (!skillId && generationSkills.length) setSkillId(generationSkills.find((item) => item.id === "sk_reply")?.id ?? generationSkills[0].id);
  }, [skillId, generationSkills]);

  useEffect(() => {
    if (!project || sourceIds.length) return;
    setSourceIds(
      groupIdenticalMaterials(materials.filter((item) => item.projects.includes(project)))
        .slice(0, 3)
        .map((group) => group.representative.id),
    );
  }, [materials, project, sourceIds.length]);

  async function run() {
    if (!skillId || !instruction.trim() || running) return;
    setRunning(true);
    setError(undefined);
    try {
      onCreated(
        await createSkillRun({
          skill_id: skillId,
          instruction: instruction.trim(),
          project,
          source_ids: sourceIds,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="scroll-surface min-h-0 min-w-0 flex-1 overflow-y-auto bg-white">
      <article data-testid="generation-form-content-column" className={`${editorColumnClass} pb-24 pt-10 max-[700px]:pt-7`}>
        <div className="grid grid-cols-[160px_1fr] gap-6 max-[640px]:grid-cols-1 max-[640px]:gap-2">
          <label className="pt-2 text-[15px] font-medium text-[#6e706a]" htmlFor="generation-skill">
            Skill
          </label>
          <div>
            <select id="generation-skill" value={skillId} onChange={(event) => setSkillId(event.target.value)} className="h-10 w-full rounded-md border border-[#dcdcd8] bg-white px-3 text-[14px] font-medium text-[#41423e] outline-none focus:border-[#aaa]">
              <option value="">Choose a skill</option>
              {generationSkills.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {outputLabels[item.output]}
                </option>
              ))}
            </select>
          </div>
          <label className="pt-2 text-[15px] font-medium text-[#6e706a]" htmlFor="generation-instruction">
            Task
          </label>
          <textarea id="generation-instruction" autoFocus value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="For example: Draft a concise, natural reply based on these materials" className="min-h-28 w-full resize-y rounded-md border border-[#dcdcd8] px-3.5 py-3 text-[15px] leading-6 outline-none placeholder:text-[#aaa] focus:border-[#aaa]" />
          <label className="pt-2 text-[15px] font-medium text-[#6e706a]" htmlFor="generation-project">
            Project
          </label>
          <select
            id="generation-project"
            value={project}
            onChange={(event) => {
              setProject(event.target.value);
              setSourceIds([]);
            }}
            className="h-10 w-full rounded-md border border-[#dcdcd8] bg-white px-3 text-[14px] text-[#555651] outline-none focus:border-[#aaa]"
          >
            <option value="">Any project</option>
            {projects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <section className="mt-6 border-t border-[#e9e9e6] pt-4">
          <button type="button" onClick={() => setShowSources((value) => !value)} className="flex w-full items-center justify-between py-1 text-left">
            <span>
              <span className="text-[15px] font-medium text-[#666762]">Materials</span>
              <span className="ml-2 text-[14px] text-[#999a95]">{sourceIds.length} selected</span>
            </span>
            <span className="text-[14px] text-[#888984]">{showSources ? "Hide" : "Choose"}</span>
          </button>
          {showSources && (
            <div className="mt-3 rounded-md border border-[#e1e1dd] p-2">
              <label className="relative block">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" />
                <input aria-label="Search source materials" value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search materials" className="h-8 w-full rounded bg-[#f5f5f2] pl-8 pr-2 text-[15px] outline-none" />
              </label>
              <div className="mt-1 max-h-52 overflow-y-auto">
                {sourceSearch.pending ? <SearchPending label="materials" className="min-h-16" /> : <MaterialGroupPicker materials={visibleSources} selectedIds={sourceIds} onChange={setSourceIds} getLabel={(item) => item.content} getSearchReason={sourceSearchReason} />}
              </div>
            </div>
          )}
        </section>
        {error && <p className="mt-5 rounded-md bg-[#fbefec] px-3 py-2.5 text-[15px] leading-4 text-[#a34b42]">{error}</p>}
        <div className="mt-7 flex justify-end">
          <button type="button" onClick={() => void run()} disabled={!skillId || !instruction.trim() || running} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#242522] px-4 text-[14px] font-medium text-white hover:bg-[#383934] disabled:cursor-not-allowed disabled:bg-[#c9cac5]">
            {running ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {running ? "Generating…" : "Generate"}
          </button>
        </div>
      </article>
    </main>
  );
}

function RunResult({ run, onRunChange, onOpenDocument, onBack }: { run: LogueSkillRun; onRunChange: (run: LogueSkillRun) => void; onOpenDocument: (id: string) => void; onBack: () => void }) {
  const [draft, setDraft] = useState(run.adopted_output || run.original_output || "");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setDraft(run.adopted_output || run.original_output || "");
  }, [run]);
  async function copy() {
    const updated = await adoptSkillRun(run.id, draft);
    onRunChange(updated);
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="z-10 shrink-0 border-b border-[#eeeeeb] bg-white/92 backdrop-blur">
        <div data-testid="generation-result-header-column" className={`${editorColumnClass} flex h-12 items-center justify-between`}>
          <button type="button" onClick={onBack} className="text-[15px] font-medium text-[#777873] hover:text-[#3e3f3b]">
            ← New
          </button>
          <span className="text-[14px] text-[#999a95]">
            {run.skill_name}
          </span>
        </div>
      </header>
      <article data-testid="generation-result-content-column" className={`scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain ${editorColumnClass} pb-24 pt-14 max-[700px]:pt-9`}>
        <div className="flex items-center gap-2 text-[15px] text-[#777873]">
          <Sparkles size={14} />
          <span>{outputLabels[run.output_type]}</span>
          {run.project && (
            <>
              <span>·</span>
              <span>{run.project}</span>
            </>
          )}
        </div>
        <h2 className="mt-4 text-[32px] font-bold tracking-[-0.04em] text-[#242522] max-[640px]:text-[27px]">{run.instruction}</h2>
        <p className="mt-2 text-[14px] text-[#999a95]">
          {run.sources.length} materials used ·{" "}
          {new Date(run.created_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <section className="mt-9">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-72 w-full resize-y border-0 bg-transparent text-[14px] leading-7 text-[#30312d] outline-none" aria-label="Generated result" />
        </section>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9e9e6] pt-4">
          <button type="button" onClick={() => void copy()} aria-label="Copy generated result" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[15px] font-medium text-[#555651] hover:bg-[#f4f4f1]">
            {copied ? <CheckCircle2 size={13} className="text-[#5e835f]" /> : <Clipboard size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {run.document_id && (
            <button type="button" onClick={() => onOpenDocument(run.document_id!)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[15px] font-medium text-white">
              <FileText size={13} /> Open document
            </button>
          )}
        </div>
        {run.sources.length > 0 && (
          <details className="mt-8 border-t border-[#eeeeeb] pt-4">
            <summary className="cursor-pointer text-[15px] font-medium text-[#666762]">View materials actually used</summary>
            <div className="mt-3 space-y-2">
              {run.sources.map((source, index) => (
                <div key={source.id} className="border-l-2 border-[#dedeea] pl-3">
                  <p className="text-[14px] font-medium text-[#696a65]">Source {index + 1}</p>
                  <p className="mt-1 line-clamp-3 text-[15px] leading-5 text-[#858680]">{source.content}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </article>
    </main>
  );
}

function SkillEditor({ skills, selectedSkillId, onSelect, onSkillsChange }: { skills: LogueSkill[]; selectedSkillId?: string; onSelect: (id: string) => void; onSkillsChange: (skills: LogueSkill[]) => void }) {
  const selected = skills.find((skill) => skill.id === selectedSkillId) ?? skills[0];
  const [draft, setDraft] = useState<LogueSkill | undefined>(selected);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const dirtyRef = useRef(false);
  useEffect(() => {
    setDraft(selected);
    dirtyRef.current = false;
    setSaveState("saved");
  }, [selected?.id, selected?.revision]);
  useEffect(() => {
    if (!draft || !dirtyRef.current || saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void updateSkill(draft.id, {
        name: draft.name,
        purpose: draft.purpose,
        instructions: draft.instructions,
        task: draft.task,
        output: draft.output,
        surfaces: draft.surfaces,
        contexts: draft.contexts,
        enabled: draft.enabled,
        expected_revision: draft.revision,
      })
        .then((saved) => {
          dirtyRef.current = false;
          setDraft(saved);
          onSkillsChange(skills.map((skill) => (skill.id === saved.id ? saved : skill)));
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [skills, draft, onSkillsChange, saveState]);
  function change(changes: Partial<LogueSkill>) {
    if (!draft) return;
    dirtyRef.current = true;
    setDraft({ ...draft, ...changes });
    setSaveState("dirty");
  }
  function retrySave() {
    if (!draft) return;
    dirtyRef.current = true;
    setSaveState("dirty");
  }
  async function duplicate() {
    if (!draft) return;
    const copy = await createSkill({
      name: `${draft.name} copy`,
      purpose: draft.purpose,
      instructions: draft.instructions,
      task: draft.task,
      output: draft.output,
      surfaces: draft.surfaces,
      contexts: draft.contexts,
      enabled: true,
    });
    onSkillsChange([...skills, copy]);
    onSelect(copy.id);
  }
  async function setDefault() {
    if (!draft) return;
    const settings = await getWorkspaceSettings();
    const changes = draft.task === "transcribe" ? { default_transcription_skill: draft.id } : draft.task === "organize" ? { default_organization_skill: draft.id } : { default_extension_skill: draft.id };
    await saveWorkspaceSettings({ ...settings, ...changes });
  }
  if (!draft) return <main className="flex flex-1 items-center justify-center text-[14px] text-[#999]">No skills yet</main>;
  const toggle = <T extends string>(items: T[], value: T) => (items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="z-10 shrink-0 border-b border-[#eeeeeb] bg-white/92 backdrop-blur">
        <div data-testid="skill-editor-header-column" className={`${editorColumnClass} flex h-12 items-center justify-between gap-3`}>
          <span className="text-[14px] font-medium text-[#777873]">Skills</span>
          {saveState === "error" && <span className="flex items-center gap-2 text-[14px] text-[#a34b42]"><span>Save failed</span><button type="button" onClick={retrySave} className="font-medium underline underline-offset-2">Retry</button></span>}
        </div>
      </header>
      <article data-testid="skill-editor-content-column" className={`scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain ${editorColumnClass} pb-24 pt-14 max-[700px]:pt-8`}>
        <select value={draft.id} onChange={(event) => onSelect(event.target.value)} className="mb-6 hidden h-11 w-full rounded-md border border-[#dcdcd8] bg-white px-3 text-[15px] max-[900px]:block" aria-label="Choose skill">
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
        <input value={draft.name} onChange={(event) => change({ name: event.target.value })} aria-label="Skill name" className="w-full border-0 bg-transparent text-[38px] font-bold tracking-[-0.045em] text-[#242522] outline-none placeholder:text-[#d0d0cc] max-[640px]:text-[30px]" placeholder="Untitled skill" />
        <label className="mt-7 block">
          <span className="mb-1.5 block text-[14px] font-medium text-[#777873]">Prompt</span>
          <textarea value={draft.instructions} onChange={(event) => change({ instructions: event.target.value })} aria-label="Skill prompt" className="min-h-40 max-h-[60vh] w-full resize-y overflow-y-auto border-0 bg-transparent text-[15px] leading-7 text-[#343531] outline-none placeholder:text-[#aaa] [field-sizing:content]" placeholder="Write a prompt…" />
        </label>
        <details className="group mt-8 border-t border-[#e9e9e6] pt-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md px-1 text-[14px] font-medium text-[#777873] hover:text-[#4d4e49]">
            Advanced
            <ChevronDown size={15} className="transition group-open:rotate-180" />
          </summary>
          <section className="mt-4 grid grid-cols-[160px_1fr] gap-x-7 gap-y-5 max-[640px]:grid-cols-1 max-[640px]:gap-y-2">
          <span className="pt-2 text-[15px] font-medium text-[#6e706a]">Use for</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-[14px] text-[#969792]">Purpose</span>
              <select aria-label="Skill use" value={draft.task} onChange={(event) => change({ task: event.target.value as SkillTask })} className="h-10 w-full rounded-md border border-[#dcdcd8] bg-white px-2.5 text-[15px]">
                <option value="transcribe">Transcribe</option>
                <option value="organize">Organize</option>
                <option value="generate">Generate</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[14px] text-[#969792]">Output</span>
              <select aria-label="Output" value={draft.output} onChange={(event) => change({ output: event.target.value as SkillOutput })} className="h-10 w-full rounded-md border border-[#dcdcd8] bg-white px-2.5 text-[15px]">
                <option value="insert">Text</option>
                <option value="material">Material</option>
                <option value="qa">Q&amp;A</option>
                <option value="document">Document</option>
              </select>
            </label>
          </div>
          <span className="pt-1 text-[15px] font-medium text-[#6e706a]">Available in</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(surfaceLabels) as SkillSurface[]).map((surface) => (
              <button key={surface} type="button" onClick={() => change({ surfaces: toggle(draft.surfaces, surface) })} aria-pressed={draft.surfaces.includes(surface)} className={`h-9 rounded-md border px-2.5 text-[14px] ${draft.surfaces.includes(surface) ? "border-[#b9c4b8] bg-[#edf2eb] text-[#4f684f]" : "border-[#deded9] text-[#777873]"}`}>
                {surfaceLabels[surface]}
              </button>
            ))}
          </div>
          <span className="pt-1 text-[15px] font-medium text-[#6e706a]">Context</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(contextLabels) as SkillContext[]).map((context) => (
              <button key={context} type="button" onClick={() => change({ contexts: toggle(draft.contexts, context) })} aria-pressed={draft.contexts.includes(context)} className={`h-9 rounded-md border px-2.5 text-[14px] ${draft.contexts.includes(context) ? "border-[#c7c7dc] bg-[#f0f0f8] text-[#5e61a0]" : "border-[#deded9] text-[#777873]"}`}>
                {contextLabels[context]}
              </button>
            ))}
          </div>
          <span className="pt-1 text-[15px] font-medium text-[#6e706a]">Status</span>
          <button type="button" onClick={() => change({ enabled: !draft.enabled })} className={`flex h-10 items-center justify-between rounded-md border px-3 text-[15px] ${draft.enabled ? "border-[#b9c4b8] bg-[#edf2eb] text-[#4f684f]" : "border-[#deded9] text-[#777873]"}`}>
            <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
            <span className={`h-4 w-7 rounded-full p-0.5 ${draft.enabled ? "bg-[#708972]" : "bg-[#c8c8c3]"}`}>
              <span className={`block size-3 rounded-full bg-white transition ${draft.enabled ? "translate-x-3" : ""}`} />
            </span>
          </button>
          <span />
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={() => void duplicate()} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#deded9] px-3 text-[14px] font-medium text-[#666762] hover:bg-[#f1f1ee]">
              <Copy size={13} /> Duplicate
            </button>
            <button type="button" onClick={() => void setDefault()} disabled={!draft.enabled || (draft.task === "generate" && !draft.surfaces.includes("extension"))} className="h-10 rounded-md bg-[#242522] px-3 text-[14px] font-medium text-white disabled:bg-[#c8c9c4]">
              {draft.task === "transcribe" ? "Use for transcription" : draft.task === "organize" ? "Use for organization" : "Use in extension"}
            </button>
          </div>
          </section>
        </details>
      </article>
    </main>
  );
}
