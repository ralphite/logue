import {
  ArrowUpRight,
  ArrowLeft,
  AudioLines,
  Check,
  CircleAlert,
  FileText,
  Link2,
  LoaderCircle,
  Maximize2,
  Mic2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Material } from "@logue/ui";
import { useEffect, useState } from "react";
import { captureAudioURL, getProjects } from "../api";

const icons = {
  voice: Mic2,
  selection: FileText,
  text: FileText,
  derived: Sparkles,
};

const materialTitles = {
  voice: "语音记录",
  selection: "网页选区",
  text: "文字资料",
  derived: "派生内容",
};

export function MaterialDetail({
  material,
  onClose,
  onAddAnnotation,
  onUpdateContent,
  onUpdateOrganization,
  onDelete,
  onOpenParent,
  onExpand,
  mode = "peek",
  parents,
  dependents,
}: {
  material: Material;
  onClose: () => void;
  onAddAnnotation: (text: string) => Promise<void>;
  onUpdateContent: (id: string, content: string) => Promise<void>;
  onUpdateOrganization: (id: string, projects: string[], tags: string[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenParent: (id: string) => void;
  onExpand: () => void;
  mode?: "peek" | "page";
  parents: Material[];
  dependents: Material[];
}) {
  const [annotation, setAnnotation] = useState("");
  const [saving, setSaving] = useState(false);
  const [annotationError, setAnnotationError] = useState<string>();
  const [contentDraft, setContentDraft] = useState(material.content);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentError, setContentError] = useState<string>();
  const [projectOptions, setProjectOptions] = useState<string[]>(material.projects);
  const [projectsDraft, setProjectsDraft] = useState<string[]>(material.projects);
  const [tagsDraft, setTagsDraft] = useState<string[]>(material.tags);
  const [newTag, setNewTag] = useState("");
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [organizationError, setOrganizationError] = useState<string>();
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const Icon = icons[material.kind];
  const hasAudioChain = Boolean(material.captureId);
  const isPage = mode === "page";
  const Root = isPage ? "main" : "aside";
  const dependentCount = dependents.length;
  const hasSource = Boolean(
    material.source?.url ||
      material.source?.title ||
      material.source?.domain ||
      material.source?.selection,
  );
  const normalizedContentDraft = contentDraft.trim();
  const contentChanged = normalizedContentDraft !== material.content;
  const needsReview = material.organization?.status === "needs_review";
  const suggestedProjects = material.organization?.suggested_projects ?? [];
  const suggestedTags = material.organization?.suggested_tags ?? [];
  const hasOrganizationSuggestion = suggestedProjects.length > 0 || suggestedTags.length > 0;

  useEffect(() => {
    setContentDraft(material.content);
    setContentError(undefined);
  }, [material.content]);

  useEffect(() => {
    let cancelled = false;
    void getProjects()
      .then((items) => {
        if (cancelled) return;
        setProjectOptions(Array.from(new Set([...material.projects, ...items.map((item) => item.name)])));
      })
      .catch(() => {
        // Existing assignments remain editable even if the project index is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [material.projects]);

  async function submitAnnotation() {
    if (!annotation.trim() || saving) return;
    setSaving(true);
    setAnnotationError(undefined);
    try {
      await onAddAnnotation(annotation.trim());
      setAnnotation("");
    } catch (cause) {
      setAnnotationError(cause instanceof Error ? cause.message : "无法保存批注");
    } finally {
      setSaving(false);
    }
  }

  async function saveContent() {
    if (!normalizedContentDraft || !contentChanged || contentSaving) return;
    setContentSaving(true);
    setContentError(undefined);
    try {
      await onUpdateContent(material.id, normalizedContentDraft);
      setContentDraft(normalizedContentDraft);
    } catch (cause) {
      setContentError(cause instanceof Error ? cause.message : "无法保存内容");
    } finally {
      setContentSaving(false);
    }
  }

  async function saveOrganization(nextProjects: string[], nextTags: string[], previousProjects: string[], previousTags: string[]) {
    if (organizationSaving) return;
    setProjectsDraft(nextProjects);
    setTagsDraft(nextTags);
    setOrganizationSaving(true);
    setOrganizationError(undefined);
    try {
      await onUpdateOrganization(material.id, nextProjects, nextTags);
    } catch (cause) {
      setProjectsDraft(previousProjects);
      setTagsDraft(previousTags);
      setOrganizationError(cause instanceof Error ? cause.message : "无法更新组织信息");
    } finally {
      setOrganizationSaving(false);
    }
  }

  function toggleProject(project: string) {
    if (organizationSaving) return;
    const next = projectsDraft.includes(project)
      ? projectsDraft.filter((item) => item !== project)
      : [...projectsDraft, project];
    void saveOrganization(next, tagsDraft, projectsDraft, tagsDraft);
  }

  function addTag() {
    const value = newTag.trim().replace(/^#/, "");
    if (!value || tagsDraft.includes(value) || organizationSaving) return;
    setNewTag("");
    void saveOrganization(projectsDraft, [...tagsDraft, value], projectsDraft, tagsDraft);
  }

  function removeTag(tag: string) {
    if (organizationSaving) return;
    void saveOrganization(projectsDraft, tagsDraft.filter((item) => item !== tag), projectsDraft, tagsDraft);
  }

  function reviewOrganization(adoptSuggestion: boolean) {
    const nextProjects = adoptSuggestion
      ? Array.from(new Set([...projectsDraft, ...suggestedProjects]))
      : projectsDraft;
    const nextTags = adoptSuggestion
      ? Array.from(new Set([...tagsDraft, ...suggestedTags]))
      : tagsDraft;
    void saveOrganization(nextProjects, nextTags, projectsDraft, tagsDraft);
  }

  async function remove() {
    if (removing) return;
    setRemoving(true);
    setDeleteError(undefined);
    try {
      await onDelete(material.id);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "无法删除资料");
      setRemoving(false);
    }
  }

  return (
    <Root className={isPage ? "flex h-screen min-w-0 flex-1 flex-col bg-white" : "flex h-screen w-[390px] shrink-0 flex-col border-l border-[#e1e1dd] bg-white max-[1180px]:fixed max-[1180px]:inset-y-0 max-[1180px]:right-0 max-[1180px]:z-30 max-[1180px]:shadow-[-18px_0_54px_rgba(31,33,28,0.11)] max-[640px]:w-full max-[640px]:pb-16"}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#eeeeeb] px-4">
        {isPage ? <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] text-[#71726d] hover:bg-[#f1f1ee]"><ArrowLeft size={14} /> 资料流</button> : <div className="flex items-center gap-2.5"><span className="text-[11.5px] text-[#777873]">资料流</span><span className="text-[#b7b8b3]">/</span><span className="text-[11.5px] text-[#4f504c]">{materialTitles[material.kind]}</span></div>}
        {!isPage && <div className="flex items-center"><button onClick={onExpand} className="inline-flex size-11 items-center justify-center rounded-md text-[#858680] hover:bg-[#f1f1ee] hover:text-[#444541] focus-visible:outline-2 focus-visible:outline-[#5b64f4]" aria-label="打开完整页面" title="打开完整页面" type="button"><Maximize2 size={16} /></button><button onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-md text-[#858680] hover:bg-[#f1f1ee] hover:text-[#444541] focus-visible:outline-2 focus-visible:outline-[#5b64f4]" aria-label="关闭详情" type="button"><X size={18} /></button></div>}
      </header>

      <div className={`flex-1 overflow-y-auto pb-10 ${isPage ? "mx-auto w-full max-w-[820px] px-[9%] pt-14 max-[640px]:px-5 max-[640px]:pt-9" : "px-5 pt-8"}`}>
        <div className="mb-8">
          <span className={`inline-flex items-center justify-center rounded-md bg-[#f0f0ed] text-[#6e6f6a] ${isPage ? "size-11" : "size-9"}`}><Icon size={isPage ? 21 : 17} /></span>
          <h1 className={`mt-4 font-bold tracking-[-0.04em] text-[#242522] ${isPage ? "text-[38px] max-[640px]:text-[30px]" : "text-[28px]"}`}>{materialTitles[material.kind]}</h1>
          <div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[#92938e] ${isPage ? "text-[11px]" : "text-[10.5px]"}`}>
            <span>{material.projects[0] || "未归项目"}</span>
            <span>·</span>
            <span>{new Date(material.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</span>
            {dependentCount > 0 && <><span>·</span><span>{dependentCount} 条后续内容</span></>}
          </div>
        </div>
        {needsReview && (
          <section className="mb-7 flex items-start gap-2.5 rounded-md border border-[#e7d5a8] bg-[#fffaf0] px-3 py-2.5" aria-label="需要确认">
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-[#9a6a20]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-[11px] font-semibold text-[#79551f]">需要确认</p>
                {material.organization?.confidence !== undefined && (
                  <span className="text-[9.5px] text-[#a17f49]">Agent 置信度 {Math.round(material.organization.confidence * 100)}%</span>
                )}
              </div>
              <p className="mt-0.5 text-[10.5px] leading-4 text-[#896b3c]">{material.organization?.reason || "请确认项目和标签是否准确"}</p>
              {hasOrganizationSuggestion && (
                <div className="mt-2">
                  <p className="text-[9.5px] font-medium text-[#9a7640]">Agent 建议</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {suggestedProjects.map((project) => <span key={`project-${project}`} className="rounded border border-[#eadbb9] bg-white/70 px-1.5 py-0.5 text-[9.5px] text-[#765c34]">{project}</span>)}
                    {suggestedTags.map((tag) => <span key={`tag-${tag}`} className="rounded border border-[#eadbb9] bg-white/70 px-1.5 py-0.5 text-[9.5px] text-[#765c34]">#{tag}</span>)}
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hasOrganizationSuggestion && <button type="button" disabled={organizationSaving} onClick={() => reviewOrganization(true)} className="h-7 rounded-md bg-[#805f2f] px-2.5 text-[10px] font-medium text-white hover:bg-[#6d5028] disabled:opacity-50">采用建议</button>}
                <button type="button" disabled={organizationSaving} onClick={() => reviewOrganization(false)} className="h-7 rounded-md border border-[#e3d2aa] bg-white/60 px-2.5 text-[10px] font-medium text-[#765c34] hover:bg-white disabled:opacity-50">保持现状</button>
              </div>
            </div>
          </section>
        )}
        {hasSource && material.source && (
          <section className="mb-7">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#72766d]">
              <Link2 size={13} /> 来源页面
            </div>
            <p className="text-[13px] font-medium leading-5 text-[#343630]">
              {material.source.title || material.source.domain || "网页来源"}
            </p>
            {material.source.url && (
              <a
                href={material.source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-[#6269d4] hover:text-[#4149c5] focus-visible:outline-2 focus-visible:outline-[#5b64f4]"
              >
                <span className="truncate">{material.source.domain || material.source.url}</span>
                <ArrowUpRight size={12} className="shrink-0" />
              </a>
            )}
          </section>
        )}

        {hasAudioChain ? (
          <section aria-label="语音记录链">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[12px] font-semibold text-[#4f504c]">记录链</h2>
              <span className="inline-flex items-center gap-1 text-[10px] text-[#858680]"><Check size={11} /> 原始记录保持不变</span>
            </div>
            <ol className="mt-5 ml-3 border-l border-[#dcdcd7]">
              <li className="relative pb-7 pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#d7d7d2] bg-white text-[#6f706b]"><Mic2 size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[11.5px] font-semibold text-[#4c4d49]">原始录音</h3><span className="text-[9.5px] text-[#9a9b96]">原件</span></div>
                <p className="mt-0.5 text-[10.5px] text-[#92938e]">保存的声音，可随时回听核对</p>
                <audio controls preload="metadata" src={captureAudioURL(material.captureId!)} className="mt-3 h-9 w-full" aria-label="播放原始录音" />
              </li>
              <li className="relative pb-7 pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#d7d7d2] bg-white text-[#6f706b]"><FileText size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[11.5px] font-semibold text-[#4c4d49]">机器转写</h3><span className="text-[9.5px] text-[#9a9b96]">原始结果</span></div>
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#747570]">{material.transcript || "没有保存机器转写"}</p>
              </li>
              <li className="relative pb-7 pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#bec8bc] bg-[#edf2eb] text-[#557057]"><Check size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[11.5px] font-semibold text-[#42453f]">最终采用文字</h3><span className="text-[9.5px] font-medium text-[#638064]">已采用</span></div>
                <textarea
                  aria-label="编辑资料内容"
                  value={contentDraft}
                  onChange={(event) => setContentDraft(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-y border-0 bg-transparent p-0 text-[13.5px] leading-6 text-[#30312d] outline-none placeholder:text-[#a1a39d]"
                />
                {(contentChanged || contentSaving || contentError) && (
                  <div className="mt-2">
                    {contentError && <p className="mb-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[10.5px] leading-4 text-[#a34b42]">{contentError}</p>}
                    <button data-testid="material-content-save" type="button" onClick={() => void saveContent()} disabled={!normalizedContentDraft || !contentChanged || contentSaving} className="inline-flex h-8 items-center justify-center rounded-md bg-[#242522] px-3 text-[10.5px] font-medium text-white hover:bg-[#393a36] disabled:bg-[#c8cad2]">
                      {contentSaving ? "保存中…" : "保存"}
                    </button>
                  </div>
                )}
              </li>
              <li className="relative pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#d7d7d2] bg-white text-[#6f706b]"><Sparkles size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[11.5px] font-semibold text-[#4c4d49]">后续内容</h3><span className="text-[9.5px] text-[#9a9b96]">{dependentCount} 条</span></div>
                {dependents.length > 0 ? (
                  <div className="mt-2 divide-y divide-[#eeeeeb]">
                    {dependents.map((dependent) => (
                      <button key={dependent.id} type="button" onClick={() => onOpenParent(dependent.id)} className="group flex w-full items-start gap-2 py-2.5 text-left hover:text-[#3e45b7]">
                        <span className="line-clamp-2 min-w-0 flex-1 text-[11.5px] leading-5 text-[#676863] group-hover:text-[#4f56bd]">{dependent.content}</span>
                        <ArrowUpRight size={12} className="mt-1 shrink-0 text-[#aaa]" />
                      </button>
                    ))}
                  </div>
                ) : <p className="mt-1 text-[10.5px] text-[#9a9b96]">还没有派生批注或后续内容</p>}
              </li>
            </ol>
          </section>
        ) : (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#858980]">{material.kind === "selection" ? "原始选区" : material.kind === "derived" ? "派生内容" : "原始内容"}</h3>
              {!contentChanged && <span className="text-[10px] font-medium text-[#9a9b96]">可编辑</span>}
            </div>
            <textarea
              aria-label="编辑资料内容"
              value={contentDraft}
              onChange={(event) => setContentDraft(event.target.value)}
              className="min-h-32 w-full resize-y border-0 bg-transparent p-0 text-[13.5px] leading-6 text-[#30312d] outline-none placeholder:text-[#a1a39d]"
            />
            {(contentChanged || contentSaving || contentError) && (
              <div className="mt-2">
                {contentError && <p className="mb-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[10.5px] leading-4 text-[#a34b42]">{contentError}</p>}
                <button data-testid="material-content-save" type="button" onClick={() => void saveContent()} disabled={!normalizedContentDraft || !contentChanged || contentSaving} className="inline-flex h-8 items-center justify-center rounded-md bg-[#242522] px-3 text-[10.5px] font-medium text-white hover:bg-[#393a36] disabled:bg-[#c8cad2]">
                  {contentSaving ? "保存中…" : "保存"}
                </button>
              </div>
            )}
          </section>
        )}

        {material.appliedContext && (
          <section className="mt-7 bg-[#fafaf8] px-3.5 py-3">
            <div className="flex items-center justify-between gap-3"><h3 className="text-[11px] font-semibold text-[#656761]">本次实际参考</h3><span className="text-[9.5px] text-[#999a95]">转写时已记录</span></div>
            <div className="mt-3 space-y-2 text-[11px] leading-5 text-[#696a65]">
              <p><span className="font-medium text-[#4d4e4a]">页面：</span>{material.appliedContext.page_title || material.source?.title || "当前网页"}</p>
              <p><span className="font-medium text-[#4d4e4a]">项目：</span>{material.appliedContext.reference_project || "未使用项目"}</p>
              <p><span className="font-medium text-[#4d4e4a]">已确认术语：</span>{material.appliedContext.glossary?.length ?? 0} 个</p>
              <p><span className="font-medium text-[#4d4e4a]">近期采用表达：</span>{material.appliedContext.recent_adopted_ids?.length ?? 0} 条</p>
            </div>
            {material.appliedContext.recent_adopted_texts?.length ? <details className="mt-2"><summary className="cursor-pointer text-[10.5px] font-medium text-[#6469c8]">查看实际采用的表达</summary><ul className="mt-2 space-y-1 border-l-2 border-[#dfe0f4] pl-3 text-[10.5px] leading-4 text-[#73746f]">{material.appliedContext.recent_adopted_texts.map((text, index) => <li key={`${index}-${text.slice(0, 12)}`}>{text}</li>)}</ul></details> : null}
          </section>
        )}

        {material.annotation && (
          <section className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#858980]">已有批注</h3>
            <div className="border-l-2 border-[#cfd1ca] pl-3">
              <div className="mb-1.5 flex items-center gap-2 text-[#777873]">
                <AudioLines size={14} />
                <span className="text-[11px] font-semibold">批注</span>
              </div>
              <p className="text-[13px] leading-5 text-[#4b4f59]">{material.annotation}</p>
            </div>
          </section>
        )}

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#858980]">组织</h3>
            {(organizationSaving || material.organization?.status === "pending") && <span className="inline-flex items-center gap-1 text-[10px] text-[#8b8c87]"><LoaderCircle size={11} className="animate-spin motion-reduce:animate-none" /> {organizationSaving ? "保存中" : "自动整理中"}</span>}
          </div>
          <div>
            <p className="mb-1.5 text-[10.5px] text-[#8b8c87]">项目</p>
            <div className="flex flex-wrap gap-1.5">
              {projectOptions.map((project) => {
                const selected = projectsDraft.includes(project);
                return <button key={project} type="button" disabled={organizationSaving} onClick={() => toggleProject(project)} aria-pressed={selected} className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10.5px] transition ${selected ? "border-[#b9c4b8] bg-[#edf2eb] text-[#4f684f]" : "border-[#deded9] bg-white text-[#777873] hover:bg-[#f7f7f5]"}`}>{selected && <Check size={11} />}{project}</button>;
              })}
              {projectOptions.length === 0 && <span className="text-[10.5px] text-[#a0a19c]">还没有项目</span>}
            </div>
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-[10.5px] text-[#8b8c87]">标签</p>
            <div className="flex flex-wrap gap-1.5">
              {tagsDraft.map((tag) => <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e0e1dc] px-2.5 text-[10.5px] text-[#74786f]">#{tag}<button type="button" disabled={organizationSaving} onClick={() => removeTag(tag)} className="text-[#a0a19c] hover:text-[#555651]" aria-label={`移除标签 ${tag}`}><X size={10} /></button></span>)}
              <input value={newTag} disabled={organizationSaving} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } }} onBlur={addTag} className="h-7 min-w-28 flex-1 rounded-md border border-[#deded9] px-2.5 text-[10.5px] outline-none placeholder:text-[#a8a9a4] focus:border-[#aaa]" placeholder="添加标签后按 Enter" aria-label="添加标签" />
            </div>
          </div>
          {organizationError && <p className="mt-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[10.5px] leading-4 text-[#a34b42]">{organizationError}</p>}
        </section>

        {parents.length > 0 ? (
          <section className="mt-7">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#70746b]"><Sparkles size={13} className="text-[#6b72de]" /> 派生自 {parents.length} 条资料</div>
            <div className="divide-y divide-[#eeeeeb]">{parents.map((parent) => <button key={parent.id} type="button" onClick={() => onOpenParent(parent.id)} className="group flex w-full items-start gap-2 py-2.5 text-left"><span className="line-clamp-2 min-w-0 flex-1 text-[11.5px] leading-5 text-[#676863] group-hover:text-[#4f56bd]">{parent.content}</span><ArrowUpRight size={12} className="mt-1 shrink-0 text-[#aaa]" /></button>)}</div>
          </section>
        ) : null}
      </div>

      <footer className={isPage ? "mx-auto w-full max-w-[820px] shrink-0 border-t border-[#e7e7e2] bg-[#fcfcfa] px-[9%] py-4 max-[640px]:px-3 max-[640px]:py-2" : "shrink-0 border-t border-[#e7e7e2] bg-[#fcfcfa] p-4 max-[640px]:p-1"}>
        <label className="mb-2 block text-[11px] font-semibold text-[#656961] max-[640px]:sr-only" htmlFor="detail-annotation">
          追加批注
        </label>
        <div className="max-[640px]:flex max-[640px]:items-stretch max-[640px]:gap-2">
          <textarea
            id="detail-annotation"
            value={annotation}
            onChange={(event) => setAnnotation(event.target.value)}
            placeholder="补充说明，或记录下一步…"
            className="min-h-16 w-full resize-none rounded-md border border-[#dadcd5] bg-white px-3 py-2.5 text-[12px] leading-5 outline-none placeholder:text-[#a1a49c] focus:border-[#aaa] max-[640px]:h-11 max-[640px]:min-h-11 max-[640px]:min-w-0 max-[640px]:resize-none max-[640px]:py-2.5"
          />
          <button
            type="button"
            onClick={submitAnnotation}
            disabled={!annotation.trim() || saving}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#242522] text-[11px] font-medium text-white transition hover:bg-[#393a36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4] disabled:cursor-not-allowed disabled:bg-[#c8cad2] max-[640px]:mt-0 max-[640px]:h-11 max-[640px]:w-auto max-[640px]:shrink-0 max-[640px]:px-3"
          >
            {saving ? "保存中…" : "保存批注"}
          </button>
        </div>
        {annotationError && <p className="mt-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[10.5px] leading-4 text-[#a34b42]">{annotationError}</p>}
        {deleteConfirming ? (
          <div className="mt-2 rounded-md border border-[#efd3ce] bg-[#fff8f6] p-3">
            <p className="text-[10.5px] leading-4 text-[#8e4a43]">确认删除这条{materialTitles[material.kind]}？原始音频会在不再被引用时一并删除。{dependentCount > 0 ? `${dependentCount} 条派生资料会保留。` : ""}</p>
            {deleteError && <p className="mt-1 text-[10px] text-[#b0443a]">{deleteError}</p>}
            <div className="mt-2 flex justify-end gap-1.5"><button type="button" disabled={removing} onClick={() => { setDeleteConfirming(false); setDeleteError(undefined); }} className="h-7 rounded px-2.5 text-[10.5px] text-[#6d6e69] hover:bg-white">取消</button><button type="button" disabled={removing} onClick={() => void remove()} className="inline-flex h-7 items-center gap-1.5 rounded bg-[#b2483f] px-2.5 text-[10.5px] font-medium text-white disabled:bg-[#cf9a95]">{removing && <LoaderCircle size={11} className="animate-spin motion-reduce:animate-none" />}{removing ? "删除中…" : "确认删除"}</button></div>
          </div>
        ) : (
          <button type="button" onClick={() => setDeleteConfirming(true)} className="mt-1 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[10.5px] font-medium text-[#a54b42] hover:bg-[#f9ece9] max-[640px]:h-11"><Trash2 size={12} /> 删除这条{materialTitles[material.kind]}{dependentCount > 0 ? ` · ${dependentCount} 条派生关系` : ""}</button>
        )}
      </footer>
    </Root>
  );
}
