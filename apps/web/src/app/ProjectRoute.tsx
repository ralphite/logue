import { ProductStatus, useFocusBoundary, type Material, type MaterialOrganization } from "@logue/ui";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  History,
  ListChecks,
  PanelRightClose,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createProjectVoiceProfile,
  createMaterial,
  downloadWorkspaceExport,
  executeDeletion,
  forgetClassificationMemory,
  getDeletionPreview,
  getExportPreview,
  getTopics,
  setSkillRunPinned,
  saveProject,
  updateMaterialMembership,
  type DiscoveredTopic,
  type DeletionPreview,
  type ExportPreview,
  type LogueDocument,
  type ProjectSkillBindings,
  type ProjectSummary,
  type ProjectVoiceProfile,
  type SkillRun,
  type SkillRunSourceSnapshot,
  type VoiceProfileVocabulary,
  type WorkspaceSettings,
} from "../lib/api";
import { groupLibraryMaterials } from "../lib/commentBundles";
import {
  adoptSkillRun,
  createAdoptionId,
  createSkillRun,
  documentAdoptionFromResult,
  retrySkillRun,
  skillResolutionLabel,
  resolveDocumentUndoFailure,
  resolveDocumentUndoResult,
  saveSkillRunAsDocument,
  isLogueDocumentTombstone,
  type DocumentAdoption,
  SkillRunFailure,
  type LogueSkill,
  type LogueSkillRun,
} from "../lib/skillApi";
import { Button, IconButton } from "../ui/Button";
import { OriginLabel } from "../ui/OriginLabel";
import { ProjectComposer } from "./ProjectComposer";
import { AppShell, type PrimaryRoute } from "./AppShell";
import { RunInspector } from "./LibraryRoute";
import { DocumentContent } from "./DocumentContent";
import { readNavigationState, updateNavigationState } from "./navigationState";
import { ContentSummary, contentSummary } from "./contentPresentation";
import { RowActions } from "./RowActions";

type ProjectView = "workspace" | "context" | "history" | "settings";
type RequestMode = "ask" | "compare" | "draft";
type ClassificationMemory = NonNullable<
  MaterialOrganization["user_correction"]
>;
type VocabularyCategory = Exclude<
  keyof VoiceProfileVocabulary,
  "preferred_spellings"
>;
const vocabularyCategories: Array<{ key: VocabularyCategory; label: string }> =
  [
    { key: "people", label: "People" },
    { key: "companies", label: "Companies" },
    { key: "products", label: "Products" },
    { key: "places", label: "Places" },
    { key: "acronyms", label: "Acronyms" },
  ];

type DisplaySource = Material | SkillRunSourceSnapshot;

function activityLabel(activityType: Material["activityType"]) {
  if (activityType === "voice-command") return "Voice Command";
  if (activityType === "text-command") return "Text Command";
  if (activityType === "ask") return "Ask";
  if (activityType === "compare") return "Compare";
  if (activityType === "draft") return "Draft";
  return "Run";
}

function adoptionActionLabel(action?: string) {
  if (action === "copy") return "Copy";
  if (action === "insert") return "Insert";
  if (action === "replace") return "Replace";
  if (action === "keep") return "Keep";
  if (action === "document") return "Document";
  return "Adopted";
}

function materialTitle(material: DisplaySource) {
  return (
    material.source?.title?.trim() ||
    material.source?.domain?.trim() ||
    (material.kind === "voice"
      ? "Voice input"
      : material.kind === "selection"
        ? "Saved selection"
        : "Saved note")
  );
}

function sourceOrigin(material: DisplaySource) {
  if (material.actor && material.actor.toLowerCase() !== "user")
    return "ai" as const;
  if (material.kind === "selection") return "web" as const;
  return "you" as const;
}

function projectSkill(
  project: ProjectSummary,
  settings: WorkspaceSettings | undefined,
  skills: LogueSkill[],
  mode: RequestMode,
) {
  const analytical = mode === "ask" || mode === "compare";
  const binding = analytical
    ? project.skill_bindings?.ask
    : project.skill_bindings?.draft;
  const global = analytical
    ? settings?.default_qa_skill
    : settings?.default_document_skill;
  const output = analytical ? "qa" : "document";
  return (
    skills.find((skill) => skill.id === binding && skill.enabled) ||
    skills.find((skill) => skill.id === global && skill.enabled) ||
    skills.find(
      (skill) =>
        skill.enabled && skill.task === "generate" && skill.output === output,
    ) ||
    skills.find((skill) => skill.enabled && skill.task === "generate")
  );
}

