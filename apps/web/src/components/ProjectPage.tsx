import { ArrowLeft, ArrowRight, BookOpenText, Check, FilePlus2, FileText, FolderKanban, Inbox, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import type { Material } from "@logue/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { createDocument, generateProjectOverviewDraft, getDocuments, getProjects, saveProject, type LogueDocument, type ProjectSummary } from "../api";

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
      setLoadError(cause instanceof Error ? cause.message : "无法载入项目");
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
      setDraftError(cause instanceof Error ? cause.message : "无法生成概览草稿");
    } finally {
      setDraftGenerating(false);
    }
  }

  async function createProjectDocument() {
    if (!selected || creatingDocument) return;
    setCreatingDocument(true);
    try {
      const created = await createDocument({ title: `${selected.name} 文档`, project: selected.name });
      setDocuments((current) => [created, ...current]);
      onOpenResults(selected.name, created.id);
    } finally {
      setCreatingDocument(false);
    }
  }

  if (selected) {
    return (
      <main className="min-w-0 flex-1 overflow-y-auto bg-white">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[#eeeeeb] bg-white/92 px-4 backdrop-blur">
          <button type="button" onClick={() => { setSelectedName(undefined); loadedRef.current = undefined; onSelectedProjectChange(undefined); }} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] text-[#71726d] hover:bg-[#f1f1ee]"><ArrowLeft size={14} /> 所有项目</button>
          <span className={`inline-flex items-center gap-1 text-[10.5px] ${saveState === "error" ? "text-[#a84d44]" : "text-[#8d8e89]"}`}>{saveState === "saved" && <Check size={12} />}{saveState === "saving" ? "保存中…" : saveState === "dirty" ? "未保存" : saveState === "error" ? "保存失败" : "已保存"}</span>
        </header>
        <div className="mx-auto max-w-[860px] px-[8%] pb-24 pt-14 max-[640px]:px-5">
          <div className="inline-flex size-11 items-center justify-center rounded-md bg-[#f0f0ed] text-[#666762]"><FolderKanban size={21} /></div>
          <h1 className="mt-5 text-[38px] font-bold tracking-[-0.045em] text-[#242522]">{selected.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#8b8c87]"><span>{linkedMaterials.length} 条资料</span><span className="text-[#b8b9b4]">·</span><span>{linkedDocuments.length} 份文档</span><span className="text-[#b8b9b4]">·</span><span>{glossary.length} 个项目术语</span></div>

          <section className="mt-10">
            <div className="flex items-center justify-between gap-3"><h2 className="text-[12px] font-semibold text-[#555651]">项目背景</h2><button type="button" onClick={() => void createOverviewDraft()} disabled={draftGenerating || linkedMaterials.length === 0} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10.5px] font-medium text-[#676863] hover:bg-[#f1f1ee] disabled:opacity-40">{draftGenerating ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />}{draftGenerating ? "正在更新…" : "用资料更新背景"}</button></div>
            <p className="mt-1 text-[10.5px] text-[#989994]">这里的内容会自动保存，并用于该项目后续的输入与文档生成。</p>
            <textarea value={overview} onChange={(event) => { setOverview(event.target.value); markDirty(); }} placeholder="记录项目背景、当前决定、约束与目标…" className="mt-3 min-h-36 w-full resize-y rounded-md border border-transparent bg-[#f7f7f5] px-3.5 py-3 text-[13px] leading-6 text-[#3e3f3b] outline-none placeholder:text-[#b3b4af] focus:border-[#d8d8d3] focus:bg-white" />
            {draftError && <p className="mt-2 rounded-md bg-[#f9ece9] px-3 py-2 text-[10.5px] text-[#a24a42]">{draftError}</p>}
            {overviewDraft && <div className="mt-3 rounded-md bg-[#fafaf8] p-3.5"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#64655f]"><Sparkles size={12} /> 待采用草稿</span><span className="text-[9.5px] text-[#999a95]">基于 {draftSourceCount} 条资料</span></div><pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-[11.5px] leading-5 text-[#555651]">{overviewDraft}</pre><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOverviewDraft("")} className="h-7 rounded px-2 text-[10px] text-[#858680] hover:bg-[#eeeeeb]">放弃</button><button type="button" onClick={() => { setOverview((current) => [current.trim(), overviewDraft.trim()].filter(Boolean).join("\n\n")); setOverviewDraft(""); markDirty(); }} className="h-7 rounded bg-[#242522] px-2.5 text-[10px] font-medium text-white">追加到概览</button></div></div>}
          </section>

          <section className="mt-11">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-[12px] font-semibold text-[#555651]">项目文档</h2><p className="mt-1 text-[10.5px] text-[#989994]">带来源、可继续编辑的文档。</p></div>
              <div className="flex shrink-0 items-center gap-1">
                {linkedDocuments.length > 0 && <button type="button" onClick={() => onOpenResults(selected.name)} className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium text-[#62635e] hover:bg-[#f1f1ee]">查看全部 <ArrowRight size={13} /></button>}
                <button type="button" onClick={() => void createProjectDocument()} disabled={creatingDocument} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#242522] px-2.5 text-[10.5px] font-medium text-white disabled:bg-[#bdbdb8]"><FilePlus2 size={12} /> {creatingDocument ? "创建中…" : "新建文档"}</button>
              </div>
            </div>
            {linkedDocuments.length > 0 ? <div className="mt-3 divide-y divide-[#eeeeeb]">{linkedDocuments.slice(0, 5).map((document) => <button key={document.id} type="button" onClick={() => onOpenResults(selected.name, document.id)} className="group flex w-full items-center gap-2.5 px-2 py-2.5 text-left hover:bg-[#f7f7f5]"><BookOpenText size={14} className="shrink-0 text-[#858680]" /><span className="min-w-0 flex-1 truncate text-[12px] text-[#50514d]">{document.title || "无标题"}</span><span className="text-[10px] text-[#999a95]">{new Date(document.updated_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</span><ArrowRight size={13} className="text-[#b1b2ad] transition group-hover:translate-x-0.5" /></button>)}</div> : <button type="button" onClick={() => void createProjectDocument()} className="mt-3 flex w-full items-center gap-2.5 rounded-md border border-dashed border-[#d7d7d2] px-3 py-4 text-left text-[11px] text-[#858680] hover:bg-[#fafaf8]"><BookOpenText size={15} /> 创建第一份项目文档</button>}
          </section>

          <section className="mt-11">
            <div className="flex items-center justify-between"><div><h2 className="text-[12px] font-semibold text-[#555651]">项目资料</h2><p className="mt-1 text-[10.5px] text-[#989994]">一条资料可以属于多个项目。</p></div><button type="button" onClick={() => onOpenStream(selected.name)} className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium text-[#62635e] hover:bg-[#f1f1ee]">查看全部 <ArrowRight size={13} /></button></div>
            <div className="mt-3 divide-y divide-[#eeeeeb]">{linkedMaterials.slice(0, 6).map((material) => <button key={material.id} type="button" onClick={() => onOpenMaterial(material.id)} className="flex min-h-11 w-full items-center gap-2.5 px-2 py-2.5 text-left hover:bg-[#f7f7f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5b64f4]"><FileText size={14} className="shrink-0 text-[#858680]" /><span className="min-w-0 flex-1 truncate text-[12px] text-[#50514d]">{material.content}</span><span className="text-[10px] text-[#999a95]">{material.source?.domain || material.kind}</span></button>)}</div>
          </section>

          <section className="mt-11">
            <h2 className="text-[12px] font-semibold text-[#555651]">项目术语</h2>
            <p className="mt-1 text-[10.5px] text-[#989994]">固定容易转写错误的专有名词；不会从单次模型猜测中自动加入。</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{glossary.map((value) => <span key={value} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#f0f0ed] px-2.5 text-[11px] text-[#555651]">{value}<button type="button" onClick={() => { setGlossary((current) => current.filter((item) => item !== value)); markDirty(); }} className="text-[#999a95] hover:text-[#555]" aria-label={`移除 ${value}`}><X size={11} /></button></span>)}</div>
            <div className="mt-3 flex max-w-md gap-2"><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTerm(); } }} placeholder="添加术语后按 Enter" className="h-9 min-w-0 flex-1 rounded-md border border-[#dfdfda] px-3 text-[12px] outline-none focus:border-[#aaa]" /><button type="button" onClick={addTerm} disabled={!term.trim()} className="h-9 rounded-md border border-[#dadad6] px-3 text-[11px] font-medium text-[#61625d] hover:bg-[#f4f4f1] disabled:opacity-40">添加</button></div>
          </section>
        </div>
      </main>
    );
  }

  const unfiled = materials.filter((item) => item.projects.length === 0).length;
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-white">
      <header className="border-b border-[#eeeeeb] px-8 py-5 max-[640px]:px-4 max-[640px]:py-4"><div className="mx-auto flex max-w-[960px] items-center justify-between"><div><h1 className="text-[20px] font-semibold tracking-[-0.035em] text-[#20211e]">项目</h1><p className="mt-1 text-[11px] text-[#858680]">管理背景、资料与文档的工作空间</p></div><button type="button" onClick={() => setNewProjectOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#242522] px-3 text-[11px] font-medium text-white"><Plus size={13} /> 新建项目</button></div></header>
      <div className="mx-auto max-w-[960px] px-8 pb-16 pt-8 max-[640px]:px-4 max-[640px]:pt-5">
        <p className="max-w-2xl text-[12px] leading-5 text-[#777873]">项目不是普通标签：它让后续输入和文档直接复用同一组背景与术语。</p>
        {!loading && !loadError && projects.length === 0 ? (
          <section className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#f0f0ed] text-[#71736d]"><FolderKanban size={19} /></span>
            <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[#3f413c]">建立第一个项目</h2>
            <p className="mt-1.5 max-w-sm text-[12px] leading-5 text-[#858780]">把长期背景、专有术语、资料和文档放在一起；之后的输入与生成会自动复用这些上下文。</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => setNewProjectOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[12px] font-medium text-white hover:bg-[#3a3b37]"><Plus size={14} /> 新建项目</button>
              {materials.length === 0 && <button type="button" onClick={() => onOpenStream()} className="h-9 rounded-md px-3 text-[12px] font-medium text-[#686a64] hover:bg-[#f1f1ee]">先添加资料</button>}
            </div>
          </section>
        ) : <div className="mt-6 border-t border-[#e7e7e4] max-[640px]:mt-[15px]">
          <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_44px] gap-3 border-b border-[#e7e7e4] px-3 py-2 text-[10.5px] font-medium text-[#92938e] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span>名称</span><span>资料</span><span className="max-[640px]:hidden">文档</span><span /></div>
          {loading ? <div className="space-y-1 py-2" aria-label="正在载入项目">{[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}</div> : loadError ? <div className="py-10 text-center"><p className="text-[11px] text-[#a04b43]">{loadError}</p><button type="button" onClick={() => void loadWorkspace()} className="mt-3 h-8 rounded-md border border-[#d8d8d3] px-3 text-[10.5px] text-[#62635e] hover:bg-[#f4f4f1]">重新载入</button></div> : <>{projects.map((project) => <button key={project.name} type="button" onClick={() => { loadedRef.current = undefined; setSelectedName(project.name); onSelectedProjectChange(project.name); }} className="group grid w-full grid-cols-[minmax(0,1fr)_90px_90px_44px] items-center gap-3 border-b border-[#eeeeeb] px-3 py-3 text-left hover:bg-[#f7f7f5] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-[#f0f0ed] text-[#676863]"><FolderKanban size={14} /></span><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-[#393a36]">{project.name}</span>{project.overview && <span className="mt-0.5 block truncate text-[10.5px] text-[#969792]">{project.overview}</span>}</span></span><span className="text-[11px] text-[#82837e]">{project.count} 条</span><span className="text-[11px] text-[#82837e] max-[640px]:hidden">{documents.filter((document) => document.project === project.name).length} 份</span><ArrowRight size={14} className="text-[#aaa] transition group-hover:translate-x-0.5" /></button>)}<button type="button" onClick={() => onOpenStream()} className="group grid w-full grid-cols-[minmax(0,1fr)_90px_90px_44px] items-center gap-3 border-b border-[#eeeeeb] px-3 py-3 text-left hover:bg-[#f7f7f5] max-[640px]:grid-cols-[minmax(0,1fr)_64px_28px]"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-[#f0f0ed] text-[#777873]"><Inbox size={14} /></span><span className="min-w-0"><span className="block text-[13px] font-medium text-[#393a36]">未归项目</span><span className="mt-0.5 block truncate text-[10.5px] text-[#999a95]">无需清空，也不会形成待办</span></span></span><span className="text-[11px] text-[#82837e]">{unfiled} 条</span><span className="text-[11px] text-[#b0b1ad] max-[640px]:hidden">—</span><ArrowRight size={14} className="text-[#aaa]" /></button></>}
        </div>}
      </div>
      {newProjectOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20211e]/25 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewProjectOpen(false); }}><form onSubmit={(event) => { event.preventDefault(); void createProject(); }} className="w-full max-w-sm rounded-xl border border-[#deded9] bg-white p-5 shadow-[0_24px_70px_rgba(20,21,18,0.2)]"><h2 className="text-[14px] font-semibold text-[#30312d]">新建项目</h2><p className="mt-1 text-[10.5px] text-[#8b8c87]">项目名称会出现在资料归属与输入参考中。</p><input autoFocus value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="项目名称" className="mt-4 h-10 w-full rounded-md border border-[#dcdcd7] px-3 text-[12px] outline-none focus:border-[#aaa]" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setNewProjectOpen(false)} className="h-8 rounded-md px-3 text-[11px] text-[#6d6e69] hover:bg-[#f0f0ed]">取消</button><button type="submit" disabled={!newProjectName.trim()} className="h-8 rounded-md bg-[#242522] px-3 text-[11px] font-medium text-white disabled:bg-[#bdbdb8]">创建</button></div></form></div>}
    </main>
  );
}
