import {
  ChevronRight,
  CirclePlus,
  FileText,
  LibraryBig,
  Mic2,
  Search,
  Sparkles,
} from "lucide-react";
import { type Material } from "@logue/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMaterial, deleteMaterial, getMaterials, getStatus, updateMaterial, updateMaterialMetadata, type ServiceStatus } from "./api";
import { MaterialDetail } from "./components/MaterialDetail";
import { NavRail, type Section } from "./components/NavRail";
import { NewMaterialDialog } from "./components/NewMaterialDialog";
import { ProjectPage } from "./components/ProjectPage";
import { GenerationWorkspace, type GenerationMode } from "./components/GenerationWorkspace";
import { SettingsPage } from "./components/SettingsPage";
import { navigationURL, parseNavigation, type AppNavigation } from "./navigation";
import { groupIdenticalMaterials } from "./materialGroups";

type Filter = "all" | "unfiled" | "organized";

const materialIcons = { voice: Mic2, selection: FileText, text: FileText, derived: Sparkles };

function shortDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function sourceName(material: Material) {
  const value = material.source?.domain || material.actor || "用户";
  return value === "127.0.0.1" || value === "localhost" ? "Logue 本地页面" : value;
}

export function App() {
  const [navigation, setNavigation] = useState<AppNavigation>(() => parseNavigation(window.location.search));
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialMode, setMaterialMode] = useState<"peek" | "page">("peek");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ServiceStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showComposer, setShowComposer] = useState(false);
  const [expandedMaterialGroups, setExpandedMaterialGroups] = useState<Set<string>>(() => new Set());
  const documentLeaveGuardRef = useRef<(() => Promise<boolean>) | undefined>(undefined);
  const section = navigation.section;

  const navigate = useCallback((next: AppNavigation, options?: { replace?: boolean }) => {
    const url = navigationURL(window.location, next);
    window.history[options?.replace ? "replaceState" : "pushState"](null, "", url);
    setNavigation(next);
  }, []);

  useEffect(() => {
    const syncFromHistory = () => setNavigation(parseNavigation(window.location.search));
    const canonical = navigationURL(window.location, parseNavigation(window.location.search));
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    const sectionTitle = section === "stream"
      ? "资料流"
      : section === "projects"
        ? navigation.projectName || "项目"
        : section === "settings"
          ? "设置"
          : "生成";
    document.title = `${sectionTitle} · Logue`;
  }, [navigation.projectName, section]);

  const openSection = useCallback((nextSection: Section) => {
    const completeNavigation = () => navigate({ section: nextSection });
    const leaveGuard = documentLeaveGuardRef.current;
    if (section === "views" && nextSection !== "views" && leaveGuard) {
      void leaveGuard().then((saved) => {
        if (saved) completeNavigation();
      });
      return;
    }
    completeNavigation();
  }, [navigate, section]);

  const registerDocumentLeaveGuard = useCallback((guard?: () => Promise<boolean>) => {
    documentLeaveGuardRef.current = guard;
  }, []);

  const openDocument = useCallback((id?: string, replace = false) => {
    navigate({ section: "views", generationMode: "documents", documentId: id }, { replace });
  }, [navigate]);

  const openGenerationMode = useCallback((generationMode: GenerationMode) => {
    navigate({ section: "views", generationMode });
  }, [navigate]);

  const openProject = useCallback((name?: string, replace = false) => {
    navigate({ section: "projects", projectName: name }, { replace });
  }, [navigate]);

  const refresh = useCallback(async () => {
    try {
      const [nextMaterials, nextStatus] = await Promise.all([getMaterials(), getStatus()]);
      setMaterials(nextMaterials);
      setStatus(nextStatus);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法连接本机服务");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!materials.some((material) => material.organization?.status === "pending")) return;
    const timer = window.setTimeout(() => void refresh(), 900);
    return () => window.clearTimeout(timer);
  }, [materials, refresh]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return materials.filter((item) => {
      if (filter === "unfiled" && item.projects.length > 0) return false;
      if (filter === "organized" && item.projects.length === 0) return false;
      if (!normalized) return true;
      return [
        item.content,
        item.annotation,
        item.source?.title,
        item.source?.domain,
        ...item.projects,
        ...item.tags,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [filter, materials, query]);
  const materialGroups = useMemo(() => groupIdenticalMaterials(filtered), [filtered]);

  const selectedId = section === "stream" ? navigation.materialId : undefined;
  const selected = materials.find((item) => item.id === selectedId);

  useEffect(() => {
    if (loading || section !== "stream" || !navigation.materialId) return;
    if (!materials.some((item) => item.id === navigation.materialId)) {
      navigate({ section: "stream" }, { replace: true });
    }
  }, [loading, materials, navigate, navigation.materialId, section]);

  async function addAnnotation(text: string) {
    if (!selected) return;
    const created = await createMaterial({
      kind: "derived",
      content: text,
      parentIds: [selected.id],
      projects: selected.projects,
      source: selected.source,
    });
    setMaterials((current) => [created, ...current]);
    navigate({ section: "stream", materialId: created.id });
  }

  async function addManualMaterial(content: string, projects: string[]) {
    const created = await createMaterial({ kind: "text", content, projects });
    setMaterials((current) => [created, ...current]);
    navigate({ section: "stream", materialId: created.id });
  }

  async function updateOrganization(id: string, projects: string[], tags: string[]) {
    const updated = await updateMaterialMetadata(id, projects, tags);
    setMaterials((current) => current.map((material) => material.id === id ? updated : material));
  }

  async function updateContent(id: string, content: string) {
    const updated = await updateMaterial(id, { content });
    setMaterials((current) => current.map((material) => material.id === id ? updated : material));
  }

  async function removeMaterial(id: string) {
    await deleteMaterial(id);
    setMaterials((current) => current.filter((material) => material.id !== id));
    if (selectedId === id) navigate({ section: "stream" }, { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-transparent max-[640px]:pb-16">
      <NavRail active={section} onChange={openSection} connected={Boolean(status?.ok)} />

      {section === "views" ? (
        <GenerationWorkspace
          materials={materials}
          initialMode={navigation.generationMode ?? (navigation.documentId ? "documents" : "new")}
          initialDocumentId={navigation.documentId}
          initialProject={navigation.projectName}
          onSelectedDocumentChange={openDocument}
          onOpenMaterials={() => openSection("stream")}
          onLeaveGuardChange={registerDocumentLeaveGuard}
          onModeChange={openGenerationMode}
        />
      ) : section === "projects" ? (
        <ProjectPage
          materials={materials}
          initialProject={navigation.projectName}
          onSelectedProjectChange={openProject}
          onOpenStream={(project) => { openSection("stream"); if (project) { setQuery(project); setFilter("all"); } else { setQuery(""); setFilter("unfiled"); } }}
          onOpenMaterial={(materialId) => { setQuery(""); setFilter("all"); setMaterialMode("peek"); navigate({ section: "stream", materialId }); }}
          onOpenResults={(project, id) => navigate({ section: "views", generationMode: "documents", projectName: project, documentId: id })}
        />
      ) : section === "settings" ? (
        <SettingsPage status={status} />
      ) : (
        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${materialMode === "page" ? "hidden" : ""}`}>
          <header className="sticky top-0 z-20 border-b border-[#eeeeeb] bg-white/92 px-8 py-4 backdrop-blur-xl max-[640px]:px-4">
            <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4">
              <div>
                <h1 className="text-[20px] font-semibold tracking-[-0.035em] text-[#20211e]">资料流</h1>
                <p className="mt-0.5 text-[11px] text-[#858680]">输入、采集与派生结果的永久记录</p>
              </div>
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                aria-label="添加资料"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#242522] px-3 text-[12px] font-medium text-white transition hover:bg-[#3a3b37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4]"
              >
                <CirclePlus size={15} />
                <span className="max-[540px]:hidden">添加资料</span>
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1080px] px-8 pb-12 pt-7 max-[640px]:px-4">
            <div className="mb-4 flex items-center gap-3 max-[720px]:flex-wrap">
              <label className="relative min-w-[220px] flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#969990]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索内容、来源或项目"
                  className="h-9 w-full rounded-md border border-[#dfdfdc] bg-white pl-9 pr-3 text-[12px] text-[#2e302b] outline-none placeholder:text-[#9b9e96] focus:border-[#aaa]"
                />
              </label>
              <div className="flex rounded-md border border-[#dfdfdc] bg-white p-0.5">
                {([
                  ["all", "全部"],
                  ["unfiled", "未归项目"],
                  ["organized", "已归项目"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`h-7 rounded px-2.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-[#5b64f4] ${filter === value ? "bg-[#efefeb] text-[#343630]" : "text-[#81857c] hover:text-[#484b45]"}`}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#efd2cc] bg-[#fff5f2] px-4 py-3 text-[12px] text-[#9b4b42]">
                <span>{error}</span>
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void refresh()}>重试</button>
              </div>
            )}

            {loading ? (
              <div className="space-y-1" aria-label="正在加载资料">
                {[0, 1, 2, 3].map((value) => <div key={value} className="h-14 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}
              </div>
            ) : materialGroups.length ? (
              <>
                <div className="mb-1 grid grid-cols-[minmax(0,1fr)_150px_150px_70px] gap-3 border-b border-[#e8e8e5] px-3 py-2 text-[10.5px] font-medium text-[#92938e] max-[800px]:grid-cols-[minmax(0,1fr)_100px_60px] max-[480px]:grid-cols-[minmax(0,1fr)_50px]">
                  <span>内容</span><span className="max-[480px]:hidden">项目</span><span className="max-[800px]:hidden">来源</span><span>日期</span>
                </div>
                <div>
                  {materialGroups.map((group) => {
                    const material = group.representative;
                    const Icon = materialIcons[material.kind];
                    const duplicate = group.items.length > 1;
                    const expanded = expandedMaterialGroups.has(group.key);
                    const selectedInGroup = group.items.some((item) => item.id === selectedId);
                    const projectLabel = group.projects.length === 0
                      ? "未归项目"
                      : group.projects.length === 1
                        ? group.projects[0]
                        : `${group.projects[0]} 等 ${group.projects.length} 个项目`;
                    return (
                      <div key={group.key}>
                        <button
                          type="button"
                          onClick={() => {
                            if (duplicate) {
                              setExpandedMaterialGroups((current) => {
                                const next = new Set(current);
                                if (next.has(group.key)) next.delete(group.key);
                                else next.add(group.key);
                                return next;
                              });
                              return;
                            }
                            setMaterialMode("peek");
                            navigate({ section: "stream", materialId: material.id });
                          }}
                          aria-expanded={duplicate ? expanded : undefined}
                          className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_150px_150px_70px] items-center gap-3 border-b border-[#eeeeeb] px-3 py-2.5 text-left transition hover:bg-[#f7f7f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5b64f4] max-[800px]:grid-cols-[minmax(0,1fr)_100px_60px] max-[480px]:grid-cols-[minmax(0,1fr)_50px] ${selectedInGroup ? "bg-[#f2f2ef]" : ""}`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            {duplicate ? <ChevronRight size={14} className={`shrink-0 text-[#969792] transition ${expanded ? "rotate-90" : ""}`} /> : <Icon size={15} className="shrink-0 text-[#7b7c77]" />}
                            <span className="truncate text-[12.5px] text-[#3d3e3a]">{material.content}</span>
                            {duplicate && <span className="hidden shrink-0 rounded bg-[#eeeeea] px-1.5 py-0.5 text-[9px] font-medium text-[#777873] max-[800px]:inline-flex">{group.items.length} 条</span>}
                            {group.needsReview && <span className="hidden shrink-0 rounded bg-[#fff3d8] px-1.5 py-0.5 text-[9px] font-medium text-[#8b611d] max-[480px]:inline-flex">待确认</span>}
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5 max-[480px]:hidden">
                            <span className="truncate text-[11px] text-[#73746f]">{projectLabel}</span>
                            {group.needsReview && <span className="shrink-0 rounded bg-[#fff3d8] px-1.5 py-0.5 text-[9px] font-medium text-[#8b611d]">需要确认</span>}
                          </span>
                          <span className="truncate text-[11px] text-[#7f807b] max-[800px]:hidden">{duplicate ? `${group.items.length} 个来源` : sourceName(material)}</span>
                          <span className="text-[10.5px] text-[#9b9c97]">{shortDate(material.createdAt)}</span>
                        </button>
                        {duplicate && expanded && (
                          <div className="border-b border-[#e9e9e5] bg-[#fafaf8] px-3 py-1.5">
                            {group.items.map((instance, index) => (
                              <button
                                key={instance.id}
                                type="button"
                                onClick={() => { setMaterialMode("peek"); navigate({ section: "stream", materialId: instance.id }); }}
                                className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-[#f0f0ed] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5b64f4] ${instance.id === selectedId ? "bg-[#eeeeea]" : ""}`}
                              >
                                <span className="w-6 shrink-0 text-right text-[9.5px] font-medium text-[#aaaba6]">{index + 1}</span>
                                <span className="min-w-0 flex-1 truncate text-[11px] text-[#595a56]">{instance.source?.title || sourceName(instance)}</span>
                                <span className="max-w-32 truncate text-[10px] text-[#8a8b86] max-[480px]:hidden">{instance.projects[0] || "未归项目"}</span>
                                <span className="shrink-0 text-[10px] text-[#a0a19c]">{shortDate(instance.createdAt)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : materials.length === 0 ? (
              <section className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#f0f0ed] text-[#71736d]"><LibraryBig size={19} /></span>
                <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[#3f413c]">收下第一条资料</h2>
                <p className="mt-1.5 max-w-sm text-[12px] leading-5 text-[#858780]">在任何网页通过 Logue 输入或保存选区，原文、来源和后续派生会留在同一条记录链里。</p>
                <button type="button" onClick={() => setShowComposer(true)} className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[12px] font-medium text-white hover:bg-[#3a3b37]"><CirclePlus size={14} /> 添加第一条资料</button>
              </section>
            ) : (
              <section className="rounded-2xl border border-dashed border-[#cfd1ca] bg-white/45 px-6 py-16 text-center">
                <span className="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-[#eef0ea] text-[#747970]"><Search size={19} /></span>
                <h2 className="mt-4 text-[15px] font-semibold text-[#3f423c]">没有符合条件的资料</h2>
                <p className="mt-1 text-[12px] text-[#858980]">尝试更换搜索词或筛选条件。</p>
                <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 h-8 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#62635e] hover:bg-[#f4f4f1]">清除筛选</button>
              </section>
            )}
          </div>
        </main>
      )}

      {section === "stream" && selected && (
        <MaterialDetail
          key={selected.id}
          material={selected}
          mode={materialMode}
          onClose={() => { navigate({ section: "stream" }); setMaterialMode("peek"); }}
          onExpand={() => setMaterialMode("page")}
          onAddAnnotation={addAnnotation}
          onUpdateContent={updateContent}
          onUpdateOrganization={updateOrganization}
          onDelete={removeMaterial}
          onOpenParent={(id) => navigate({ section: "stream", materialId: id })}
          parents={(selected.parentIds ?? []).map((id) => materials.find((item) => item.id === id)).filter((item): item is Material => Boolean(item))}
          dependents={materials.filter((item) => item.parentIds?.includes(selected.id))}
        />
      )}
      {showComposer && <NewMaterialDialog onClose={() => setShowComposer(false)} onSave={addManualMaterial} />}
    </div>
  );
}
