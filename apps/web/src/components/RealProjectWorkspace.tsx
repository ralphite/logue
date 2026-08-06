import { ArrowLeft, FilePlus2, History, ListChecks, PanelRightClose, PanelRightOpen, RotateCcw, Settings2 } from "lucide-react";
import type { Material } from "@logue/ui";
import { useEffect, useMemo, useState } from "react";
import { createDocument, generateDocument, getDocumentRevisions, updateDocument, type DocumentRevision, type LogueDocument, type ProjectSkillBindings, type ProjectSummary, type ProjectVoiceProfile, type VoiceProfileVocabulary, type WorkspaceSettings } from "../api";
import { adoptSkillRun, createSkillRun, type LogueSkill, type LogueSkillRun } from "../skillApi";
import { groupLibraryMaterials } from "../commentBundles";
import { ProjectComposer } from "../v2-mock/primitives/ProjectComposer";
import { SourceBundleView } from "../v2-mock/primitives/SourceBundleView";
import { Button, IconButton } from "./ui";
import { PanelResizer, usePersistentPanelSize } from "./PanelResizer";
import { Tooltip, TooltipProvider } from "./Tooltip";
import "../v2-mock/styles/surfaces.css";

function sourceTitle(material: Material) {
  return material.source?.title || material.source?.domain || material.actor || "Saved source";
}

type VocabularyCategory = Exclude<keyof VoiceProfileVocabulary, "preferred_spellings">;

const vocabularyCategories: Array<{ key: VocabularyCategory; label: string }> = [
  { key: "people", label: "People" },
  { key: "companies", label: "Companies" },
  { key: "products", label: "Products" },
  { key: "places", label: "Places" },
  { key: "acronyms", label: "Acronyms" },
];

