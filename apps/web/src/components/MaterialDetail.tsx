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
  MessageSquareText,
  Mic2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Material } from "@logue/ui";
import { useEffect, useState, type CSSProperties } from "react";
import { captureAudioURL, getProjects } from "../api";
import { RecordingAudioPlayer } from "./RecordingAudioPlayer";
import { readingColumnClass } from "./layout";

const icons = {
  voice: Mic2,
  selection: FileText,
  text: FileText,
  derived: Sparkles,
};

const materialTitles = {
  voice: "Voice note",
  selection: "Web selection",
  text: "Note",
  derived: "Derived content",
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
  originLabel = "Library",
  mode = "peek",
  peekWidth,
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
  originLabel?: string;
  mode?: "peek" | "page";
  peekWidth?: number;
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
  const commentSource = parents.find((parent) => parent.kind === "selection");
  const isComment = material.kind === "derived"
    && (!material.actor || material.actor.toLowerCase() === "user")
    && Boolean(commentSource);
  const detailTitle = isComment ? (material.captureId ? "Voice comment" : "Comment") : materialTitles[material.kind];
  const Icon = isComment ? (material.captureId ? Mic2 : MessageSquareText) : icons[material.kind];
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
      setAnnotationError(cause instanceof Error ? cause.message : "Could not save annotation");
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
      setContentError(cause instanceof Error ? cause.message : "Could not save content");
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
      setOrganizationError(cause instanceof Error ? cause.message : "Could not update organization");
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
      setDeleteError(cause instanceof Error ? cause.message : "Could not delete material");
      setRemoving(false);
    }
  }

  return (
    <Root
      data-testid="material-detail-scroll"
      style={!isPage ? ({ "--material-detail-width": peekWidth ? `${peekWidth}px` : "min(620px, 46vw)" } as CSSProperties) : undefined}
      className={isPage ? "flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-white" : "flex h-screen w-[var(--material-detail-width)] min-w-[440px] shrink-0 flex-col overflow-hidden bg-white max-[1180px]:fixed max-[1180px]:inset-y-0 max-[1180px]:right-0 max-[1180px]:z-30 max-[1180px]:border-l max-[1180px]:border-[#e1e1dd] max-[1180px]:shadow-[-18px_0_54px_rgba(31,33,28,0.11)] max-[640px]:w-full max-[640px]:min-w-0 max-[640px]:pb-16"}
    >
      <header className="z-10 flex h-12 shrink-0 items-center justify-between border-b border-[#eeeeeb] bg-white/95 px-4 backdrop-blur-xl">
        {isPage ? <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[15px] text-[#71726d] hover:bg-[#f1f1ee]"><ArrowLeft size={14} /> {originLabel}</button> : <div className="flex items-center gap-2.5"><span className="text-[15px] text-[#777873]">{originLabel}</span><span className="text-[#b7b8b3]">/</span><span className="text-[15px] text-[#4f504c]">{detailTitle}</span></div>}
        {!isPage && <div className="flex items-center"><button onClick={onExpand} className="inline-flex size-11 items-center justify-center rounded-md text-[#858680] hover:bg-[#f1f1ee] hover:text-[#444541] focus-visible:outline-2 focus-visible:outline-[#5b64f4]" aria-label="Open full page" title="Open full page" type="button"><Maximize2 size={16} /></button><button onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-md text-[#858680] hover:bg-[#f1f1ee] hover:text-[#444541] focus-visible:outline-2 focus-visible:outline-[#5b64f4]" aria-label="Close details" type="button"><X size={18} /></button></div>}
      </header>

      <div data-testid="material-detail-reading-column" className={`scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain ${isPage ? `${readingColumnClass} pb-10 pt-14 max-[640px]:pb-5 max-[640px]:pt-9` : "px-5 pb-8 pt-8 max-[640px]:px-4 max-[640px]:pb-4"}`}>
        <div data-testid="material-detail-content">
        <div className="mb-8">
          <span className={`inline-flex items-center justify-center rounded-md bg-[#f0f0ed] text-[#6e6f6a] ${isPage ? "size-11" : "size-9"}`}><Icon size={isPage ? 21 : 17} /></span>
          <h1 className={`mt-4 font-bold tracking-[-0.04em] text-[#242522] ${isPage ? "text-[38px] max-[640px]:text-[30px]" : "text-[28px]"}`}>{detailTitle}</h1>
          <div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[#92938e] ${isPage ? "text-[15px]" : "text-[14px]"}`}>
            <span>{material.projects[0] || "Unfiled"}</span>
            <span>·</span>
            <span>{new Date(material.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            {dependentCount > 0 && <><span>·</span><span>{dependentCount} follow-up {dependentCount === 1 ? "item" : "items"}</span></>}
          </div>
        </div>
        {needsReview && (
          <section className="mb-7 flex items-start gap-2.5 rounded-md border border-[#e7d5a8] bg-[#fffaf0] px-3 py-2.5" aria-label="Needs review">
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-[#9a6a20]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-[15px] font-semibold text-[#79551f]">Needs review</p>
                {material.organization?.confidence !== undefined && (
                  <span className="text-[14px] text-[#a17f49]">Confidence {Math.round(material.organization.confidence * 100)}%</span>
                )}
              </div>
              <p className="mt-0.5 text-[14px] leading-4 text-[#896b3c]">{material.organization?.reason || "Check whether the project and tags are correct"}</p>
              {hasOrganizationSuggestion && (
                <div className="mt-2">
                  <p className="text-[14px] font-medium text-[#9a7640]">Suggestion</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {suggestedProjects.map((project) => <span key={`project-${project}`} className="rounded border border-[#eadbb9] bg-white/70 px-1.5 py-0.5 text-[14px] text-[#765c34]">{project}</span>)}
                    {suggestedTags.map((tag) => <span key={`tag-${tag}`} className="rounded border border-[#eadbb9] bg-white/70 px-1.5 py-0.5 text-[14px] text-[#765c34]">#{tag}</span>)}
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hasOrganizationSuggestion && <button type="button" disabled={organizationSaving} onClick={() => reviewOrganization(true)} className="h-7 rounded-md bg-[#805f2f] px-2.5 text-[14px] font-medium text-white hover:bg-[#6d5028] disabled:opacity-50">Apply suggestion</button>}
                <button type="button" disabled={organizationSaving} onClick={() => reviewOrganization(false)} className="h-7 rounded-md border border-[#e3d2aa] bg-white/60 px-2.5 text-[14px] font-medium text-[#765c34] hover:bg-white disabled:opacity-50">Keep current</button>
              </div>
            </div>
          </section>
        )}
        {hasSource && material.source && (
          <section className="mb-7">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#72766d]">
              <Link2 size={13} /> Source page
            </div>
            <p className="text-[15px] font-medium leading-5 text-[#343630]">
              {material.source.title || material.source.domain || "Web source"}
            </p>
            {material.source.url && (
              <a
                href={material.source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-1 text-[15px] font-medium text-[#6269d4] hover:text-[#4149c5] focus-visible:outline-2 focus-visible:outline-[#5b64f4]"
              >
                <span className="truncate">{material.source.domain || material.source.url}</span>
                <ArrowUpRight size={12} className="shrink-0" />
              </a>
            )}
          </section>
        )}

        {isComment && commentSource && (
          <section className="mb-7" aria-label="Selected text">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#72766d]"><FileText size={13} /> Selected text</div>
            <button type="button" onClick={() => onOpenParent(commentSource.id)} className="group w-full border-l-2 border-[#d7d7d2] pl-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4]">
              <span className="line-clamp-4 block text-[15px] leading-6 text-[#5f615b] group-hover:text-[#454a9e]">{commentSource.content}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[14px] font-medium text-[#7c7f77] group-hover:text-[#545bc2]">Open evidence <ArrowUpRight size={11} /></span>
            </button>
          </section>
        )}

        {hasAudioChain ? (
          <section aria-label="Voice history">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-[#4f504c]">{isComment ? "Voice comment" : "History"}</h2>
              {!isComment && <span className="inline-flex items-center gap-1 text-[14px] text-[#858680]"><Check size={11} /> Original record remains unchanged</span>}
            </div>
            <ol className="mt-5 ml-3 border-l border-[#dcdcd7]">
              <li className="relative pb-7 pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#d7d7d2] bg-white text-[#6f706b]"><Mic2 size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[15px] font-semibold text-[#4c4d49]">Original audio</h3><span className="text-[14px] text-[#9a9b96]">Original</span></div>
                <p className="mt-0.5 text-[14px] text-[#92938e]">Saved audio for playback and verification</p>
                <RecordingAudioPlayer src={captureAudioURL(material.captureId!)} label="Play original audio" />
              </li>
              <li className="relative pb-7 pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#d7d7d2] bg-white text-[#6f706b]"><FileText size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[15px] font-semibold text-[#4c4d49]">Machine transcript</h3><span className="text-[14px] text-[#9a9b96]">Original result</span></div>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-5 text-[#747570]">{material.transcript || "No machine transcript was saved"}</p>
              </li>
              <li className="relative pb-7 pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#bec8bc] bg-[#edf2eb] text-[#557057]"><Check size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[15px] font-semibold text-[#42453f]">{isComment ? "Comment" : "Final text"}</h3><span className="text-[14px] font-medium text-[#638064]">{isComment ? "You" : "Adopted"}</span></div>
                <textarea
                  aria-label="Edit material content"
                  value={contentDraft}
                  onChange={(event) => setContentDraft(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-y border-0 bg-transparent p-0 text-[13.5px] leading-6 text-[#30312d] outline-none placeholder:text-[#a1a39d]"
                />
                {(contentChanged || contentSaving || contentError) && (
                  <div className="mt-2">
                    {contentError && <p className="mb-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[14px] leading-4 text-[#a34b42]">{contentError}</p>}
                    <button data-testid="material-content-save" type="button" onClick={() => void saveContent()} disabled={!normalizedContentDraft || !contentChanged || contentSaving} className="inline-flex h-8 items-center justify-center rounded-md bg-[#242522] px-3 text-[14px] font-medium text-white hover:bg-[#393a36] disabled:bg-[#c8cad2]">
                      {contentSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </li>
              <li className="relative pl-6">
                <span className="absolute -left-3 top-0 inline-flex size-6 items-center justify-center rounded-full border border-[#d7d7d2] bg-white text-[#6f706b]"><Sparkles size={12} /></span>
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[15px] font-semibold text-[#4c4d49]">Follow-up content</h3><span className="text-[14px] text-[#9a9b96]">{dependentCount} {dependentCount === 1 ? "item" : "items"}</span></div>
                {dependents.length > 0 ? (
                  <div className="mt-2 divide-y divide-[#eeeeeb]">
                    {dependents.map((dependent) => (
                      <button key={dependent.id} type="button" onClick={() => onOpenParent(dependent.id)} className="group flex w-full items-start gap-2 py-2.5 text-left hover:text-[#3e45b7]">
                        <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-5 text-[#676863] group-hover:text-[#4f56bd]">{dependent.content}</span>
                        <ArrowUpRight size={12} className="mt-1 shrink-0 text-[#aaa]" />
                      </button>
                    ))}
                  </div>
                ) : <p className="mt-1 text-[14px] text-[#9a9b96]">No derived annotations or follow-up content yet</p>}
              </li>
            </ol>
          </section>
        ) : (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-[#858980]">{isComment ? "Comment" : material.kind === "selection" ? "Original selection" : material.kind === "derived" ? "Derived content" : "Original content"}</h3>
              {!contentChanged && <span className="text-[14px] font-medium text-[#9a9b96]">Editable</span>}
            </div>
            <textarea
              aria-label="Edit material content"
              value={contentDraft}
              onChange={(event) => setContentDraft(event.target.value)}
              className="min-h-32 w-full resize-y border-0 bg-transparent p-0 text-[13.5px] leading-6 text-[#30312d] outline-none placeholder:text-[#a1a39d]"
            />
            {(contentChanged || contentSaving || contentError) && (
              <div className="mt-2">
                {contentError && <p className="mb-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[14px] leading-4 text-[#a34b42]">{contentError}</p>}
                <button data-testid="material-content-save" type="button" onClick={() => void saveContent()} disabled={!normalizedContentDraft || !contentChanged || contentSaving} className="inline-flex h-8 items-center justify-center rounded-md bg-[#242522] px-3 text-[14px] font-medium text-white hover:bg-[#393a36] disabled:bg-[#c8cad2]">
                  {contentSaving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </section>
        )}

        {material.appliedContext && (
          <section className="mt-7 bg-[#fafaf8] px-3.5 py-3">
            <div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold text-[#656761]">Actual context</h3><span className="text-[14px] text-[#999a95]">Recorded at transcription time</span></div>
            <div className="mt-3 space-y-2 text-[15px] leading-5 text-[#696a65]">
              <p><span className="font-medium text-[#4d4e4a]">Page: </span>{material.appliedContext.page_title || material.source?.title || "Current page"}</p>
              <p><span className="font-medium text-[#4d4e4a]">Project: </span>{material.appliedContext.reference_project || "No project"}</p>
              <p><span className="font-medium text-[#4d4e4a]">Confirmed terms: </span>{material.appliedContext.glossary?.length ?? 0}</p>
              <p><span className="font-medium text-[#4d4e4a]">Recent adopted phrases: </span>{material.appliedContext.recent_adopted_ids?.length ?? 0}</p>
            </div>
            {material.appliedContext.recent_adopted_texts?.length ? <details className="mt-2"><summary className="cursor-pointer text-[14px] font-medium text-[#6469c8]">View adopted phrases</summary><ul className="mt-2 space-y-1 border-l-2 border-[#dfe0f4] pl-3 text-[14px] leading-4 text-[#73746f]">{material.appliedContext.recent_adopted_texts.map((text, index) => <li key={`${index}-${text.slice(0, 12)}`}>{text}</li>)}</ul></details> : null}
          </section>
        )}

        {material.annotation && (
          <section className="mt-5">
            <h3 className="mb-2 text-[15px] font-semibold uppercase tracking-[0.12em] text-[#858980]">Existing annotations</h3>
            <div className="border-l-2 border-[#cfd1ca] pl-3">
              <div className="mb-1.5 flex items-center gap-2 text-[#777873]">
                <AudioLines size={14} />
                <span className="text-[15px] font-semibold">Annotation</span>
              </div>
              <p className="text-[15px] leading-5 text-[#4b4f59]">{material.annotation}</p>
            </div>
          </section>
        )}

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-[#858980]">Organization</h3>
            {(organizationSaving || material.organization?.status === "pending") && <span className="inline-flex items-center gap-1 text-[14px] text-[#8b8c87]"><LoaderCircle size={11} className="animate-spin motion-reduce:animate-none" /> {organizationSaving ? "Saving" : "Organizing automatically"}</span>}
          </div>
          <div>
            <p className="mb-1.5 text-[14px] text-[#8b8c87]">Projects</p>
            <div className="flex flex-wrap gap-1.5">
              {projectOptions.map((project) => {
                const selected = projectsDraft.includes(project);
                return <button key={project} type="button" disabled={organizationSaving} onClick={() => toggleProject(project)} aria-pressed={selected} className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[14px] transition ${selected ? "border-[#b9c4b8] bg-[#edf2eb] text-[#4f684f]" : "border-[#deded9] bg-white text-[#777873] hover:bg-[#f7f7f5]"}`}>{selected && <Check size={11} />}{project}</button>;
              })}
              {projectOptions.length === 0 && <span className="text-[14px] text-[#a0a19c]">No projects yet</span>}
            </div>
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-[14px] text-[#8b8c87]">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tagsDraft.map((tag) => <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e0e1dc] px-2.5 text-[14px] text-[#74786f]">#{tag}<button type="button" disabled={organizationSaving} onClick={() => removeTag(tag)} className="text-[#a0a19c] hover:text-[#555651]" aria-label={`Remove tag ${tag}`}><X size={10} /></button></span>)}
              <input value={newTag} disabled={organizationSaving} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } }} onBlur={addTag} className="h-7 min-w-28 flex-1 rounded-md border border-[#deded9] px-2.5 text-[14px] outline-none placeholder:text-[#a8a9a4] focus:border-[#aaa]" placeholder="Add a tag, then press Enter" aria-label="Add tag" />
            </div>
          </div>
          {organizationError && <p className="mt-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[14px] leading-4 text-[#a34b42]">{organizationError}</p>}
        </section>

        {parents.length > 0 && !isComment ? (
          <section className="mt-7">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#70746b]"><Sparkles size={13} className="text-[#6b72de]" /> Derived from {parents.length} {parents.length === 1 ? "item" : "items"}</div>
            <div className="divide-y divide-[#eeeeeb]">{parents.map((parent) => <button key={parent.id} type="button" onClick={() => onOpenParent(parent.id)} className="group flex w-full items-start gap-2 py-2.5 text-left"><span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-5 text-[#676863] group-hover:text-[#4f56bd]">{parent.content}</span><ArrowUpRight size={12} className="mt-1 shrink-0 text-[#aaa]" /></button>)}</div>
          </section>
        ) : null}
        </div>

      <footer className="mt-10 border-t border-[#e7e7e2] bg-[#fcfcfa] py-4 max-[640px]:mt-7 max-[640px]:py-2">
        <label className="mb-2 block text-[15px] font-semibold text-[#656961] max-[640px]:sr-only" htmlFor="detail-annotation">
          {isComment ? "Add follow-up" : "Add annotation"}
        </label>
        <div className="max-[640px]:flex max-[640px]:items-stretch max-[640px]:gap-2">
          <textarea
            id="detail-annotation"
            value={annotation}
            onChange={(event) => setAnnotation(event.target.value)}
            placeholder="Add context or note the next step…"
            className="min-h-16 w-full resize-none rounded-md border border-[#dadcd5] bg-white px-3 py-2.5 text-[14px] leading-5 outline-none placeholder:text-[#a1a49c] focus:border-[#aaa] max-[640px]:h-11 max-[640px]:min-h-11 max-[640px]:min-w-0 max-[640px]:resize-none max-[640px]:py-2.5"
          />
          <button
            type="button"
            onClick={submitAnnotation}
            disabled={!annotation.trim() || saving}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#242522] text-[15px] font-medium text-white transition hover:bg-[#393a36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4] disabled:cursor-not-allowed disabled:bg-[#c8cad2] max-[640px]:mt-0 max-[640px]:h-11 max-[640px]:w-auto max-[640px]:shrink-0 max-[640px]:px-3"
          >
            {saving ? "Saving…" : "Save annotation"}
          </button>
        </div>
        {annotationError && <p className="mt-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[14px] leading-4 text-[#a34b42]">{annotationError}</p>}
        {deleteConfirming ? (
          <div className="mt-2 rounded-md border border-[#efd3ce] bg-[#fff8f6] p-3">
            <p className="text-[14px] leading-4 text-[#8e4a43]">Delete this {detailTitle.toLowerCase()}? Its original audio will also be deleted when nothing else references it. {dependentCount > 0 ? `${dependentCount} derived ${dependentCount === 1 ? "item will" : "items will"} remain.` : ""}</p>
            {deleteError && <p className="mt-1 text-[14px] text-[#b0443a]">{deleteError}</p>}
            <div className="mt-2 flex justify-end gap-1.5"><button type="button" disabled={removing} onClick={() => { setDeleteConfirming(false); setDeleteError(undefined); }} className="h-7 rounded px-2.5 text-[14px] text-[#6d6e69] hover:bg-white">Cancel</button><button type="button" disabled={removing} onClick={() => void remove()} className="inline-flex h-7 items-center gap-1.5 rounded bg-[#b2483f] px-2.5 text-[14px] font-medium text-white disabled:bg-[#cf9a95]">{removing && <LoaderCircle size={11} className="animate-spin motion-reduce:animate-none" />}{removing ? "Deleting…" : "Confirm delete"}</button></div>
          </div>
        ) : (
          <button type="button" onClick={() => setDeleteConfirming(true)} className="mt-1 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[14px] font-medium text-[#a54b42] hover:bg-[#f9ece9] max-[640px]:h-11"><Trash2 size={12} /> Delete this {detailTitle.toLowerCase()}{dependentCount > 0 ? ` · ${dependentCount} derived ${dependentCount === 1 ? "relationship" : "relationships"}` : ""}</button>
        )}
      </footer>
      </div>
    </Root>
  );
}