function EmptyProject({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="v2-editor-scroll">
      <div className="v2-list-axis">
        <div className="v2-page-heading-copy">
          <h1>Projects</h1>
          <p>
            Collect the Sources Logue may use for one continuing piece of work.
          </p>
        </div>
        <div className="v2-recovery-card">
          <p>
            Create a Project, then add saved Sources or capture new evidence
            from the Extension.
          </p>
          <Button variant="primary" onClick={onCreate}>
            <Plus size={15} />
            New Project
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingProjects() {
  return (
    <div className="v2-editor-scroll" aria-live="polite">
      <div className="v2-list-axis">
        <div className="v2-page-heading-copy">
          <h1>Projects</h1>
        </div>
        <div className="v2-recovery-card">
          <p>Loading Projects…</p>
        </div>
      </div>
    </div>
  );
}

function ProjectDialog({
  open,
  onClose,
  onSaved,
  project,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (saved: ProjectSummary) => Promise<void>;
  project?: ProjectSummary;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [overview, setOverview] = useState(project?.overview ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useFocusBoundary<HTMLElement>({
    open,
    onClose,
    trap: true,
  });
  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setOverview(project?.overview ?? "");
      setError("");
    }
  }, [open, project?.name, project?.overview]);
  if (!open) return null;
  return (
    <div
      className="v2-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="v2-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        tabIndex={-1}
      >
        <ProductStatus
          message={
            busy
              ? project
                ? "Saving Project changes…"
                : "Creating Project…"
              : undefined
          }
        />
        <div className="v2-panel-section-heading">
          <div>
            <OriginLabel
              origin="you"
              detail={project ? "Project settings" : "New Project"}
            />
            <h2 id="project-dialog-title">
              {project ? project.name : "Create a Project"}
            </h2>
          </div>
          <IconButton label="Close" variant="ghost" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <label className="v2-field-label">
          Name
          <input
            className="v2-input"
            data-autofocus={!project ? "true" : undefined}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
          />
        </label>
        <label className="v2-field-label">
          Goal and working context
          <textarea
            className="v2-textarea"
            data-autofocus={project ? "true" : undefined}
            value={overview}
            onChange={(event) => setOverview(event.target.value)}
            placeholder="What are you trying to decide, create, or learn?"
          />
        </label>
        {error ? (
          <div className="v2-warning-bar" role="alert">
            {error}
          </div>
        ) : null}
        <div className="v2-inline-actions v2-actions-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || busy}
            onClick={() => {
              setBusy(true);
              setError("");
              void saveProject(project?.name ?? "", {
                name: name.trim(),
                overview: overview.trim(),
                transcriptionProfile:
                  project?.transcription_profile ?? createProjectVoiceProfile(),
                skillBindings: project?.skill_bindings ?? {},
              })
                .then(onSaved)
                .then(onClose)
                .catch((cause) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not save this Project.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : project ? "Save Project" : "Create Project"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function ProjectRoute({
  projects,
  materials,
  documents,
  runs,
  skills,
  settings,
  aiReady,
  loading,
  onRoute,
  onRefresh,
}: {
  projects: ProjectSummary[];
  materials: Material[];
  documents: LogueDocument[];
  runs: SkillRun[];
  skills: LogueSkill[];
  settings?: WorkspaceSettings;
  aiReady: boolean;
  loading: boolean;
  onRoute: (route: PrimaryRoute) => void;
  onRefresh: () => Promise<void>;
}) {
  const [projectName, setProjectName] = useState(() => {
    const navigation = readNavigationState();
    const saved = navigation.project;
    const targetName = navigation.draftHandoff?.projectName ?? saved?.name;
    return (
      projects.find((item) => item.id === saved?.id || item.name === targetName)
        ?.name ??
      projects[0]?.name ??
      ""
    );
  });
  const [view, setView] = useState<ProjectView>(
    () => readNavigationState().project?.view ?? "workspace",
  );
  const [mode, setMode] = useState<RequestMode>(
    () =>
      (readNavigationState().draftHandoff ? "draft" : undefined) ??
      readNavigationState().project?.mode ??
      "ask",
  );
  const [request, setRequest] = useState("");
  const [run, setRun] = useState<LogueSkillRun>();
  const [resultMode, setResultMode] = useState<RequestMode>("ask");
  const [candidate, setCandidate] = useState("");
  const candidateAdoptionAttempts = useRef<Partial<Record<"copy" | "keep" | "document", { id: string; content: string; targetKey?: string }>>>({});
  const [keepAdoption, setKeepAdoption] = useState<{ id: string; runId: string }>();
  const [documentTargetOpen, setDocumentTargetOpen] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [documentAdoption, setDocumentAdoption] = useState<
    DocumentAdoption & { runId: string }
  >();
  const [documentUndoRetryable, setDocumentUndoRetryable] = useState(false);
  const [continuation, setContinuation] = useState<{
    runId: string;
    output: string;
    sourceIds: string[];
    label: string;
  }>();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [handoffSourceIds, setHandoffSourceIds] = useState<string[]>(
    () => readNavigationState().draftHandoff?.sourceIds ?? [],
  );
  const [topics, setTopics] = useState<DiscoveredTopic[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [pinnedSourceIds, setPinnedSourceIds] = useState<string[]>([]);
  const [openSourceId, setOpenSourceId] = useState<string>();
  const [openCitationSourceId, setOpenCitationSourceId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState("");
  const [membershipError, setMembershipError] = useState("");
  const [forgetMemoryId, setForgetMemoryId] = useState<string>();
  const [classificationMemoryBusy, setClassificationMemoryBusy] = useState("");
  const [classificationMemoryError, setClassificationMemoryError] =
    useState("");
  const [profileDraft, setProfileDraft] = useState<ProjectVoiceProfile>(
    createProjectVoiceProfile(),
  );
  const [bindingsDraft, setBindingsDraft] = useState<ProjectSkillBindings>({});
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [exportAudio, setExportAudio] = useState(true);
  const [exportActivity, setExportActivity] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview>();
  const [exportError, setExportError] = useState("");
  const [vocabularyCategory, setVocabularyCategory] =
    useState<VocabularyCategory>("products");
  const [vocabularyTerm, setVocabularyTerm] = useState("");
  const [spokenTerm, setSpokenTerm] = useState("");
  const [preferredTerm, setPreferredTerm] = useState("");
  const [documentId, setDocumentId] = useState<string | undefined>(
    () => readNavigationState().project?.documentId,
  );
  const [openHistoryRunId, setOpenHistoryRunId] = useState<string>();
  const [historyActionBusy, setHistoryActionBusy] = useState("");
  const [historyActionError, setHistoryActionError] = useState("");
  const [deletePreview, setDeletePreview] = useState<DeletionPreview>();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const deleteDialogRef = useFocusBoundary<HTMLElement>({
    open: Boolean(deletePreview),
    onClose: () => setDeletePreview(undefined),
    trap: true,
  });
  const project =
    projects.find((item) => item.name === projectName) ?? projects[0];
  const projectMaterials = useMemo(
    () =>
      materials.filter(
        (item) => project && item.projects.includes(project.name),
      ),
    [materials, project],
  );
  const effectiveProjectMaterials = useMemo(() => {
    const projectSourceIds = new Set(projectMaterials.map((item) => item.id));
    return projectMaterials.filter(
      (item) =>
        !item.organization?.duplicate_of ||
        !projectSourceIds.has(item.organization.duplicate_of),
    );
  }, [projectMaterials]);
  const availableRunMaterials = useMemo(
    () => [
      ...effectiveProjectMaterials,
      ...materials.filter(
        (item) =>
          handoffSourceIds.includes(item.id) &&
          !effectiveProjectMaterials.some((current) => current.id === item.id),
      ),
    ],
    [effectiveProjectMaterials, handoffSourceIds, materials],
  );
  const projectDocuments = useMemo(
    () =>
      documents
        .filter((item) => item.project === project?.name)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at)),
    [documents, project?.name],
  );
  const document =
    projectDocuments.find((item) => item.id === documentId) ??
    projectDocuments[0];
  const projectRuns = useMemo(
    () =>
      runs
        .filter((item) => item.project === project?.name)
        .sort(
          (left, right) =>
            Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
            right.created_at.localeCompare(left.created_at),
        ),
    [project?.name, runs],
  );
  const recentProjectRuns = useMemo(
    () =>
      [...projectRuns].sort((left, right) =>
        right.updated_at.localeCompare(left.updated_at),
      ),
    [projectRuns],
  );
  const historyRun = projectRuns.find((item) => item.id === openHistoryRunId);

  useEffect(() => {
    if (!projectName && projects[0]) setProjectName(projects[0].name);
  }, [projectName, projects]);
  useEffect(() => {
    void getTopics()
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);
  useEffect(() => {
    if (!project) return;
    const navigation = readNavigationState();
    const handoff =
      navigation.draftHandoff?.projectName === project.name
        ? navigation.draftHandoff
        : undefined;
    setProfileDraft(project.transcription_profile);
    setBindingsDraft(project.skill_bindings ?? {});
    setRun(undefined);
    setCandidate("");
    setContinuation(undefined);
    setHandoffSourceIds(handoff?.sourceIds ?? []);
    setSelectedSourceIds(
      handoff?.sourceIds.filter((id) =>
        materials.some((item) => item.id === id),
      ) ?? effectiveProjectMaterials.map((item) => item.id),
    );
    setSelectedTopicIds([]);
    setPinnedSourceIds([]);
    const saved = readNavigationState().project;
    setDocumentId(
      saved && (saved.id === project.id || saved.name === project.name)
        ? (projectDocuments.find((item) => item.id === saved.documentId)?.id ??
            projectDocuments[0]?.id)
        : projectDocuments[0]?.id,
    );
    setDeletePreview(undefined);
    setDeleteConfirm("");
    setForgetMemoryId(undefined);
    setClassificationMemoryError("");
    setOpenHistoryRunId(undefined);
    setOpenCitationSourceId(undefined);
    if (handoff) {
      updateNavigationState((current) => {
        const { draftHandoff: _consumed, ...rest } = current;
        return rest;
      });
    }
  }, [project?.name]);
  useEffect(() => {
    if (!project) return;
    updateNavigationState((current) => ({
      ...current,
      project: {
        id: project.id,
        name: project.name,
        view,
        mode,
        documentId,
      },
    }));
  }, [documentId, mode, project, view]);
  useEffect(() => {
    if (continuation) {
      setSelectedSourceIds(continuation.sourceIds);
      setPinnedSourceIds((current) =>
        current.filter((id) => continuation.sourceIds.includes(id)),
      );
      return;
    }
    const available = new Set(availableRunMaterials.map((item) => item.id));
    setSelectedSourceIds((current) =>
      current.length
        ? current.filter((id) => available.has(id))
        : availableRunMaterials.map((item) => item.id),
    );
    setPinnedSourceIds((current) => current.filter((id) => available.has(id)));
  }, [availableRunMaterials, continuation]);
  useEffect(() => {
    if (!project || view !== "settings") return;
    setExportPreview(undefined);
    setExportError("");
    void getExportPreview({
      scope: "project",
      projectId: project.id,
      includeAudio: exportAudio,
      includeActivity: exportActivity,
    })
      .then(setExportPreview)
      .catch((cause) =>
        setExportError(
          cause instanceof Error
            ? cause.message
            : "Could not prepare this Project export.",
        ),
      );
  }, [exportActivity, exportAudio, project?.id, view]);

  async function createProjectExport() {
    if (!project || !exportPreview) return;
    setExportBusy(true);
    setExportError("");
    try {
      const updated = await downloadWorkspaceExport(
        {
          scope: "project",
          projectId: project.id,
          includeAudio: exportAudio,
          includeActivity: exportActivity,
        },
        exportPreview,
      );
      if (updated) {
        setExportPreview(updated);
        setExportError("Selected data changed. Review the updated summary, then export again.");
      }
    } catch (cause) {
      setExportError(
        cause instanceof Error ? cause.message : "Could not create this Project export.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  const contextCandidates = useMemo(
    () =>
      materials.filter(
        (material) =>
          project &&
          (material.projects.includes(project.name) ||
            material.organization?.suggested_projects?.includes(project.name) ||
            material.excludedProjects?.includes(project.name) ||
            material.savedOnlyProjects?.includes(project.name)),
      ),
    [materials, project],
  );
  const contextGroups = useMemo(
    () => groupLibraryMaterials(contextCandidates, materials),
    [contextCandidates, materials],
  );
  const projectGroups = useMemo(
    () => groupLibraryMaterials(projectMaterials, materials),
    [projectMaterials, materials],
  );
  const availableRunGroups = useMemo(
    () => groupLibraryMaterials(availableRunMaterials, materials),
    [availableRunMaterials, materials],
  );
  const relatedTopics = useMemo(() => {
    const sourceIds = new Set(projectMaterials.map((material) => material.id));
    return topics.filter(
      (topic) =>
        !topic.hidden && topic.source_ids.some((id) => sourceIds.has(id)),
    );
  }, [projectMaterials, topics]);
  const classificationMemories = useMemo(() => {
    const byRoot = new Map<string, ClassificationMemory>();
    for (const material of materials) {
      const memory = material.organization?.user_correction;
      if (!memory) continue;
      const current = byRoot.get(memory.bundle_root_id);
      if (!current || memory.created_at > current.created_at) {
        byRoot.set(memory.bundle_root_id, memory);
      }
    }
    return [...byRoot.values()].filter((memory) =>
      memory.outcomes.some((outcome) => outcome.project === project?.name),
    );
  }, [materials, project?.name]);
  const runSources = run?.sources ?? [];
  const openedSource = runSources.find((source) => source.id === openSourceId);
  const citationSource =
    document?.sources?.find((source) => source.id === openCitationSourceId) ??
    materials.find((source) => source.id === openCitationSourceId);
  const selectedTopics = topics.filter((topic) =>
    selectedTopicIds.includes(topic.id),
  );
  const runSourceIds = continuation
    ? continuation.sourceIds
    : [
        ...new Set([
          ...selectedSourceIds,
          ...selectedTopics.flatMap((topic) => topic.source_ids),
        ]),
      ].filter((id) => materials.some((material) => material.id === id));
  const runGroups = groupLibraryMaterials(
    materials.filter((material) => runSourceIds.includes(material.id)),
    materials,
  );
  const selectedCount = runSourceIds.length;
  const selectedGroupCount = continuation
    ? continuation.sourceIds.length
    : runGroups.length;

  async function runProjectRequest() {
    if (!project || !request.trim() || !runSourceIds.length || running) return;
    if (mode === "compare" && selectedGroupCount < 2) {
      setRunError(
        "Compare needs at least two selected Source bundles. Choose more evidence or use Ask for a single Source.",
      );
      setSourcePickerOpen(true);
      return;
    }
    if (!aiReady) {
      setRunError(
        "Connect a provider in Settings → Models before using Ask, Compare, or Draft. Your local Project and Sources remain available.",
      );
      return;
    }
    const skill = projectSkill(project, settings, skills, mode);
    if (!skill) {
      setRunError(
        `No ${mode === "draft" ? "Draft" : "Ask"} Skill is available.`,
      );
      return;
    }
    setRunning(true);
    setRunError("");
    try {
      const ordered = [
        ...pinnedSourceIds.filter((id) => runSourceIds.includes(id)),
        ...runSourceIds.filter((id) => !pinnedSourceIds.includes(id)),
      ];
      const instruction = request.trim();
      const activity = await createMaterial({
        kind: "text",
        content: instruction,
        projects: [],
        actor: "user",
        activityType: mode,
        source: {
          title: `${project.name} ${mode === "ask" ? "question" : mode === "compare" ? "comparison" : "draft request"}`,
        },
      });
      const created = await createSkillRun({
        skill_id: skill.id,
        skill_explicit: false,
        skill_slot: mode === "draft" ? "draft" : "ask",
        instruction,
        project: project.name,
        source_ids: ordered,
        selection:
          mode === "compare"
            ? `Compare only the selected Project Sources${selectedTopics.length ? ` and these explicitly selected Topics: ${selectedTopics.map((topic) => topic.name).join(", ")}` : ""}. Separate agreements, differences, changes over time, and missing evidence. Cite every key comparison with [Source n]. Do not add outside facts.`
            : continuation
              ? "Continue the existing Draft in the target. Apply the user's new instruction while preserving useful content and valid [Source n] citations. State any missing evidence instead of inventing Project facts."
              : undefined,
        target_text: continuation?.output,
        continue_run_id: continuation?.runId,
        auto_search: false,
        activity_source_id: activity.id,
      });
      setRun(created);
      setResultMode(mode);
      setCandidate(created.original_output ?? "");
      setRequest("");
      setContinuation(undefined);
      setSourcePickerOpen(false);
      setOpenSourceId(undefined);
    } catch (cause) {
      if (cause instanceof SkillRunFailure) {
        setRun(cause.run);
        setResultMode(mode);
        setCandidate(cause.run.original_output ?? "");
        setRunError(`${cause.message} The failed Run and its Sources are saved.`);
        await onRefresh();
        return;
      }
      setRunError(
        cause instanceof Error
          ? cause.message
          : "Could not create this result.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function retryCurrentRun() {
    if (!run || run.status !== "failed" || running) return;
    setRunning(true);
    setRunError("");
    try {
      const retried = await retrySkillRun(run);
      setRun(retried);
      setCandidate(retried.original_output ?? "");
      await onRefresh();
    } catch (cause) {
      if (cause instanceof SkillRunFailure) {
        setRun(cause.run);
        setCandidate(cause.run.original_output ?? "");
        setRunError(`${cause.message} The failed Run and its Sources are saved.`);
        await onRefresh();
      } else {
        setRunError(
          cause instanceof Error ? cause.message : "Could not retry this Run.",
        );
      }
    } finally {
      setRunning(false);
    }
  }

  function beginContinuation(sourceRun: LogueSkillRun | SkillRun) {
    const output = (
      sourceRun.adopted_output ||
      sourceRun.original_output ||
      ""
    ).trim();
    if (!output) {
      setRunError("This Run has no Draft to continue.");
      return;
    }
    const sourceIds = sourceRun.sources.map((source) => source.id);
    setMode("draft");
    setRequest("");
    setContinuation({
      runId: sourceRun.id,
      output,
      sourceIds,
      label: sourceRun.instruction,
    });
    setSelectedSourceIds(sourceIds);
    setSelectedTopicIds([]);
    setPinnedSourceIds([]);
    setSourcePickerOpen(false);
    setRun(undefined);
    setCandidate("");
    setOpenHistoryRunId(undefined);
    setView("workspace");
    setRunError("");
  }

  function openDocumentInEditor(identifier: string) {
    setDocumentId(identifier);
    updateNavigationState((current) => ({
      ...current,
      documents: { ...current.documents, selectedId: identifier },
    }));
    onRoute("documents");
    const url = new URL(window.location.href);
    url.searchParams.set("doc", identifier);
    url.searchParams.delete("document");
    if (project?.name) url.searchParams.set("project", project.name);
    window.history.replaceState(null, "", url);
  }

  async function copyCandidate() {
    if (!run || !candidate.trim()) return;
    const content = candidate.trim();
    const previousAttempt = candidateAdoptionAttempts.current.copy;
    const adoptionId = previousAttempt?.content === content ? previousAttempt.id : createAdoptionId();
    candidateAdoptionAttempts.current.copy = { id: adoptionId, content };
    await navigator.clipboard.writeText(candidate.trim());
    setRun(
      await adoptSkillRun(run.id, candidate.trim(), {
        action: "copy",
        adoptionId,
        target: {
          surface: "clipboard",
          target_key: `project:${project?.name ?? ""}`,
        },
      }),
    );
    await onRefresh();
    delete candidateAdoptionAttempts.current.copy;
  }

  async function saveCandidateDocument(targetDocument?: LogueDocument) {
    if (!run || !candidate.trim() || savingDocument) return;
    const content = candidate.trim();
    const targetKey = targetDocument?.id ?? "new";
    const previousAttempt = candidateAdoptionAttempts.current.document;
    const adoptionId = previousAttempt?.content === content && previousAttempt.targetKey === targetKey
      ? previousAttempt.id
      : createAdoptionId();
    candidateAdoptionAttempts.current.document = { id: adoptionId, content, targetKey };
    setSavingDocument(true);
    setRunError("");
    try {
      const sourceIds = run.sources.map((source) => source.id);
      const result = await saveSkillRunAsDocument(run.id, {
        title: targetDocument?.title ?? run.instruction.slice(0, 72),
        content,
        documentId: targetDocument?.id,
        project: project?.name,
        sourceIds,
        contextSourceIds: sourceIds,
        sources: run.sources,
        contextSources: run.sources,
        expectedRevision: targetDocument?.revision,
        adoptionId,
        adoptionAction: targetDocument ? "replace" : "document",
        target: {
          surface: "project-workspace",
          target_key: targetDocument ? `document:${targetDocument.id}` : `project:${project?.id ?? ""}:new-document`,
        },
      });
      if (isLogueDocumentTombstone(result.document)) {
        throw new Error("Could not save this Document.");
      }
      const activeDocument = result.document;
      await onRefresh();
      delete candidateAdoptionAttempts.current.document;
      setDocumentTargetOpen(false);
      setDocumentId(activeDocument.id);
      setDocumentAdoption({
        ...documentAdoptionFromResult(
          adoptionId,
          activeDocument,
          targetDocument ? "replace" : "document",
        ),
        runId: run.id,
      });
      setDocumentUndoRetryable(false);
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : "Could not save this Document.");
    } finally {
      setSavingDocument(false);
    }
  }

  async function keepCandidate() {
    if (!run || !candidate.trim() || running) return;
    const content = candidate.trim();
    const previousAttempt = candidateAdoptionAttempts.current.keep;
    const adoptionId = previousAttempt?.content === content ? previousAttempt.id : createAdoptionId();
    candidateAdoptionAttempts.current.keep = { id: adoptionId, content };
    setRunning(true);
    setRunError("");
    try {
      setRun(await adoptSkillRun(run.id, content, {
        action: "keep",
        adoptionId,
        target: { surface: "project-workspace", target_key: `project:${project?.id ?? ""}:kept-source` },
      }));
      await onRefresh();
      delete candidateAdoptionAttempts.current.keep;
      setKeepAdoption({ id: adoptionId, runId: run.id });
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : "Could not keep this result in Logue.");
    } finally {
      setRunning(false);
    }
  }

  async function undoKeepCandidate() {
    if (!run || !keepAdoption || keepAdoption.runId !== run.id || running) return;
    setRunning(true);
    setRunError("");
    try {
      setRun(await adoptSkillRun(run.id, candidate, {
        action: "undo",
        adoptionId: keepAdoption.id,
        target: { surface: "project-workspace", target_key: `project:${project?.id ?? ""}:kept-source` },
      }));
      await onRefresh();
      setKeepAdoption(undefined);
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : "Could not undo Keep in Logue.");
    } finally {
      setRunning(false);
    }
  }

  async function undoCandidateDocumentUpdate() {
    if (!run || !documentAdoption || documentAdoption.runId !== run.id || savingDocument) return;
    setSavingDocument(true);
    setRunError("");
    try {
      const result = await saveSkillRunAsDocument(run.id, {
        title: run.instruction.slice(0, 72),
        content: candidate,
        documentId: documentAdoption.documentId,
        expectedRevision: documentAdoption.documentRevision,
        adoptionId: documentAdoption.id,
        adoptionAction: "undo",
        target: { surface: "project-workspace", target_key: `document:${documentAdoption.documentId}` },
      });
      const undoResult = resolveDocumentUndoResult(
        documentAdoption,
        result.document,
      );
      await onRefresh();
      if (undoResult.kind === "remove") setDocumentId(undefined);
      setDocumentAdoption(undefined);
      setDocumentUndoRetryable(false);
    } catch (cause) {
      const failure = resolveDocumentUndoFailure(documentAdoption, cause);
      setDocumentAdoption(failure.adoption);
      setDocumentUndoRetryable(failure.retryable);
      setRunError(failure.message);
    } finally {
      setSavingDocument(false);
    }
  }

  async function updateMembership(
    group: (typeof contextGroups)[number],
    action: "add" | "remove" | "exclude" | "undo" | "change",
    targetProject?: string,
  ) {
    if (!project) return;
    setMembershipBusy(group.key);
    setMembershipError("");
    try {
      await updateMaterialMembership(group.representative.id, {
        action,
        project: project.name,
        targetProject,
      });
      await onRefresh();
    } catch (cause) {
      setMembershipError(
        cause instanceof Error
          ? cause.message
          : "Could not update Project Context.",
      );
    } finally {
      setMembershipBusy("");
    }
  }

  async function saveProjectSettings() {
    if (!project) return;
    setSettingsBusy(true);
    try {
      await saveProject(project.name, {
        overview: project.overview ?? "",
        transcriptionProfile: profileDraft,
        skillBindings: bindingsDraft,
      });
      await onRefresh();
    } finally {
      setSettingsBusy(false);
    }
  }

  async function forgetLearningExample(memory: ClassificationMemory) {
    setClassificationMemoryBusy(memory.id);
    setClassificationMemoryError("");
    try {
      await forgetClassificationMemory(memory.bundle_root_id);
      await onRefresh();
      setForgetMemoryId(undefined);
    } catch (cause) {
      setClassificationMemoryError(
        cause instanceof Error
          ? cause.message
          : "Could not forget this learning example.",
      );
    } finally {
      setClassificationMemoryBusy("");
    }
  }

  async function reviewProjectDeletion() {
    if (!project) return;
    setSettingsBusy(true);
    setDeleteError("");
    try {
      setDeletePreview(
        await getDeletionPreview({ scope: "project", projectId: project.id }),
      );
      setDeleteConfirm("");
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Could not review this Project deletion.",
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  async function toggleHistoryRunPin(item: SkillRun) {
    setHistoryActionBusy(item.id);
    setHistoryActionError("");
    try {
      await setSkillRunPinned(item.id, !item.pinned);
      await onRefresh();
    } catch (cause) {
      setHistoryActionError(
        cause instanceof Error ? cause.message : "Could not update this Run.",
      );
    } finally {
      setHistoryActionBusy("");
    }
  }

  async function toggleProjectArchive() {
    if (!project || settingsBusy) return;
    setSettingsBusy(true);
    try {
      await saveProject(project.name, {
        overview: project.overview ?? "",
        transcriptionProfile: project.transcription_profile,
        skillBindings: project.skill_bindings ?? {},
        archived: !project.archived_at,
      });
      if (!project.archived_at)
        setProjectName(
          projects.find(
            (item) => item.name !== project.name && !item.archived_at,
          )?.name ?? project.name,
        );
      await onRefresh();
    } finally {
      setSettingsBusy(false);
    }
  }

  async function removeProject() {
    if (!project || !deletePreview || deleteConfirm !== project.name) return;
    setSettingsBusy(true);
    setDeleteError("");
    try {
      const outcome = await executeDeletion(
        { scope: "project", projectId: project.id },
        deletePreview,
      );
      if (outcome.preview) {
        setDeletePreview(outcome.preview);
        setDeleteError("Dependencies changed. Review the updated summary, then delete again.");
        return;
      }
      setProjectName(
        projects.find((item) => item.name !== project.name)?.name ?? "",
      );
      setView("workspace");
      await onRefresh();
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Could not delete this Project.",
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  function addVocabularyTerm() {
    const value = vocabularyTerm.trim();
    if (!value || profileDraft.vocabulary[vocabularyCategory].includes(value))
      return;
    setProfileDraft({
      ...profileDraft,
      vocabulary: {
        ...profileDraft.vocabulary,
        [vocabularyCategory]: [
          ...profileDraft.vocabulary[vocabularyCategory],
          value,
        ],
      },
    });
    setVocabularyTerm("");
  }

  function addPreferredSpelling() {
    const spoken = spokenTerm.trim();
    const preferred = preferredTerm.trim();
    if (!spoken || !preferred) return;
    setProfileDraft({
      ...profileDraft,
      vocabulary: {
        ...profileDraft.vocabulary,
        preferred_spellings: [
          ...profileDraft.vocabulary.preferred_spellings.filter(
            (item) => item.spoken.toLowerCase() !== spoken.toLowerCase(),
          ),
          { spoken, preferred },
        ],
      },
    });
    setSpokenTerm("");
    setPreferredTerm("");
  }

  const topbarActions = (
    <>
      <Button size="sm" onClick={() => setCreateOpen(true)}>
        <Plus size={15} />
        New Project
      </Button>
      {project ? (
        <Button size="sm" onClick={() => setEditOpen(true)}>
          <Settings2 size={15} />
          Project
        </Button>
      ) : null}
    </>
  );
  const inspector = run ? (
    <>
      <header className="v2-inspector-header">
        <div>
          <OriginLabel
            origin="ai"
            detail={`${run.skill_name} · ${run.status}`}
          />
          <h2>
            {resultMode === "ask"
              ? "Answer"
              : resultMode === "compare"
                ? "Comparison"
                : "Draft"}
          </h2>
        </div>
        <IconButton
          label="Close result"
          variant="ghost"
          onClick={() => {
            setRun(undefined);
            setCandidate("");
          }}
        >
          <PanelRightClose size={17} />
        </IconButton>
      </header>
      <div className="v2-inspector-scroll">
        <div className="v2-draft-card">
          <textarea
            aria-label="Generated result"
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
          />
          {runError ? (
            <div className="v2-warning-bar" role="alert">
              {runError}
            </div>
          ) : null}
          <div className="v2-citation-list">
            {runSources.map((source, index) => (
              <button
                key={source.id}
                className="v2-citation-chip"
                aria-pressed={openSourceId === source.id}
                onClick={() =>
                  setOpenSourceId(
                    openSourceId === source.id ? undefined : source.id,
                  )
                }
              >
                <span>{index + 1}</span>
                {source.source?.title ||
                  source.source?.domain ||
                  (source.actor === "user" ? "Your source" : "AI source")}
              </button>
            ))}
          </div>
          <div className="v2-inline-actions v2-actions-end">
            {run.status === "failed" ? (
              <Button
                size="sm"
                variant="primary"
                disabled={running}
                onClick={() => void retryCurrentRun()}
              >
                {running ? "Retrying…" : "Retry"}
              </Button>
            ) : null}
            {run.status === "complete" ? (
              <>
                <Button size="sm" onClick={() => void copyCandidate()}>
                  <Copy size={14} />
                  Copy
                </Button>
                <Button size="sm" disabled={running} onClick={() => void (keepAdoption?.runId === run.id ? undoKeepCandidate() : keepCandidate())}>
                  {keepAdoption?.runId === run.id ? <RotateCcw size={14} /> : <Sparkles size={14} />}
                  {keepAdoption?.runId === run.id ? "Undo Keep in Logue" : "Keep in Logue"}
                </Button>
                {run.output_type === "document" ? (
                  <Button size="sm" onClick={() => beginContinuation(run)}>
                    Continue
                  </Button>
                ) : null}
                {documentAdoption?.runId === run.id ? (
                  <Button size="sm" variant="primary" disabled={savingDocument} onClick={() => void undoCandidateDocumentUpdate()}>
                    <RotateCcw size={14} />
                    {savingDocument
                      ? "Undoing…"
                      : documentUndoRetryable
                        ? "Retry Undo"
                        : documentAdoption.action === "document"
                        ? "Undo Save as document"
                        : "Undo Document update"}
                  </Button>
                ) : <div className="v2-action-menu-wrap">
                  <Button
                    size="sm"
                    variant="primary"
                    aria-expanded={documentTargetOpen}
                    onClick={() => setDocumentTargetOpen((current) => !current)}
                  >
                    <FilePlus2 size={14} />
                    Document…
                  </Button>
                  {documentTargetOpen ? (
                    <div className="v2-skill-picker" role="menu" aria-label="Choose Document target">
                      <div className="v2-skill-picker-scroll">
                        <div className="v2-skill-picker-group">
                          <div className="v2-skill-picker-label">Create</div>
                          <button type="button" role="menuitem" disabled={savingDocument} onClick={() => void saveCandidateDocument()}>
                            <span>New Document</span>
                            <small>Start a Document with this sourced result</small>
                          </button>
                        </div>
                        {projectDocuments.length ? (
                          <div className="v2-skill-picker-group">
                            <div className="v2-skill-picker-label">Update existing</div>
                            {projectDocuments.map((item) => (
                              <button key={item.id} type="button" role="menuitem" disabled={savingDocument} onClick={() => void saveCandidateDocument(item)}>
                                <span>{item.title}</span>
                                <small>Replace as revision {item.revision + 1}</small>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>}
              </>
            ) : null}
          </div>
          {run.adopted_output ? (
            <div className="v2-local-ready">
              <Check size={14} />
              Adopted version recorded
            </div>
          ) : null}
        </div>
        {openedSource ? (
          <article className="v2-context-card">
            <OriginLabel
              origin={
                openedSource.actor === "user"
                  ? "you"
                  : openedSource.kind === "selection"
                    ? "web"
                    : "ai"
              }
              detail="Frozen for this Run"
            />
            <h3>
              {openedSource.source?.title ||
                openedSource.source?.domain ||
                "Saved Source"}
            </h3>
            <p>{contentSummary(openedSource.content)}</p>
            {openedSource.source?.url ? (
              <a
                className="v2-source-excerpt-toggle"
                href={openedSource.source.url}
                target="_blank"
                rel="noreferrer"
              >
                Open original
              </a>
            ) : null}
          </article>
        ) : null}
      </div>
    </>
  ) : historyRun ? (
    <RunInspector
      run={historyRun}
      documents={documents}
      onClose={() => setOpenHistoryRunId(undefined)}
      onRefresh={onRefresh}
    />
  ) : citationSource ? (
    <>
      <header className="v2-inspector-header">
        <div>
          <OriginLabel
            origin={sourceOrigin(citationSource)}
            detail="Frozen citation"
          />
          <h2>{materialTitle(citationSource)}</h2>
        </div>
        <IconButton
          label="Close citation"
          variant="ghost"
          onClick={() => setOpenCitationSourceId(undefined)}
        >
          <PanelRightClose size={17} />
        </IconButton>
      </header>
      <div className="v2-inspector-scroll">
        <article className="v2-source-bundle is-active">
          <p>{contentSummary(citationSource.content)}</p>
          {citationSource.source?.url ? (
            <a
              className="v2-source-excerpt-toggle"
              href={citationSource.source.url}
              target="_blank"
              rel="noreferrer"
            >
              Open original
            </a>
          ) : null}
        </article>
      </div>
    </>
  ) : undefined;

  return (
    <AppShell
      route="projects"
      projectName={project?.name}
      projects={projects.map((item) => ({
        id: item.name,
        name: item.archived_at ? `${item.name} · Archived` : item.name,
      }))}
      activeProjectId={project?.name}
      onProjectChange={setProjectName}
      onRouteChange={onRoute}
      topbarActions={topbarActions}
      inspectorOpen={Boolean(run || historyRun || citationSource)}
      onInspectorOpenChange={(open) => {
        if (!open) {
          setRun(undefined);
          setOpenHistoryRunId(undefined);
          setOpenCitationSourceId(undefined);
        }
      }}
      inspector={inspector}
    >
      <ProductStatus
        message={
          running
            ? run?.status === "failed"
              ? "Retrying failed Run…"
              : "Creating sourced result…"
            : run?.status === "complete"
              ? `${run.skill_name} result ready.`
              : undefined
        }
      />
      {loading && !project ? (
        <LoadingProjects />
      ) : !project ? (
        <EmptyProject onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          <div
            className="v2-project-subnav"
            role="tablist"
            aria-label="Project views"
          >
            <button
              role="tab"
              aria-selected={view === "workspace"}
              className={view === "workspace" ? "is-active" : ""}
              onClick={() => setView("workspace")}
            >
              Workspace
            </button>
            <button
              role="tab"
              aria-selected={view === "context"}
              className={view === "context" ? "is-active" : ""}
              onClick={() => setView("context")}
            >
              Context
            </button>
            <button
              role="tab"
              aria-selected={view === "history"}
              className={view === "history" ? "is-active" : ""}
              onClick={() => setView("history")}
            >
              History
            </button>
            <button
              role="tab"
              aria-selected={view === "settings"}
              className={view === "settings" ? "is-active" : ""}
              onClick={() => setView("settings")}
            >
              Voice & Skills
            </button>
          </div>
          {view === "workspace" ? (
            <>
              <div className="v2-editor-scroll">
                <article className="v2-editor-axis">
                  <div className="v2-editor-eyebrow">Project</div>
                  <h1 className="v2-editor-title">
                    {document?.title || project.name}
                  </h1>
                  <p className="v2-project-goal">
                    {project.overview ||
                      "Add a Project goal so classification and generation use the right intent."}
                  </p>
                  {document ? (
                    <div className="v2-editor-body">
                      <DocumentContent
                        value={document.content || "This document is empty."}
                        title={document.title}
                        readOnly
                        onCitationClick={(sourceNumber) =>
                          setOpenCitationSourceId(
                            document.source_ids[sourceNumber - 1],
                          )
                        }
                      />
                      <div className="v2-context-summary">
                        <span>
                          Revision {document.revision} ·{" "}
                          {
                            (document.context_source_ids ?? document.source_ids)
                              .length
                          }{" "}
                          frozen Sources
                        </span>
                        <button
                          className="v2-source-excerpt-toggle"
                          onClick={() => openDocumentInEditor(document.id)}
                        >
                          Continue editing
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="v2-editor-body">
                      <p className="v2-document-placeholder">
                        Ask a sourced question or draft a document from this
                        Project Context.
                      </p>
                    </div>
                  )}
                  {projectDocuments.length || recentProjectRuns.length ? (
                    <section className="v2-project-context-preview">
                      <div className="v2-panel-section-heading">
                        <div>
                          <h2>Recent work</h2>
                          <p>Continue a Document or reopen a sourced result.</p>
                        </div>
                      </div>
                      <div className="v2-review-list">
                        {projectDocuments.slice(0, 2).map((item) => (
                          <button
                            type="button"
                            className="v2-project-source-row"
                            key={item.id}
                            onClick={() => openDocumentInEditor(item.id)}
                          >
                            <OriginLabel origin="ai" detail="Document" />
                            <span>{item.title}</span>
                          </button>
                        ))}
                        {recentProjectRuns.slice(0, 2).map((item) => (
                          <button
                            type="button"
                            className="v2-project-source-row"
                            key={item.id}
                            onClick={() => setOpenHistoryRunId(item.id)}
                          >
                            <OriginLabel
                              origin="ai"
                              detail={`${item.skill_name} · ${item.status}`}
                            />
                            <span>{item.instruction}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <section className="v2-project-context-preview">
                    <div className="v2-panel-section-heading">
                      <div>
                        <h2>Project Context</h2>
                        <p>
                          {projectGroups.length} source bundle
                          {projectGroups.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => setView("context")}>
                        <ListChecks size={14} />
                        Review
                      </Button>
                    </div>
                    {projectGroups.slice(0, 3).map((group) => {
                      const item =
                        group.bundle?.primaryComment ?? group.representative;
                      return (
                        <div className="v2-project-source-row" key={group.key}>
                          <OriginLabel
                            origin={group.bundle ? "you" : sourceOrigin(item)}
                            detail={
                              group.bundle
                                ? "Web + You"
                                : item.kind === "voice"
                                  ? "Voice"
                                  : "Saved"
                            }
                          />
                          <span>
                            {materialTitle(
                              group.bundle?.source ?? group.representative,
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </section>
                </article>
              </div>
              {runError && !run ? (
                <div className="v2-composer-error" role="alert">
                  {runError}
                </div>
              ) : null}
              <div className="v2-composer-wrap">
                {continuation ? (
                  <div className="v2-continuation-context">
                    <div>
                      <strong>Continuing an existing Draft</strong>
                      <span>
                        {continuation.label} · {selectedGroupCount} frozen
                        Source
                        {selectedGroupCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setContinuation(undefined)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
                <div className="v2-context-control">
                  <button
                    type="button"
                    onClick={() => {
                      if (!continuation) setSourcePickerOpen((open) => !open);
                    }}
                    disabled={Boolean(continuation)}
                    aria-expanded={sourcePickerOpen}
                  >
                    <Sparkles size={14} />
                    {selectedGroupCount} Sources
                    {selectedTopics.length
                      ? ` · ${selectedTopics.length} ${selectedTopics.length === 1 ? "Topic" : "Topics"}`
                      : ""}
                    <ChevronDown size={12} />
                  </button>
                  {sourcePickerOpen ? (
                    <section className="v2-context-picker">
                      <div className="v2-panel-section-heading">
                        <div>
                          <h2>Sources for this Run</h2>
                          <p>
                            Pin key evidence or exclude anything irrelevant.
                          </p>
                        </div>
                        <IconButton
                          label="Close sources"
                          variant="ghost"
                          onClick={() => setSourcePickerOpen(false)}
                        >
                          <X size={15} />
                        </IconButton>
                      </div>
                      <div className="v2-context-picker-list">
                        {availableRunGroups.map((group) => {
                          const ids = group.items.map((item) => item.id);
                          const checked = ids.every((id) =>
                            selectedSourceIds.includes(id),
                          );
                          const pinned = ids.some((id) =>
                            pinnedSourceIds.includes(id),
                          );
                          const thisRunOnly = ids.some(
                            (id) =>
                              handoffSourceIds.includes(id) &&
                              !projectMaterials.some(
                                (material) => material.id === id,
                              ),
                          );
                          const item =
                            group.bundle?.primaryComment ??
                            group.representative;
                          return (
                            <div
                              className="v2-context-picker-row"
                              key={group.key}
                            >
                              <label>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    setSelectedSourceIds(
                                      event.target.checked
                                        ? [
                                            ...new Set([
                                              ...selectedSourceIds,
                                              ...ids,
                                            ]),
                                          ]
                                        : selectedSourceIds.filter(
                                            (id) => !ids.includes(id),
                                          ),
                                    )
                                  }
                                />
                                <span>
                                  <strong>
                                    {materialTitle(
                                      group.bundle?.source ??
                                        group.representative,
                                    )}
                                  </strong>
                                  <small>
                                    {thisRunOnly ? "This Run only · " : ""}
                                    {item.content}
                                  </small>
                                </span>
                              </label>
                              <button
                                type="button"
                                className={pinned ? "is-active" : ""}
                                aria-label={
                                  pinned ? "Unpin source" : "Pin source"
                                }
                                disabled={!checked}
                                onClick={() =>
                                  setPinnedSourceIds(
                                    pinned
                                      ? pinnedSourceIds.filter(
                                          (id) => !ids.includes(id),
                                        )
                                      : [
                                          ...new Set([
                                            ...pinnedSourceIds,
                                            ...ids,
                                          ]),
                                        ],
                                  )
                                }
                              >
                                <Pin size={14} />
                              </button>
                            </div>
                          );
                        })}
                        {topics.some((topic) => !topic.hidden) ? (
                          <div className="v2-context-picker-topics">
                            <strong>Topics</strong>
                            <span>
                              Add a Topic's Sources only for this Run.
                            </span>
                            {topics
                              .filter((topic) => !topic.hidden)
                              .map((topic) => (
                                <label key={topic.id}>
                                  <input
                                    type="checkbox"
                                    checked={selectedTopicIds.includes(
                                      topic.id,
                                    )}
                                    disabled={!topic.source_ids.length}
                                    onChange={(event) =>
                                      setSelectedTopicIds(
                                        event.target.checked
                                          ? [...selectedTopicIds, topic.id]
                                          : selectedTopicIds.filter(
                                              (id) => id !== topic.id,
                                            ),
                                      )
                                    }
                                  />
                                  <span>
                                    <strong>{topic.name}</strong>
                                    <small>
                                      {topic.source_ids.length} Source
                                      {topic.source_ids.length === 1 ? "" : "s"}
                                    </small>
                                  </span>
                                </label>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </div>
                <ProjectComposer
                  value={request}
                  onChange={setRequest}
                  onSubmit={() => void runProjectRequest()}
                  disabled={running || !selectedCount}
                  mode={mode}
                  onModeChange={(nextMode) => {
                    setMode(nextMode);
                    if (nextMode !== "draft") setContinuation(undefined);
                  }}
                  placeholder={
                    running
                      ? `${mode === "ask" ? "Answering" : mode === "compare" ? "Comparing" : "Drafting"}…`
                      : continuation
                        ? "How should this Draft change?"
                        : `${mode === "ask" ? "Ask" : mode === "compare" ? "Compare Sources" : "Draft"} with ${project.name}`
                  }
                />
              </div>
            </>
          ) : null}
          {view === "context" ? (
            <div className="v2-editor-scroll">
              <div className="v2-list-axis">
                <div className="v2-page-heading">
                  <div className="v2-page-heading-copy">
                    <h1>Project Context</h1>
                    <p>
                      Review what Logue may use. Excluding never deletes the
                      private Library original.
                    </p>
                  </div>
                  <Button onClick={() => onRoute("library")}>
                    Browse Library
                  </Button>
                </div>
                {membershipError ? (
                  <div className="v2-warning-bar" role="alert">
                    {membershipError}
                  </div>
                ) : null}
                <div className="v2-review-list">
                  {contextGroups.map((group) => {
                    const included = group.items.some((item) =>
                      item.projects.includes(project.name),
                    );
                    const excluded = group.items.some((item) =>
                      item.excludedProjects?.includes(project.name),
                    );
                    const suggested = group.items.find((item) =>
                      item.organization?.suggested_projects?.includes(
                        project.name,
                      ),
                    );
                    const item =
                      group.bundle?.primaryComment ?? group.representative;
                    const membershipOrigin = group.items.find((entry) =>
                      entry.projects.includes(project.name),
                    )?.organization?.membership_origins?.[project.name];
                    const duplicateLinked = group.items.some((entry) => {
                      const duplicateOf = entry.organization?.duplicate_of;
                      return (
                        duplicateOf &&
                        materials.some(
                          (candidate) =>
                            candidate.id === duplicateOf &&
                            candidate.projects.includes(project.name),
                        )
                      );
                    });
                    const state = excluded
                      ? "Excluded"
                      : duplicateLinked
                        ? "Duplicate-linked"
                        : included
                          ? membershipOrigin === "auto_added"
                            ? "Auto-added"
                            : "Added"
                          : suggested
                            ? "Suggested"
                            : "Saved only";
                    const busy = membershipBusy === group.key;
                    return (
                      <article className="v2-review-row" key={group.key}>
                        <div>
                          <OriginLabel
                            origin={group.bundle ? "you" : sourceOrigin(item)}
                            detail={state}
                          />
                          <h3>
                            {materialTitle(
                              group.bundle?.source ?? group.representative,
                            )}
                          </h3>
                          <ContentSummary value={item.content} />
                          <div className="v2-library-meta">
                            {excluded
                              ? "Your exclusion prevents automatic re-adding."
                              : duplicateLinked
                                ? "Linked to an existing Source, so Project results use this evidence once."
                                : suggested?.organization?.reason ||
                                  (membershipOrigin === "auto_added"
                                    ? "Added because this Project was active for the capture."
                                    : undefined) ||
                                  "Saved in your private Library."}
                          </div>
                        </div>
                        <RowActions
                          label={`More actions for ${materialTitle(group.bundle?.source ?? group.representative)}`}
                          primary={
                            excluded ? (
                              <Button size="sm" variant="primary" disabled={busy} onClick={() => void updateMembership(group, "undo")}>
                                Undo exclusion
                              </Button>
                            ) : included ? (
                              <Button size="sm" disabled={busy} onClick={() => void updateMembership(group, "remove")}>
                                Remove
                              </Button>
                            ) : (
                              <Button size="sm" variant="primary" disabled={busy} onClick={() => void updateMembership(group, "add")}>
                                Add to Context
                              </Button>
                            )
                          }
                        >
                          {!excluded ? (
                            <Button size="sm" disabled={busy} onClick={() => void updateMembership(group, "exclude")}>
                              Exclude from this Project
                            </Button>
                          ) : null}
                          {!excluded && projects.some(
                            (candidate) =>
                              candidate.name !== project.name &&
                              !candidate.archived_at,
                          ) ? (
                            <select
                              className="v2-input"
                              aria-label={`Change Project for ${materialTitle(group.bundle?.source ?? group.representative)}`}
                              value=""
                              disabled={busy}
                              onChange={(event) => {
                                const targetProject = event.target.value;
                                if (targetProject)
                                  void updateMembership(
                                    group,
                                    "change",
                                    targetProject,
                                  );
                              }}
                            >
                              <option value="">Change Project…</option>
                              {projects
                                .filter(
                                  (candidate) =>
                                    candidate.name !== project.name &&
                                    !candidate.archived_at,
                                )
                                .map((candidate) => (
                                  <option
                                    key={candidate.id || candidate.name}
                                    value={candidate.name}
                                  >
                                    {candidate.name}
                                  </option>
                                ))}
                            </select>
                          ) : null}
                        </RowActions>
                      </article>
                    );
                  })}
                  {!contextGroups.length ? (
                    <div className="v2-recovery-card">
                      <p>
                        No Sources are included, suggested, or excluded yet.
                        Browse the Library to add one.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {view === "history" ? (
            <div className="v2-editor-scroll">
              <div className="v2-list-axis">
                <div className="v2-page-heading-copy">
                  <h1>Project History</h1>
                  <p>
                    Every Ask, Compare, Draft, Command, and Skill Run keeps the exact
                    Sources and Skill revision it used.
                  </p>
                </div>
                {historyActionError ? (
                  <div className="v2-warning-bar" role="alert">
                    {historyActionError}
                  </div>
                ) : null}
                <div className="v2-review-list">
                  {projectRuns.map((item) => {
                    const activity = materials.find(
                      (material) => material.id === item.activity_source_id,
                    );
                    const adoptionTrail = item.adoption_revisions
                      ?.map((revision) => adoptionActionLabel(revision.action))
                      .join(" → ");
                    return (
                    <article className="v2-review-row" key={item.id}>
                      <div>
                        <OriginLabel
                          origin="ai"
                          detail={`${activityLabel(activity?.activityType)} · ${item.skill_name} · ${item.status}`}
                        />
                        <h3>{item.instruction}</h3>
                        <ContentSummary
                          value={
                            item.adopted_output ||
                            item.original_output ||
                            item.error
                          }
                          fallback="No result yet."
                        />
                        <div className="v2-library-meta">
                          {new Date(item.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}{" "}
                          · {item.sources.length} frozen Sources
                          {` · ${skillResolutionLabel(item.skill_resolution)}`}
                          {item.adopted_output
                            ? " · adopted"
                            : item.status === "failed"
                              ? " · recoverable"
                              : " · candidate"}
                          {adoptionTrail ? ` · ${adoptionTrail}` : ""}
                          {item.continue_run_id ? " · continued Draft" : ""}
                          {item.retry_run_id ? " · retry" : ""}
                          {item.pinned ? " · pinned" : ""}
                        </div>
                      </div>
                      <div className="v2-inline-actions">
                        <Button
                          size="sm"
                          disabled={historyActionBusy === item.id}
                          onClick={() => void toggleHistoryRunPin(item)}
                        >
                          {item.pinned ? (
                            <PinOff size={14} />
                          ) : (
                            <Pin size={14} />
                          )}
                          {item.pinned ? "Unpin" : "Pin"}
                        </Button>
                        {"output_type" in item &&
                        item.output_type === "document" &&
                        (item.adopted_output || item.original_output) ? (
                          <Button
                            size="sm"
                            onClick={() => beginContinuation(item)}
                          >
                            Continue
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          onClick={() => setOpenHistoryRunId(item.id)}
                        >
                          <History size={14} />
                          Open
                        </Button>
                      </div>
                    </article>
                    );
                  })}
                  {!projectRuns.length ? (
                    <div className="v2-recovery-card">
                      <p>
                        No Project activity yet. Ask a question, create a Draft,
                        or use Voice Command.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {view === "settings" ? (
            <div className="v2-editor-scroll">
              <div className="v2-list-axis">
                <div className="v2-page-heading-copy">
                  <h1>Project settings</h1>
                  <p>
                    Project-specific overrides stay local to {project.name}.
                  </p>
                </div>
                <section className="v2-settings-section">
                  <h2>Transcription Profile</h2>
                  <div className="v2-segmented">
                    {(["inherited", "customized", "disabled"] as const).map(
                      (item) => (
                        <button
                          key={item}
                          className={
                            profileDraft.mode === item ? "is-active" : ""
                          }
                          onClick={() =>
                            setProfileDraft({ ...profileDraft, mode: item })
                          }
                        >
                          {item[0].toUpperCase() + item.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                  {profileDraft.mode === "customized" ? (
                    <>
                      <div className="v2-form-grid">
                        <label>
                          Primary language
                          <input
                            className="v2-input"
                            value={profileDraft.primary_language}
                            onChange={(event) =>
                              setProfileDraft({
                                ...profileDraft,
                                primary_language: event.target.value,
                              })
                            }
                            placeholder="Auto-detect"
                          />
                        </label>
                        <label>
                          Mixed languages
                          <input
                            className="v2-input"
                            value={profileDraft.mixed_languages.join(", ")}
                            onChange={(event) =>
                              setProfileDraft({
                                ...profileDraft,
                                mixed_languages: event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                        <label className="v2-span-2">
                          Known phrases
                          <textarea
                            className="v2-textarea"
                            value={profileDraft.phrases.join("\n")}
                            onChange={(event) =>
                              setProfileDraft({
                                ...profileDraft,
                                phrases: event.target.value
                                  .split(/[\n,]/)
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="One phrase per line"
                          />
                        </label>
                        <label className="v2-span-2">
                          Avoid mistaken terms
                          <textarea
                            className="v2-textarea"
                            value={profileDraft.avoid_terms.join("\n")}
                            onChange={(event) =>
                              setProfileDraft({
                                ...profileDraft,
                                avoid_terms: event.target.value
                                  .split(/[\n,]/)
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="One form to avoid per line"
                          />
                        </label>
                        <label className="v2-span-2">
                          Formatting preference
                          <textarea
                            className="v2-textarea"
                            value={profileDraft.formatting_preference}
                            onChange={(event) =>
                              setProfileDraft({
                                ...profileDraft,
                                formatting_preference: event.target.value,
                              })
                            }
                            placeholder="For example: short paragraphs and Markdown bullets"
                          />
                        </label>
                        <label className="v2-span-2">
                          Custom instructions
                          <textarea
                            className="v2-textarea"
                            value={profileDraft.custom_instructions}
                            onChange={(event) =>
                              setProfileDraft({
                                ...profileDraft,
                                custom_instructions: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="v2-chip-groups">
                        {vocabularyCategories.map((category) =>
                          profileDraft.vocabulary[category.key].length ? (
                            <div key={category.key}>
                              <span>{category.label}</span>
                              <div>
                                {profileDraft.vocabulary[category.key].map(
                                  (value) => (
                                    <button
                                      key={value}
                                      onClick={() =>
                                        setProfileDraft({
                                          ...profileDraft,
                                          vocabulary: {
                                            ...profileDraft.vocabulary,
                                            [category.key]:
                                              profileDraft.vocabulary[
                                                category.key
                                              ].filter(
                                                (item) => item !== value,
                                              ),
                                          },
                                        })
                                      }
                                    >
                                      {value}
                                      <X size={11} />
                                    </button>
                                  ),
                                )}
                              </div>
                            </div>
                          ) : null,
                        )}
                      </div>
                      <div className="v2-filter-row">
                        <select
                          className="v2-input"
                          value={vocabularyCategory}
                          onChange={(event) =>
                            setVocabularyCategory(
                              event.target.value as VocabularyCategory,
                            )
                          }
                        >
                          {vocabularyCategories.map((category) => (
                            <option key={category.key} value={category.key}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="v2-input"
                          value={vocabularyTerm}
                          onChange={(event) =>
                            setVocabularyTerm(event.target.value)
                          }
                          placeholder="Add a Project term"
                        />
                        <Button onClick={addVocabularyTerm}>Add</Button>
                      </div>
                      <div className="v2-filter-row">
                        <input
                          className="v2-input"
                          value={spokenTerm}
                          onChange={(event) =>
                            setSpokenTerm(event.target.value)
                          }
                          placeholder="What Logue may hear"
                        />
                        <input
                          className="v2-input"
                          value={preferredTerm}
                          onChange={(event) =>
                            setPreferredTerm(event.target.value)
                          }
                          placeholder="Preferred spelling"
                        />
                        <Button onClick={addPreferredSpelling}>
                          Add spelling
                        </Button>
                      </div>
                      {profileDraft.vocabulary.preferred_spellings.map(
                        (entry) => (
                          <button
                            className="v2-membership-pill"
                            key={entry.spoken}
                            onClick={() =>
                              setProfileDraft({
                                ...profileDraft,
                                vocabulary: {
                                  ...profileDraft.vocabulary,
                                  preferred_spellings:
                                    profileDraft.vocabulary.preferred_spellings.filter(
                                      (item) => item.spoken !== entry.spoken,
                                    ),
                                },
                              })
                            }
                          >
                            {entry.spoken} → {entry.preferred} ×
                          </button>
                        ),
                      )}
                    </>
                  ) : (
                    <p className="v2-settings-lead">
                      {profileDraft.mode === "disabled"
                        ? "Uses the Default voice profile without Project vocabulary or context."
                        : "Inherits Default voice settings and this Project context."}
                    </p>
                  )}
                </section>
                <section className="v2-settings-section">
                  <h2>Skill overrides</h2>
                  {(
                    [
                      [
                        "transcription",
                        "Transcription",
                        (skill: LogueSkill) => skill.task === "transcribe",
                      ],
                      [
                        "organization",
                        "Organization",
                        (skill: LogueSkill) => skill.task === "organize",
                      ],
                      [
                        "command",
                        "Voice Command",
                        (skill: LogueSkill) =>
                          skill.task === "generate" &&
                          skill.output === "insert",
                      ],
                      [
                        "ask",
                        "Ask",
                        (skill: LogueSkill) =>
                          skill.task === "generate" && skill.output === "qa",
                      ],
                      [
                        "draft",
                        "Draft",
                        (skill: LogueSkill) =>
                          skill.task === "generate" &&
                          skill.output === "document",
                      ],
                    ] as Array<
                      [
                        keyof ProjectSkillBindings,
                        string,
                        (skill: LogueSkill) => boolean,
                      ]
                    >
                  ).map(([key, label, accepts]) => (
                    <div className="v2-setting-row" key={key}>
                      <div>
                        <strong>{label}</strong>
                        <p>
                          {bindingsDraft[key]
                            ? "Project override"
                            : "Inherits Global default"}
                        </p>
                      </div>
                      <select
                        className="v2-input"
                        value={bindingsDraft[key] ?? ""}
                        onChange={(event) =>
                          setBindingsDraft({
                            ...bindingsDraft,
                            [key]: event.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Inherit Global</option>
                        {skills
                          .filter((skill) => skill.enabled && accepts(skill))
                          .map((skill) => (
                            <option key={skill.id} value={skill.id}>
                              {skill.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </section>
                <section className="v2-settings-section">
                  <div className="v2-panel-section-heading">
                    <div>
                      <h2>Topics</h2>
                      <p className="v2-settings-lead">
                        Related clusters help discovery. They never grant
                        Project Context.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => onRoute("library")}>
                      Browse all Topics
                    </Button>
                  </div>
                  <div className="v2-review-list">
                    {relatedTopics.map((topic) => (
                      <article className="v2-review-row" key={topic.id}>
                        <div>
                          <OriginLabel
                            origin={topic.automatic ? "ai" : "you"}
                            detail={
                              topic.automatic
                                ? "Discovered Topic"
                                : "Your Topic"
                            }
                          />
                          <h3>{topic.name}</h3>
                          <p>{topic.reason}</p>
                          <div className="v2-library-meta">
                            {
                              topic.source_ids.filter((id) =>
                                projectMaterials.some(
                                  (material) => material.id === id,
                                ),
                              ).length
                            }{" "}
                            Project Source
                            {topic.source_ids.filter((id) =>
                              projectMaterials.some(
                                (material) => material.id === id,
                              ),
                            ).length === 1
                              ? ""
                              : "s"}
                          </div>
                        </div>
                      </article>
                    ))}
                    {!relatedTopics.length ? (
                      <div className="v2-recovery-card">
                        <p>No Topics currently overlap this Project.</p>
                      </div>
                    ) : null}
                  </div>
                </section>
                <section className="v2-settings-section">
                  <h2>Project boundary</h2>
                  <div className="v2-setting-row">
                    <div>
                      <strong>
                        {project.archived_at ? "Archived" : "Active"}
                      </strong>
                      <p>
                        Archiving hides this Project from daily selection
                        without changing its Context.
                      </p>
                    </div>
                    <Button
                      disabled={settingsBusy}
                      onClick={() => void toggleProjectArchive()}
                    >
                      {project.archived_at ? (
                        <ArchiveRestore size={14} />
                      ) : (
                        <Archive size={14} />
                      )}
                      {project.archived_at
                        ? "Restore Project"
                        : "Archive Project"}
                    </Button>
                  </div>
                  <div className="v2-setting-row">
                    <div>
                      <strong>Local export</strong>
                      <p>
                        {exportPreview
                          ? `${exportPreview.sources} Sources · ${exportPreview.activity} Activity · ${exportPreview.documents} Documents · ${exportPreview.runs} Runs · Original audio ${exportPreview.include_audio ? `included (${exportPreview.recordings})` : "excluded"} · About ${(exportPreview.estimated_bytes / 1_048_576).toFixed(1)} MB`
                          : "Preparing this Project scope…"}
                      </p>
                      <p>Export files cannot be restored. Provider keys and paired Extensions stay on this Host.</p>
                    </div>
                    <div className="v2-inline-actions">
                      <label className="v2-checkbox-row">
                        <input
                          type="checkbox"
                          checked={exportAudio}
                          onChange={(event) =>
                            setExportAudio(event.target.checked)
                          }
                        />
                        Include original audio
                      </label>
                      <label className="v2-checkbox-row">
                        <input
                          type="checkbox"
                          checked={exportActivity}
                          onChange={(event) => setExportActivity(event.target.checked)}
                        />
                        Include activity history and unused AI drafts
                      </label>
                      <Button
                        className="v2-download-button"
                        disabled={!exportPreview || exportBusy}
                        onClick={() => void createProjectExport()}
                      >
                        <Download size={14} />
                        {exportBusy ? "Exporting…" : "Export Project"}
                      </Button>
                    </div>
                  </div>
                  {exportError ? (
                    <div className="v2-warning-bar" role="alert">
                      {exportError}
                    </div>
                  ) : null}
                  <div className="v2-setting-row">
                    <div>
                      <strong>Delete Project</strong>
                      <p>
                        Review affected Sources, Documents, and Runs before
                        deleting this boundary.
                      </p>
                    </div>
                    <Button onClick={() => void reviewProjectDeletion()}>
                      <Trash2 size={14} />
                      Review deletion
                    </Button>
                  </div>
                  {deleteError && !deletePreview ? (
                    <div className="v2-warning-bar" role="alert">
                      {deleteError}
                    </div>
                  ) : null}
                </section>
                <section className="v2-settings-section">
                  <h2>Classification memory</h2>
                  {classificationMemoryError ? (
                    <div className="v2-warning-bar" role="alert">
                      {classificationMemoryError}
                    </div>
                  ) : null}
                  <div className="v2-review-list">
                    {classificationMemories.map((memory) => {
                      const source = materials.find((material) =>
                        memory.source_ids.includes(material.id),
                      );
                      const outcomeSummary = memory.outcomes
                        .map(
                          (outcome) =>
                            `${outcome.project} · ${
                              outcome.state === "saved_only"
                                ? "Saved only"
                                : outcome.state[0].toUpperCase() +
                                  outcome.state.slice(1)
                            }`,
                        )
                        .join(" · ");
                      const confirming = forgetMemoryId === memory.id;
                      return (
                        <article className="v2-review-row" key={memory.id}>
                          <div>
                            <OriginLabel
                              origin="you"
                              detail="Learning example"
                            />
                            <h3>
                              {source
                                ? materialTitle(source)
                                : "Saved classification correction"}
                            </h3>
                            <p>{memory.content_excerpt}</p>
                            <div className="v2-library-meta">
                              {outcomeSummary}
                            </div>
                            {confirming ? (
                              <div className="v2-recovery-card">
                                <p>
                                  Stops using this example for future
                                  suggestions. This Source stays Added, Saved
                                  only, or Excluded; its Projects and exclusions
                                  do not change.
                                </p>
                                <div className="v2-inline-actions">
                                  <Button
                                    size="sm"
                                    onClick={() => setForgetMemoryId(undefined)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    disabled={
                                      classificationMemoryBusy === memory.id
                                    }
                                    onClick={() =>
                                      void forgetLearningExample(memory)
                                    }
                                  >
                                    {classificationMemoryBusy === memory.id
                                      ? "Forgetting…"
                                      : "Forget learning example"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {!confirming ? (
                            <Button
                              size="sm"
                              onClick={() => setForgetMemoryId(memory.id)}
                            >
                              Forget learning example
                            </Button>
                          ) : null}
                        </article>
                      );
                    })}
                    {!classificationMemories.length ? (
                      <div className="v2-recovery-card">
                        <p>
                          No learning examples for this Project. Corrections
                          appear here after you change a classification.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>
                <div className="v2-inline-actions v2-actions-end">
                  <Button
                    variant="primary"
                    disabled={settingsBusy}
                    onClick={() => void saveProjectSettings()}
                  >
                    {settingsBusy ? "Saving…" : "Save Project settings"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
      <ProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={async (saved) => {
          setProjectName(saved.name);
          await onRefresh();
        }}
      />
      <ProjectDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={async (saved) => {
          setProjectName(saved.name);
          await onRefresh();
        }}
        project={project}
      />
      {project && deletePreview ? (
        <div className="v2-dialog-backdrop" role="presentation">
          <section
            ref={deleteDialogRef}
            className="v2-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            tabIndex={-1}
          >
            <div className="v2-panel-section-heading">
              <div>
                <OriginLabel origin="you" detail="Local Project boundary" />
                <h2 id="delete-project-title">Delete {project.name}?</h2>
              </div>
              <IconButton
                label="Close"
                variant="ghost"
                onClick={() => setDeletePreview(undefined)}
              >
                <X size={16} />
              </IconButton>
            </div>
            <p>
              Its {deletePreview.summary.sources} Sources stay in your private Library.{" "}
              {deletePreview.summary.documents} Documents move to No Project.{" "}
              {deletePreview.summary.runs} historical Runs keep their provenance.
            </p>
            {deleteError ? (
              <div className="v2-warning-bar" role="alert">
                {deleteError}
              </div>
            ) : null}
            <label className="v2-field-label">
              Type {project.name} to confirm
              <input
                className="v2-input"
                data-autofocus="true"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
              />
            </label>
            <div className="v2-inline-actions v2-actions-end">
              <Button onClick={() => setDeletePreview(undefined)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={settingsBusy || deleteConfirm !== project.name}
                onClick={() => void removeProject()}
              >
                Delete Project
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