export function RealProjectWorkspace({
  project,
  materials,
  documents,
  overview,
  transcriptionProfile,
  skills,
  globalDefaults,
  skillBindings,
  onOverviewChange,
  onTranscriptionProfileChange,
  onSkillBindingsChange,
  onDocumentsChange,
  onOpenMaterial,
  onUpdateMaterialClassification,
  onBack,
}: {
  project: ProjectSummary;
  materials: Material[];
  documents: LogueDocument[];
  overview: string;
  transcriptionProfile: ProjectVoiceProfile;
  skills: LogueSkill[];
  globalDefaults: WorkspaceSettings;
  skillBindings: ProjectSkillBindings;
  onOverviewChange: (value: string) => void;
  onTranscriptionProfileChange: (value: ProjectVoiceProfile) => void;
  onSkillBindingsChange: (value: ProjectSkillBindings) => void;
  onDocumentsChange: (documents: LogueDocument[]) => void;
  onOpenMaterial: (materialId: string) => void;
  onUpdateMaterialClassification: (id: string, projects: string[], tags: string[], excludedProjects: string[], savedOnlyProjects: string[]) => Promise<void>;
  onBack: () => void;
}) {
  const projectDocuments = useMemo(() => documents.filter((document) => document.project === project.name), [documents, project.name]);
  const projectMaterials = useMemo(() => materials.filter((material) => material.projects.includes(project.name)), [materials, project.name]);
  const sourceGroups = useMemo(() => groupLibraryMaterials(projectMaterials, materials), [materials, projectMaterials]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | undefined>(() => projectDocuments[0]?.id);
  const activeDocument = projectDocuments.find((document) => document.id === activeDocumentId) ?? projectDocuments[0];
  const [documentTitle, setDocumentTitle] = useState(activeDocument?.title ?? `${project.name} brief`);
  const [documentContent, setDocumentContent] = useState(activeDocument?.content ?? "");
  const [request, setRequest] = useState("");
  const [requestMode, setRequestMode] = useState<"ask" | "draft">("ask");
  const [answerRun, setAnswerRun] = useState<LogueSkillRun>();
  const [generating, setGenerating] = useState(false);
  const [creatingDocument, setCreatingDocument] = useState(false);
  const [generationError, setGenerationError] = useState<string>();
  const [activeView, setActiveView] = useState<"document" | "context" | "settings">("document");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [profileTerm, setProfileTerm] = useState("");
  const [profileCategory, setProfileCategory] = useState<VocabularyCategory>("products");
  const [spokenTerm, setSpokenTerm] = useState("");
  const [preferredTerm, setPreferredTerm] = useState("");
  const [classificationBusyId, setClassificationBusyId] = useState<string>();
  const [classificationError, setClassificationError] = useState<string>();
  const [documentRevisions, setDocumentRevisions] = useState<DocumentRevision[]>([]);
  const [previewRevision, setPreviewRevision] = useState<DocumentRevision>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionError, setRevisionError] = useState<string>();
  const { size: inspectorWidth, setSize: setInspectorWidth } = usePersistentPanelSize({ storageKey: "logue.panel.project.sources.width.v2", defaultSize: 400, min: 360, max: 640 });

  useEffect(() => {
    setActiveDocumentId(projectDocuments[0]?.id);
  }, [project.name]);

  useEffect(() => {
    setDocumentTitle(activeDocument?.title ?? `${project.name} brief`);
    setDocumentContent(activeDocument?.content ?? "");
  }, [activeDocument?.id, activeDocument?.revision, project.name]);

  useEffect(() => {
    setDocumentRevisions([]);
    setPreviewRevision(undefined);
    setHistoryOpen(false);
    setRevisionError(undefined);
  }, [activeDocument?.id]);

  useEffect(() => {
    if (!activeDocument || previewRevision || (documentTitle === activeDocument.title && documentContent === activeDocument.content)) return;
    const timer = window.setTimeout(() => {
      void updateDocument(activeDocument.id, {
        title: documentTitle,
        content: documentContent,
        expectedRevision: activeDocument.revision,
      }).then(async (updated) => {
        onDocumentsChange(documents.map((document) => document.id === updated.id ? updated : document));
        if (historyOpen) setDocumentRevisions(await getDocumentRevisions(updated.id));
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeDocument, documentContent, documentTitle, documents, historyOpen, onDocumentsChange, previewRevision]);

  const visibleSourceIds = useMemo(() => {
    const runIds = answerRun?.sources.map((source) => source.id) ?? [];
    return runIds.length ? runIds : previewRevision?.source_ids ?? activeDocument?.source_ids ?? [];
  }, [activeDocument?.source_ids, answerRun?.sources, previewRevision?.source_ids]);
  const visibleSourceGroups = useMemo(() => {
    if (!visibleSourceIds.length) return sourceGroups;
    const ids = new Set(visibleSourceIds);
    return sourceGroups.filter((group) => group.items.some((item) => ids.has(item.id)));
  }, [sourceGroups, visibleSourceIds]);

  async function toggleRevisionHistory() {
    if (!activeDocument) return;
    if (historyOpen) {
      setHistoryOpen(false);
      setPreviewRevision(undefined);
      return;
    }
    setRevisionBusy(true);
    setRevisionError(undefined);
    try {
      setDocumentRevisions(await getDocumentRevisions(activeDocument.id));
      setHistoryOpen(true);
    } catch (cause) {
      setRevisionError(cause instanceof Error ? cause.message : "Could not load revision history.");
    } finally {
      setRevisionBusy(false);
    }
  }

  async function restoreRevision() {
    if (!activeDocument || !previewRevision || revisionBusy) return;
    setRevisionBusy(true);
    setRevisionError(undefined);
    try {
      const restored = await updateDocument(activeDocument.id, {
        title: previewRevision.title,
        content: previewRevision.content,
        project: previewRevision.project,
        sourceIds: previewRevision.source_ids,
        expectedRevision: activeDocument.revision,
      });
      onDocumentsChange(documents.map((document) => document.id === restored.id ? restored : document));
      setDocumentRevisions(await getDocumentRevisions(restored.id));
      setPreviewRevision(undefined);
    } catch (cause) {
      setRevisionError(cause instanceof Error ? cause.message : "Could not restore this revision.");
    } finally {
      setRevisionBusy(false);
    }
  }

  async function runProjectRequest() {
    const instruction = request.trim();
    if (!instruction || !projectMaterials.length || generating) return;
    setGenerating(true);
    setGenerationError(undefined);
    try {
      if (requestMode === "ask") {
        const skillId = skillBindings.ask || globalDefaults.default_qa_skill || skills.find((skill) => skill.output === "qa" && skill.enabled)?.id;
        if (!skillId) throw new Error("No Ask Skill is available.");
        const run = await createSkillRun({ skill_id: skillId, instruction, project: project.name, source_ids: projectMaterials.map((material) => material.id) });
        setAnswerRun(run);
        setRequest("");
        setInspectorOpen(true);
        return;
      }
      const created = await generateDocument({
        title: documentTitle || `${project.name} brief`,
        project: project.name,
        sourceIds: projectMaterials.map((material) => material.id),
        instruction,
      });
      onDocumentsChange([created, ...documents]);
      setActiveDocumentId(created.id);
      setAnswerRun(undefined);
      setRequest("");
      setInspectorOpen(true);
    } catch (cause) {
      setGenerationError(cause instanceof Error ? cause.message : "Could not generate from this project.");
    } finally {
      setGenerating(false);
    }
  }

  async function adoptAnswer(action: "copy" | "document") {
    if (!answerRun?.original_output) return;
    const adopted = await adoptSkillRun(answerRun.id, answerRun.original_output);
    setAnswerRun(adopted);
    if (action === "copy") {
      await navigator.clipboard.writeText(answerRun.original_output);
      return;
    }
    const created = await createDocument({ title: answerRun.instruction.slice(0, 64) || `${project.name} answer`, content: answerRun.original_output, project: project.name, sourceIds: answerRun.sources.map((source) => source.id) });
    onDocumentsChange([created, ...documents]);
    setActiveDocumentId(created.id);
    setAnswerRun(undefined);
  }

  async function newDocument() {
    if (creatingDocument) return;
    setCreatingDocument(true);
    try {
      const created = await createDocument({ title: `${project.name} brief`, project: project.name });
      onDocumentsChange([created, ...documents]);
      setActiveDocumentId(created.id);
      setActiveView("document");
    } finally {
      setCreatingDocument(false);
    }
  }

  function updateTranscriptionProfile(patch: Partial<ProjectVoiceProfile>) {
    onTranscriptionProfileChange({ ...transcriptionProfile, ...patch });
  }

  function addProfileTerm() {
    const value = profileTerm.trim();
    const current = transcriptionProfile.vocabulary[profileCategory];
    if (!value || current.includes(value)) return;
    updateTranscriptionProfile({
      vocabulary: { ...transcriptionProfile.vocabulary, [profileCategory]: [...current, value] },
    });
    setProfileTerm("");
  }

  function removeProfileTerm(category: VocabularyCategory, value: string) {
    updateTranscriptionProfile({
      vocabulary: { ...transcriptionProfile.vocabulary, [category]: transcriptionProfile.vocabulary[category].filter((term) => term !== value) },
    });
  }

  function addPreferredSpelling() {
    const spoken = spokenTerm.trim();
    const preferred = preferredTerm.trim();
    if (!spoken || !preferred || transcriptionProfile.vocabulary.preferred_spellings.some((entry) => entry.spoken.toLowerCase() === spoken.toLowerCase())) return;
    updateTranscriptionProfile({
      vocabulary: {
        ...transcriptionProfile.vocabulary,
        preferred_spellings: [...transcriptionProfile.vocabulary.preferred_spellings, { spoken, preferred }],
      },
    });
    setSpokenTerm("");
    setPreferredTerm("");
  }

  const bindingRows: Array<{ key: keyof ProjectSkillBindings; label: string; fallback?: string; accepts: (skill: LogueSkill) => boolean }> = [
    { key: "organization", label: "Organization", fallback: globalDefaults.default_organization_skill, accepts: (skill) => skill.task === "organize" },
    { key: "command", label: "Voice Command", fallback: globalDefaults.default_extension_skill, accepts: (skill) => skill.task === "generate" && skill.output === "insert" && skill.surfaces.includes("extension") },
    { key: "ask", label: "Ask", fallback: globalDefaults.default_qa_skill, accepts: (skill) => skill.task === "generate" && skill.output === "qa" },
    { key: "draft", label: "Draft", fallback: globalDefaults.default_document_skill, accepts: (skill) => skill.task === "generate" && skill.output === "document" },
  ];

  function skillName(id?: string) {
    return skills.find((skill) => skill.id === id)?.name ?? "System default";
  }

  const contextCandidates = useMemo(() => materials.filter((material) =>
    material.projects.includes(project.name)
    || material.organization?.suggested_projects?.includes(project.name)
    || material.excludedProjects?.includes(project.name)
    || material.savedOnlyProjects?.includes(project.name),
  ), [materials, project.name]);
  const contextGroups = useMemo(() => groupLibraryMaterials(contextCandidates, materials), [contextCandidates, materials]);

  async function setProjectMembership(group: (typeof contextGroups)[number], next: "added" | "removed" | "excluded" | "undo-exclusion") {
    setClassificationBusyId(group.key);
    setClassificationError(undefined);
    try {
      await Promise.all(group.items.map((material) => {
        const projects = next === "added"
          ? Array.from(new Set([...material.projects, project.name]))
          : material.projects.filter((name) => name !== project.name);
        const excludedProjects = next === "excluded"
          ? Array.from(new Set([...(material.excludedProjects ?? []), project.name]))
          : (material.excludedProjects ?? []).filter((name) => name !== project.name);
        const savedOnlyProjects = next === "removed" || next === "undo-exclusion"
          ? Array.from(new Set([...(material.savedOnlyProjects ?? []), project.name]))
          : (material.savedOnlyProjects ?? []).filter((name) => name !== project.name);
        return onUpdateMaterialClassification(material.id, projects, material.tags, excludedProjects, savedOnlyProjects);
      }));
    } catch (cause) {
      setClassificationError(cause instanceof Error ? cause.message : "Could not update Project Context.");
    } finally {
      setClassificationBusyId(undefined);
    }
  }

  return (
    <main className="logue-v2 v2-project-main min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
      <header className="v2-project-topbar">
        <div className="v2-breadcrumbs">
          <button type="button" className="v2-source-excerpt-toggle !mt-0" onClick={onBack}><ArrowLeft aria-hidden="true" size={14} />Projects</button>
          <span>/</span><strong>{project.name}</strong>
        </div>
        <div className="v2-topbar-actions">
          <Button size="sm" onClick={() => void newDocument()} disabled={creatingDocument}><FilePlus2 aria-hidden="true" size={15} />{creatingDocument ? "Creating…" : "New document"}</Button>
          <Button size="sm" variant={activeView === "context" ? "primary" : "secondary"} onClick={() => setActiveView(activeView === "context" ? "document" : "context")}><ListChecks aria-hidden="true" size={15} />Context</Button>
          <Button size="sm" variant={activeView === "settings" ? "primary" : "secondary"} onClick={() => setActiveView(activeView === "settings" ? "document" : "settings")}><Settings2 aria-hidden="true" size={15} />Project settings</Button>
          {activeView === "document" && <TooltipProvider><Tooltip content={inspectorOpen ? "Close sources" : "Open sources"}><IconButton label={inspectorOpen ? "Close sources" : "Open sources"} variant="ghost" onClick={() => setInspectorOpen((value) => !value)}>{inspectorOpen ? <PanelRightClose aria-hidden="true" size={18} /> : <PanelRightOpen aria-hidden="true" size={18} />}</IconButton></Tooltip></TooltipProvider>}
        </div>
      </header>

      <div className="v2-project-shell min-h-0">
        <section className="v2-project-main">
          {activeView === "settings" ? <div className="v2-editor-scroll"><div className="v2-list-axis">
            <div className="v2-page-heading"><div className="v2-page-heading-copy"><h1>Project settings</h1><p>Context used for transcription, classification, Ask, and Draft.</p></div></div>
            <section className="v2-setting-section"><h2>Project context</h2><textarea className="v2-textarea" value={overview} onChange={(event) => onOverviewChange(event.target.value)} placeholder="Goals, decisions, constraints, and working context…" /></section>
            <section className="v2-setting-section">
              <h2>Transcription profile</h2>
              <div className="v2-inline-actions" role="group" aria-label="Project transcription profile mode">
                {(["inherited", "customized", "disabled"] as const).map((mode) => <Button key={mode} size="sm" aria-pressed={transcriptionProfile.mode === mode} variant={transcriptionProfile.mode === mode ? "primary" : "secondary"} onClick={() => updateTranscriptionProfile({ mode })}>{mode[0].toUpperCase() + mode.slice(1)}</Button>)}
              </div>
              <p className="v2-settings-lead">{transcriptionProfile.mode === "customized" ? "Uses Default personal context plus this Project’s context and vocabulary." : transcriptionProfile.mode === "disabled" ? "Uses only the Default voice profile; Project provenance is still recorded." : "Uses the Default voice profile with this Project’s context."}</p>
              {transcriptionProfile.mode === "customized" && <div className="mt-4 space-y-4">
                <div className="v2-setting-row"><div><strong>Transcription Skill</strong><p>{skillBindings.transcription ? `Project override · ${skillName(skillBindings.transcription)}` : `Inherits Default · ${skillName(globalDefaults.default_transcription_skill)}`}</p></div><select className="v2-input" aria-label="Transcription Skill" value={skillBindings.transcription ?? ""} onChange={(event) => onSkillBindingsChange({ ...skillBindings, transcription: event.target.value || undefined })}><option value="">Inherit Default</option>{skills.filter((skill) => skill.enabled && skill.task === "transcribe").map((skill) => <option key={skill.id} value={skill.id}>{skill.name}{skill.system ? " · Built-in" : " · My Skill"}</option>)}</select></div>
                <div className="v2-setting-row"><div><strong>Primary language</strong><p>The language Logue should expect most often.</p></div><input className="v2-input" value={transcriptionProfile.primary_language} onChange={(event) => updateTranscriptionProfile({ primary_language: event.target.value })} placeholder="Auto-detect" /></div>
                <div className="v2-setting-row"><div><strong>Mixed languages</strong><p>Optional languages that may appear in the same recording.</p></div><input className="v2-input" value={transcriptionProfile.mixed_languages.join(", ")} onChange={(event) => updateTranscriptionProfile({ mixed_languages: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="English, 中文" /></div>
                <div>
                  <strong className="text-[14px] text-[#3f413c]">Project vocabulary</strong>
                  <div className="mt-2 space-y-2">{vocabularyCategories.map((category) => transcriptionProfile.vocabulary[category.key].length ? <div key={category.key} className="flex flex-wrap items-center gap-2"><span className="w-20 text-[13px] text-[#8a8b86]">{category.label}</span>{transcriptionProfile.vocabulary[category.key].map((value) => <button type="button" className="v2-membership-pill" key={value} onClick={() => removeProfileTerm(category.key, value)}>{value} ×</button>)}</div> : null)}</div>
                  <div className="v2-filter-row" style={{ marginTop: 12 }}><select className="v2-input" value={profileCategory} onChange={(event) => setProfileCategory(event.target.value as VocabularyCategory)}>{vocabularyCategories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select><input className="v2-input" value={profileTerm} onChange={(event) => setProfileTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addProfileTerm(); } }} placeholder="Add a term" /><Button size="sm" onClick={addProfileTerm} disabled={!profileTerm.trim()}>Add</Button></div>
                </div>
                <div>
                  <strong className="text-[14px] text-[#3f413c]">Acronym and preferred spelling</strong>
                  <div className="mt-2 flex flex-wrap gap-2">{transcriptionProfile.vocabulary.preferred_spellings.map((entry) => <button type="button" className="v2-membership-pill" key={entry.spoken} onClick={() => updateTranscriptionProfile({ vocabulary: { ...transcriptionProfile.vocabulary, preferred_spellings: transcriptionProfile.vocabulary.preferred_spellings.filter((value) => value.spoken !== entry.spoken) } })}>{entry.spoken} → {entry.preferred} ×</button>)}</div>
                  <div className="v2-filter-row" style={{ marginTop: 12 }}><input className="v2-input" value={spokenTerm} onChange={(event) => setSpokenTerm(event.target.value)} placeholder="What Logue may hear" /><input className="v2-input" value={preferredTerm} onChange={(event) => setPreferredTerm(event.target.value)} placeholder="Preferred spelling" /><Button size="sm" onClick={addPreferredSpelling} disabled={!spokenTerm.trim() || !preferredTerm.trim()}>Add</Button></div>
                </div>
                <div><strong className="text-[14px] text-[#3f413c]">Custom instructions</strong><textarea className="v2-textarea mt-2" value={transcriptionProfile.custom_instructions} onChange={(event) => updateTranscriptionProfile({ custom_instructions: event.target.value })} placeholder="Instructions that only apply when this Project profile is active…" /></div>
              </div>}
            </section>
            <section className="v2-setting-section"><h2>Skill overrides</h2><p className="v2-settings-lead">Only overrides set here differ from Global defaults.</p>{bindingRows.map((row) => <div className="v2-setting-row" key={row.key}><div><strong>{row.label}</strong><p>{skillBindings[row.key] ? `Project override · ${skillName(skillBindings[row.key])}` : `Inherits Global · ${skillName(row.fallback)}`}</p></div><select className="v2-input" aria-label={`${row.label} Skill`} value={skillBindings[row.key] ?? ""} onChange={(event) => onSkillBindingsChange({ ...skillBindings, [row.key]: event.target.value || undefined })}><option value="">Inherit Global</option>{skills.filter((skill) => skill.enabled && row.accepts(skill)).map((skill) => <option key={skill.id} value={skill.id}>{skill.name}{skill.system ? " · Built-in" : " · My Skill"}</option>)}</select></div>)}</section>
          </div></div> : activeView === "context" ? <div className="v2-editor-scroll"><div className="v2-list-axis">
            <div className="v2-page-heading"><div className="v2-page-heading-copy"><h1>Project context</h1><p>Review what this Project may use. Excluding a Source never deletes it from your private Library.</p></div></div>
            {classificationError && <div className="rounded-md bg-[#fff4f1] px-3 py-2 text-[14px] text-[#a33d36]" role="alert">{classificationError}</div>}
            <div className="v2-review-list">{contextGroups.map((group) => {
              const included = group.items.some((material) => material.projects.includes(project.name));
              const excluded = group.items.some((material) => material.excludedProjects?.includes(project.name));
              const savedOnly = group.items.some((material) => material.savedOnlyProjects?.includes(project.name));
              const representative = group.bundle?.source ?? group.representative;
              const primary = group.bundle?.primaryComment ?? representative;
              const suggestedBy = group.items.find((material) => material.organization?.suggested_projects?.includes(project.name));
              const state = excluded ? "Excluded" : included ? "In Context" : suggestedBy ? "Suggested" : savedOnly ? "Saved only" : "Suggested";
              const busy = classificationBusyId === group.key;
              return <article className="v2-review-row" key={group.key}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="v2-membership-pill">{state}</span>{suggestedBy?.organization?.confidence !== undefined && !included && !excluded ? <span className="v2-quiet-pill">{Math.round(suggestedBy.organization.confidence * 100)}% match</span> : null}</div><h3>{sourceTitle(representative)}</h3><p>{primary.content}</p>{excluded ? <div className="v2-library-meta">Your correction prevents automatic re-adding</div> : !included ? <div className="v2-library-meta">{suggestedBy?.organization?.reason || "Saved in your private Library"}</div> : null}</div><div className="v2-inline-actions"><Button size="sm" onClick={() => onOpenMaterial(primary.id)}>Open source</Button>{excluded ? <Button size="sm" variant="primary" disabled={busy} onClick={() => void setProjectMembership(group, "undo-exclusion")}>Undo exclusion</Button> : included ? <><Button size="sm" disabled={busy} onClick={() => void setProjectMembership(group, "removed")}>Remove from Context</Button><Button size="sm" disabled={busy} onClick={() => void setProjectMembership(group, "excluded")}>Exclude</Button></> : <><Button size="sm" variant="primary" disabled={busy} onClick={() => void setProjectMembership(group, "added")}>Add to Context</Button><Button size="sm" disabled={busy} onClick={() => void setProjectMembership(group, "excluded")}>Exclude</Button></>}</div></article>;
            })}{!contextGroups.length && <div className="v2-recovery-card"><p>No Sources are included, suggested, or excluded for this Project yet.</p></div>}</div>
          </div></div> : <>
            <div className="v2-editor-scroll">
              {answerRun ? <article className="v2-editor-axis" aria-label="Project answer">
                <div className="v2-editor-eyebrow">Answer · {answerRun.skill_name}</div>
                <h1 className="v2-editor-title">{answerRun.instruction}</h1>
                <div className="v2-editor-body whitespace-pre-wrap">{answerRun.original_output || answerRun.error || "No answer was produced."}</div>
                <div className="v2-context-summary"><span>{answerRun.sources.length} frozen Sources · Run {answerRun.status}</span><button className="v2-source-excerpt-toggle" type="button" onClick={() => setInspectorOpen(true)}>Review sources</button></div>
                {answerRun.original_output && <div className="v2-inline-actions" style={{ marginTop: 18 }}><Button size="sm" onClick={() => void adoptAnswer("copy")}>Copy</Button><Button size="sm" variant="primary" onClick={() => void adoptAnswer("document")}>Save as document</Button><Button size="sm" onClick={() => setAnswerRun(undefined)}>Back to document</Button></div>}
              </article> : <article className="v2-editor-axis" aria-label="Project document">
                <div className="v2-editor-eyebrow">{previewRevision ? `Revision ${previewRevision.revision} · Read only` : "Document"}</div>
                <input className="v2-editor-title w-full border-0 bg-transparent outline-none disabled:opacity-60" aria-label="Document title" value={previewRevision?.title ?? documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} disabled={!activeDocument || Boolean(previewRevision)} />
                <textarea
                  className="v2-editor-body min-h-[360px] w-full resize-none border-0 bg-transparent outline-none"
                  aria-label="Document content"
                  value={previewRevision?.content ?? documentContent}
                  onChange={(event) => setDocumentContent(event.target.value)}
                  disabled={!activeDocument || Boolean(previewRevision)}
                  placeholder={activeDocument ? "Start writing, or ask Logue to draft from this project's sources." : "Create a document, or ask Logue to draft from this project's sources."}
                />
                <div className="v2-context-summary">
                  <span>{sourceGroups.length} project sources · {previewRevision?.source_ids.length ?? activeDocument?.source_ids.length ?? 0} sources in this revision</span>
                  <div className="v2-inline-actions">
                    <button className="v2-source-excerpt-toggle" type="button" onClick={() => setInspectorOpen(true)}>Review sources</button>
                    <button className="v2-source-excerpt-toggle" type="button" disabled={!activeDocument || revisionBusy} onClick={() => void toggleRevisionHistory()}><History aria-hidden="true" size={14} />{historyOpen ? "Close history" : "History"}</button>
                  </div>
                </div>
                {revisionError && <div className="mt-3 rounded-md bg-[#fff4f1] px-3 py-2 text-[14px] text-[#a33d36]" role="alert">{revisionError}</div>}
                {historyOpen && <section className="v2-recovery-card" style={{ marginTop: 16 }} aria-label="Document revision history">
                  <div className="v2-setting-row !border-0 !px-0 !pt-0"><div><strong>Revision history</strong><p>Each revision keeps the Sources used at that time.</p></div>{previewRevision ? <Button size="sm" variant="primary" disabled={revisionBusy} onClick={() => void restoreRevision()}><RotateCcw aria-hidden="true" size={14} />{revisionBusy ? "Restoring…" : "Restore as new revision"}</Button> : null}</div>
                  <div className="v2-inline-actions">{documentRevisions.map((revision) => <Button key={`${revision.document_id}-${revision.revision}`} size="sm" variant={(revision.current && !previewRevision) || previewRevision?.revision === revision.revision ? "primary" : "secondary"} onClick={() => setPreviewRevision(revision.current ? undefined : revision)}>{revision.current ? "Current" : `Revision ${revision.revision}`} · {new Date(revision.updated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</Button>)}</div>
                </section>}
                {projectDocuments.length > 1 && <div className="v2-inline-actions" style={{ marginTop: 18 }}>{projectDocuments.map((document) => <Button key={document.id} size="sm" variant={document.id === activeDocument?.id ? "primary" : "secondary"} onClick={() => setActiveDocumentId(document.id)}>{document.title}</Button>)}</div>}
              </article>}
            </div>
            {generationError && <div className="mx-auto mb-2 rounded-md bg-[#fff4f1] px-3 py-2 text-[14px] text-[#a33d36]" style={{ width: "min(calc(100% - 48px), 820px)" }} role="alert">{generationError}</div>}
            {!projectMaterials.length && <div className="mx-auto mb-2 text-[13px] text-[#73756f]" style={{ width: "min(calc(100% - 48px), 820px)" }}>Add Sources to this Project before asking Logue to draft.</div>}
            <div className="v2-composer-wrap"><ProjectComposer value={request} onChange={setRequest} onSubmit={() => void runProjectRequest()} disabled={generating || !projectMaterials.length} showVoice={false} mode={requestMode} onModeChange={setRequestMode} placeholder={generating ? `${requestMode === "ask" ? "Answering" : "Drafting"} from project sources…` : requestMode === "ask" ? `Ask ${project.name}` : `Draft with ${project.name}`} /></div>
          </>}
        </section>

        {activeView === "document" && inspectorOpen && <>
          <PanelResizer edge="left" label="Resize source inspector" value={inspectorWidth} min={360} max={640} defaultValue={400} onChange={setInspectorWidth} className="max-[980px]:hidden" />
          <aside className="v2-inspector" style={{ width: inspectorWidth }} aria-label="Sources used">
            <header className="v2-inspector-header"><div><h2>Sources used</h2></div><TooltipProvider><Tooltip content="Close sources"><IconButton label="Close sources" variant="ghost" onClick={() => setInspectorOpen(false)}><PanelRightClose aria-hidden="true" size={17} /></IconButton></Tooltip></TooltipProvider></header>
            <div className="v2-inspector-scroll"><div className="v2-source-list">
              {visibleSourceGroups.map((group, index) => {
                const web = group.bundle?.source ?? group.representative;
                const citedMember = group.items.find((item) => visibleSourceIds.includes(item.id));
                const comment = citedMember && citedMember.id !== web.id ? citedMember : group.bundle?.primaryComment;
                const focus = citedMember?.id === web.id ? "web" : citedMember ? "comment" : undefined;
                const citedLabel = focus === "web" ? "Web source" : focus === "comment" ? "You comment" : undefined;
                return <SourceBundleView key={group.key} citation={index + 1} title={sourceTitle(web)} excerpt={web.content} comment={comment?.content ?? "Saved to this Project"} focus={focus} meta={[web.source?.domain || "Logue", citedLabel ? `Cited item · ${citedLabel}` : ""].filter(Boolean).join(" · ")} onSelect={() => onOpenMaterial(citedMember?.id ?? comment?.id ?? web.id)} onOpenSnapshot={() => onOpenMaterial(citedMember?.id ?? comment?.id ?? web.id)} />;
              })}
              {!visibleSourceGroups.length && <p className="v2-settings-lead">No Sources are used by this document yet.</p>}
            </div></div>
          </aside>
        </>}
      </div>
    </main>
  );
}
