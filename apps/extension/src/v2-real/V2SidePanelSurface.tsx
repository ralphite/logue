import {
  ArrowLeft,
  Bookmark,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Ellipsis,
  ExternalLink,
  FileText,
  Globe2,
  LoaderCircle,
  Mic,
  Pin,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  UserRound,
  X,
} from "lucide-react";
import { OverlayMenu, ProductStatus } from "@logue/ui";
import { useState, type ButtonHTMLAttributes, type Ref } from "react";
import type { CorrectionScope } from "../api";
import {
  PENDING_VOICE_CAPACITY,
  type PendingVoiceSummary,
} from "../pendingVoice";
import type {
  CommandSourceSnapshot,
  ExtensionSkill,
  LocalError,
  PageMaterial,
  PageMaterialChanges,
  PanelCaptureState,
  PanelProject,
  PendingInsert,
  PanelDocument,
} from "../sidePanelModels";
import {
  capturePhasePresentation,
  type CapturePhase,
} from "../sidePanelPresentation";
import type {
  CaptureContext,
  ProjectAssociation,
  VoiceProfileOverrides,
} from "../voiceProfileModels";
import { VoiceProfilePicker } from "../VoiceProfilePicker";
import type {
  VoiceCandidateRetranscribeInput,
  VoiceCandidateState,
} from "./V2VoiceCandidateSurface";
import "../../../web/src/v2-mock/styles/surfaces.css";

function sourceTitle(state: PanelCaptureState) {
  if (state.source.title.trim()) return state.source.title;
  try {
    return new URL(state.source.url).hostname;
  } catch {
    return "Current page";
  }
}

function commandSourceLabel(source: CommandSourceSnapshot, index: number) {
  return (
    source.source?.title?.trim() ||
    source.source?.domain?.trim() ||
    (source.actor === "user" ? "Your note" : `Source ${index + 1}`)
  );
}

interface PageMaterialGroup {
  key: string;
  items: PageMaterial[];
  primary: PageMaterial;
  source?: PageMaterial;
}

function groupPageMaterials(materials: PageMaterial[]): PageMaterialGroup[] {
  const byId = new Map(materials.map((material) => [material.id, material]));
  const commentsBySource = new Map<string, PageMaterial[]>();
  for (const material of materials) {
    const parentIds = material.parentIds ?? [];
    if (
      material.kind !== "derived" ||
      (material.actor ?? "user").toLowerCase() !== "user" ||
      parentIds.length !== 1
    )
      continue;
    const source = byId.get(parentIds[0]);
    if (!source || source.kind !== "selection") continue;
    const comments = commentsBySource.get(source.id) ?? [];
    comments.push(material);
    commentsBySource.set(source.id, comments);
  }
  const bundledIds = new Set<string>();
  const groups: PageMaterialGroup[] = [];
  for (const [sourceId, comments] of commentsBySource) {
    const source = byId.get(sourceId);
    if (!source) continue;
    comments.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    const items = [source, ...comments];
    items.forEach((item) => bundledIds.add(item.id));
    groups.push({
      key: `comment:${source.id}`,
      items,
      primary: comments[0],
      source,
    });
  }
  for (const material of materials) {
    if (!bundledIds.has(material.id))
      groups.push({ key: material.id, items: [material], primary: material });
  }
  return groups.sort((left, right) =>
    right.primary.createdAt.localeCompare(left.primary.createdAt),
  );
}

function anchorStatusLabel(
  status?: "anchored" | "page_changed" | "reanchored" | "snapshot_only",
) {
  if (status === "anchored") return "Anchored";
  if (status === "page_changed") return "Page changed";
  if (status === "reanchored") return "Re-anchored";
  if (status === "snapshot_only") return "Snapshot only";
  return "";
}

function V2Button({
  children,
  primary = false,
  icon = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  icon?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={`v2x-button${primary ? " is-primary" : ""}${icon ? " is-icon" : ""}${props.className ? ` ${props.className}` : ""}`}
    >
      {children}
    </button>
  );
}

function V2Origin({
  origin,
  detail,
}: {
  origin: "web" | "you" | "ai";
  detail: string;
}) {
  const OriginIcon =
    origin === "web" ? Globe2 : origin === "you" ? UserRound : Bot;
  return (
    <span className="v2-origin-label">
      <OriginIcon aria-hidden="true" size={13} />
      {origin === "web" ? "Web" : origin === "you" ? "You" : "AI"}
      <span aria-hidden="true">·</span>
      {detail}
    </span>
  );
}

function V2VoiceCandidate({
  candidate,
  context,
  overrides,
  onOverridesChange,
  onTextChange,
  onRetranscribe,
  onInsert,
  onCopy,
  onUndo,
  onRetryAdoption,
  onDelete,
  onDismiss,
}: {
  candidate: VoiceCandidateState;
  context?: CaptureContext;
  overrides: VoiceProfileOverrides;
  onOverridesChange: (value: VoiceProfileOverrides) => void;
  onTextChange: (value: string) => void;
  onRetranscribe: (value: VoiceCandidateRetranscribeInput) => void;
  onInsert: () => void;
  onCopy: () => void;
  onUndo: () => void;
  onRetryAdoption: () => void;
  onDelete: () => void;
  onDismiss: () => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [spoken, setSpoken] = useState("");
  const [preferred, setPreferred] = useState("");
  const [scope, setScope] = useState<CorrectionScope>("only");
  const selectedProject = overrides.use_default_profile
    ? ""
    : (overrides.profile_project ??
      context?.resolved_voice_profile.project_name ??
      "");
  const selectedTopic =
    overrides.topic_vocabulary_id ??
    context?.resolved_voice_profile.topic_vocabulary_id ??
    "";
  const invalidCorrection =
    Boolean(spoken.trim()) !== Boolean(preferred.trim()) ||
    (scope === "project" && !selectedProject) ||
    (scope === "topic" && !selectedTopic);
  return (
    <section className="v2-draft-card" aria-label="Voice input candidate">
      <div className="v2-panel-section-heading">
        <V2Origin
          origin="you"
          detail={`Voice · revision ${candidate.revision}`}
        />
        <V2Button icon aria-label="Close candidate" onClick={onDismiss}>
          <X size={15} />
        </V2Button>
      </div>
      {candidate.inserted || candidate.copied ? (
        <div className="v2x-inserted">
          <Check size={16} />
          {candidate.copied ? "Copied" : "Inserted"}
        </div>
      ) : (
        <textarea
          aria-label={
            candidate.purpose === "comment" ? "Comment" : "Text to insert"
          }
          value={candidate.text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      )}
      {candidate.error ? (
        <div className="v2-warning-bar" role="alert">
          {candidate.error}
        </div>
      ) : null}
      {!candidate.inserted && !candidate.copied && optionsOpen ? (
        <div className="v2x-candidate-options">
          <VoiceProfilePicker
            context={context}
            overrides={overrides}
            onChange={onOverridesChange}
            onClose={() => setOptionsOpen(false)}
            embedded
          />
          <div className="v2x-correction">
            <input
              value={spoken}
              onChange={(event) => setSpoken(event.target.value)}
              placeholder="Heard term"
              aria-label="Heard term"
            />
            <span>→</span>
            <input
              value={preferred}
              onChange={(event) => setPreferred(event.target.value)}
              placeholder="Preferred spelling"
              aria-label="Preferred spelling"
            />
          </div>
          <div className="v2-inline-actions">
            <select
              value={scope}
              onChange={(event) =>
                setScope(event.target.value as CorrectionScope)
              }
              aria-label="Remember correction"
            >
              <option value="only">Only this time</option>
              <option value="topic" disabled={!selectedTopic}>
                Remember for Topic
              </option>
              <option value="project" disabled={!selectedProject}>
                Remember for Project
              </option>
              <option value="global">Remember globally</option>
            </select>
            <V2Button
              disabled={candidate.busy || invalidCorrection}
              onClick={() =>
                onRetranscribe(
                  spoken.trim() && preferred.trim()
                    ? {
                        correction: {
                          spoken: spoken.trim(),
                          preferred: preferred.trim(),
                          scope,
                        },
                      }
                    : {},
                )
              }
            >
              {candidate.busy ? (
                <LoaderCircle size={14} className="v2x-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              Re-transcribe
            </V2Button>
          </div>
        </div>
      ) : null}
      <div className="v2-inline-actions v2x-candidate-actions">
        {!candidate.inserted && !candidate.copied ? (
          <V2Button
            onClick={() => setOptionsOpen((value) => !value)}
            aria-expanded={optionsOpen}
          >
            {context?.resolved_voice_profile.label || candidate.profileLabel}
            <ChevronDown size={12} />
          </V2Button>
        ) : null}
        {candidate.purpose === "comment" ? (
          <V2Button disabled={candidate.busy} onClick={onDelete}>
            Delete comment
          </V2Button>
        ) : null}
        <span className="v2x-spacer" />
        {candidate.purpose !== "comment" &&
        !candidate.inserted &&
        !candidate.copied &&
        candidate.error ? (
          <V2Button disabled={candidate.busy} onClick={onCopy}>
            <Copy size={14} />
            Copy
          </V2Button>
        ) : null}
        {candidate.adoptionPending ? (
          <V2Button disabled={candidate.busy} onClick={onRetryAdoption}>
            Retry save
          </V2Button>
        ) : null}
        {candidate.canUndo ? (
          <V2Button primary disabled={candidate.busy} onClick={onUndo}>
            <RotateCcw size={14} />
            Undo
          </V2Button>
        ) : candidate.inserted || candidate.copied ? (
          <V2Button primary disabled={candidate.busy} onClick={onDismiss}>
            Done
          </V2Button>
        ) : (
          <V2Button
            primary
            disabled={
              candidate.busy ||
              !candidate.text.trim() ||
              Boolean(candidate.adoptionPending)
            }
            onClick={onInsert}
          >
            {candidate.purpose === "comment" ? "Finish comment" : "Insert"}
          </V2Button>
        )}
      </div>
    </section>
  );
}

export interface V2SidePanelSurfaceProps {
  state?: PanelCaptureState;
  phase: CapturePhase;
  draft: string;
  generatedText: string;
  commandSources?: CommandSourceSnapshot[];
  generationSources?: CommandSourceSnapshot[];
  generationSourceIds?: string[];
  pinnedSourceIds?: string[];
  generatedUndoAvailable?: boolean;
  generatedInsertAvailable?: boolean;
  generatedAdoptionPending?: boolean;
  insertingGenerated?: boolean;
  savingGeneratedDocument?: boolean;
  generatedDocumentUndoAvailable?: boolean;
  generatedKeepUndoAvailable?: boolean;
  documents?: PanelDocument[];
  skills: ExtensionSkill[];
  skillId: string;
  projects?: PanelProject[];
  projectAssociations?: ProjectAssociation[];
  pageMaterials: PageMaterial[];
  error?: LocalError;
  elapsed: number;
  pendingInsert?: PendingInsert;
  insertingPending: boolean;
  generating: boolean;
  canRetry: boolean;
  pendingVoices?: PendingVoiceSummary[];
  retryingPendingVoiceId?: string;
  serverURLDraft: string;
  serverPairingCodeDraft: string;
  serverCandidateURL?: string;
  serverSettingsOpen: boolean;
  serverConnecting: boolean;
  serverSettingsError?: string;
  providerNotice?: string;
  voiceProfileContext?: CaptureContext;
  voiceProfileOverrides?: VoiceProfileOverrides;
  voiceProfilePickerOpen?: boolean;
  voiceCandidate?: VoiceCandidateState;
  panelRef?: Ref<HTMLElement>;
  onDraftChange: (value: string) => void;
  onGeneratedTextChange: (value: string) => void;
  onCopyGenerated?: () => void;
  onKeepGenerated?: () => void;
  onUndoGeneratedKeep?: () => void;
  onSaveGeneratedDocument?: (document?: PanelDocument) => void;
  onUndoGeneratedDocument?: () => void;
  onUndoGenerated?: () => void;
  onRetryGeneratedAdoption?: () => void;
  onSkillIdChange: (value: string) => void;
  onGenerationSourceIdsChange?: (ids: string[]) => void;
  onPinGenerationSource?: (id: string) => void;
  onProjectsChange?: (value: string[]) => void;
  onCreateProject?: (name: string, overview: string) => Promise<void>;
  onRememberProject?: (scope: "page" | "site") => void;
  onDeleteProjectAssociation?: (id: string) => void;
  onTagsChange?: (value: string[]) => void;
  onUpdatePageMaterial?: (
    id: string,
    changes: PageMaterialChanges,
  ) => Promise<void>;
  onFinishUnlinkedVoiceComment?: (item: PageMaterial) => void;
  onDeleteUnlinkedVoiceComment?: (item: PageMaterial) => void;
  onLocatePageAnchor?: (item: PageMaterial) => void;
  onReanchorPageMaterial?: (item: PageMaterial) => void;
  onKeepSnapshotAnchor?: (item: PageMaterial) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onRetryTranscription: () => void;
  onRetryPendingVoice?: (id: string) => void;
  onExportPendingVoice?: (id: string) => void;
  onDeletePendingVoice?: (id: string) => void;
  onSave: () => void;
  onRequestGeneration: () => void;
  onReturnToPage: () => void;
  onGenerate: () => void;
  onRunPageSkill?: (skillId: string) => void;
  onCapturePage?: () => void;
  onInsertGenerated: () => void;
  onRetryInsert: () => void;
  onCopyPendingInsert: () => void;
  onServerURLDraftChange: (value: string) => void;
  onServerPairingCodeDraftChange: (value: string) => void;
  onOpenServerSettings: () => void;
  onCloseServerSettings: () => void;
  onConnectServer: () => void;
  onConnectCandidateServer: () => void;
  onRetryServer: () => void;
  onRetryModel: () => void;
  onOpenModelSettings: () => void;
  onVoiceProfileOverridesChange?: (value: VoiceProfileOverrides) => void;
  onVoiceProfilePickerOpenChange?: (value: boolean) => void;
  onVoiceCandidateTextChange?: (value: string) => void;
  onVoiceCandidateRetranscribe?: (
    value: VoiceCandidateRetranscribeInput,
  ) => void;
  onVoiceCandidateInsert?: () => void;
  onVoiceCandidateCopy?: () => void;
  onVoiceCandidateUndo?: () => void;
  onVoiceCandidateRetryAdoption?: () => void;
  onVoiceCandidateDelete?: () => void;
  onVoiceCandidateDismiss?: () => void;
}

export function V2SidePanelSurface({
  state,
  phase,
  draft,
  generatedText,
  commandSources = [],
  generationSources = [],
  generationSourceIds = [],
  pinnedSourceIds = [],
  generatedUndoAvailable = false,
  generatedInsertAvailable = false,
  generatedAdoptionPending = false,
  insertingGenerated = false,
  savingGeneratedDocument = false,
  generatedDocumentUndoAvailable = false,
  generatedKeepUndoAvailable = false,
  documents = [],
  skills,
  skillId,
  projects = [],
  projectAssociations = [],
  pageMaterials,
  error,
  elapsed,
  pendingInsert,
  insertingPending,
  generating,
  pendingVoices = [],
  retryingPendingVoiceId,
  serverURLDraft,
  serverPairingCodeDraft,
  serverCandidateURL,
  serverSettingsOpen,
  serverConnecting,
  serverSettingsError,
  providerNotice,
  voiceProfileContext,
  voiceProfileOverrides = {},
  voiceProfilePickerOpen = false,
  voiceCandidate,
  panelRef,
  onDraftChange,
  onGeneratedTextChange,
  onCopyGenerated,
  onKeepGenerated,
  onUndoGeneratedKeep,
  onSaveGeneratedDocument,
  onUndoGeneratedDocument,
  onUndoGenerated,
  onRetryGeneratedAdoption,
  onSkillIdChange,
  onGenerationSourceIdsChange = () => undefined,
  onPinGenerationSource = () => undefined,
  onProjectsChange = () => undefined,
  onCreateProject = async () => undefined,
  onRememberProject = () => undefined,
  onDeleteProjectAssociation = () => undefined,
  onTagsChange = () => undefined,
  onUpdatePageMaterial = async () => undefined,
  onFinishUnlinkedVoiceComment = () => undefined,
  onDeleteUnlinkedVoiceComment = () => undefined,
  onLocatePageAnchor = () => undefined,
  onReanchorPageMaterial = () => undefined,
  onKeepSnapshotAnchor = () => undefined,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onRetryTranscription,
  onRetryPendingVoice = () => undefined,
  onExportPendingVoice = () => undefined,
  onDeletePendingVoice = () => undefined,
  onSave,
  onRequestGeneration,
  onReturnToPage,
  onGenerate,
  onRunPageSkill = () => undefined,
  onCapturePage = () => undefined,
  onInsertGenerated,
  onRetryInsert,
  onCopyPendingInsert,
  onServerURLDraftChange,
  onServerPairingCodeDraftChange,
  onOpenServerSettings,
  onCloseServerSettings,
  onConnectServer,
  onConnectCandidateServer,
  onRetryServer,
  onRetryModel,
  onOpenModelSettings,
  onVoiceProfileOverridesChange = () => undefined,
  onVoiceProfilePickerOpenChange = () => undefined,
  onVoiceCandidateTextChange = () => undefined,
  onVoiceCandidateRetranscribe = () => undefined,
  onVoiceCandidateInsert = () => undefined,
  onVoiceCandidateCopy = () => undefined,
  onVoiceCandidateUndo = () => undefined,
  onVoiceCandidateRetryAdoption = () => undefined,
  onVoiceCandidateDelete = () => undefined,
  onVoiceCandidateDismiss = () => undefined,
}: V2SidePanelSurfaceProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [openSourceId, setOpenSourceId] = useState<string>();
  const [documentTargetOpen, setDocumentTargetOpen] = useState(false);
  const projectDocuments = documents.filter((document) => document.project === state?.projects?.[0]);
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [commentDraft, setCommentDraft] = useState("");
  const [commentTags, setCommentTags] = useState("");
  const [commentProjects, setCommentProjects] = useState<string[]>([]);
  const [commentSaving, setCommentSaving] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [projectCreating, setProjectCreating] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState("");
  if (!state)
    return (
      <div className="logue-v2 v2-side-panel-frame">
        <div className="v2-recovery-card v2x-empty">
          Open Logue from a page to begin.
        </div>
      </div>
    );
  const title = sourceTitle(state);
  const activeProject = state.projects?.[0];
  const presentation = capturePhasePresentation(phase);
  const generated = state.intent === "generate";
  const pendingVoiceQueueFull =
    pendingVoices.length >= PENDING_VOICE_CAPACITY;
  const openedSource = commandSources.find(
    (source) => source.id === openSourceId,
  );
  const pageMaterialGroups = groupPageMaterials(pageMaterials);

  return (
    <main
      ref={panelRef}
      className="logue-v2 v2-side-panel-frame"
      tabIndex={-1}
      data-logue-extension="off"
    >
      <ProductStatus
        message={
          generating
            ? "Creating sourced result…"
            : insertingGenerated
              ? "Inserting result…"
              : savingGeneratedDocument
                ? "Saving result as a Document…"
                : insertingPending
                  ? "Inserting saved text…"
                  : serverConnecting
                    ? "Connecting to Logue Host…"
                    : generatedText
                      ? "Sourced result ready."
                      : voiceCandidate
                        ? "Transcript ready."
                        : undefined
        }
      />
      <aside className="v2-side-panel" aria-label="Logue side panel">
        <header className="v2-panel-header">
          <button
            type="button"
            className="v2-panel-title v2x-title-button"
            onClick={() => setOrganizeOpen((value) => !value)}
            aria-expanded={organizeOpen}
          >
            <strong>{generated ? "Draft reply" : title}</strong>
            <span>
              {activeProject || "No project"}
              <ChevronDown size={11} />
            </span>
          </button>
          <OverlayMenu
            open={moreOpen}
            onOpenChange={setMoreOpen}
            placement="bottom-end"
            ariaLabel="More options"
            menuClassName="v2x-menu"
            trigger={(props) => (
              <V2Button {...props} icon aria-label="More options">
                <Ellipsis size={17} />
              </V2Button>
            )}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                onOpenServerSettings();
              }}
            >
              Host settings…
            </button>
          </OverlayMenu>
        </header>
        {organizeOpen && !presentation.captureActive ? (
          <section className="v2x-organize" aria-label="Organize capture">
            <div className="v2-panel-section-heading">
              <h2>Project</h2>
              <V2Button
                icon
                aria-label="Close organize"
                onClick={() => setOrganizeOpen(false)}
              >
                <X size={14} />
              </V2Button>
            </div>
            <div className="v2x-choice-list">
              <button
                className={!state.projects?.length ? "is-active" : ""}
                onClick={() => onProjectsChange([])}
              >
                No project
              </button>
              {projects.map((project) => (
                <label key={project.name}>
                  <input
                    type="radio"
                    name="logue-active-project"
                    checked={activeProject === project.name}
                    onChange={() => onProjectsChange([project.name])}
                  />
                  {project.name}
                </label>
              ))}
            </div>
            {!activeProject ? (
              projectCreateOpen ? (
                <div className="v2-settings-section">
                  <label className="v2x-field">
                    Name
                    <input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      autoFocus
                    />
                  </label>
                  <label className="v2x-field">
                    Goal <span className="v2-library-meta">Optional</span>
                    <textarea
                      value={projectGoal}
                      onChange={(event) => setProjectGoal(event.target.value)}
                    />
                  </label>
                  {projectCreateError ? (
                    <div className="v2-warning-bar" role="alert">
                      {projectCreateError}
                    </div>
                  ) : null}
                  <div className="v2-inline-actions">
                    <V2Button
                      disabled={projectCreating}
                      onClick={() => {
                        setProjectCreateOpen(false);
                        setProjectCreateError("");
                      }}
                    >
                      Cancel
                    </V2Button>
                    <V2Button
                      primary
                      disabled={projectCreating || !projectName.trim()}
                      onClick={() => {
                        setProjectCreating(true);
                        setProjectCreateError("");
                        void onCreateProject(
                          projectName.trim(),
                          projectGoal.trim(),
                        )
                          .then(() => {
                            setProjectCreating(false);
                            setProjectCreateOpen(false);
                            setProjectName("");
                            setProjectGoal("");
                            setOrganizeOpen(false);
                          })
                          .catch((cause: unknown) => {
                            setProjectCreating(false);
                            setProjectCreateError(
                              cause instanceof Error
                                ? cause.message
                                : "Could not create this Project.",
                            );
                          });
                      }}
                    >
                      {projectCreating ? "Creating…" : "Create Project"}
                    </V2Button>
                  </div>
                </div>
              ) : (
                <V2Button onClick={() => setProjectCreateOpen(true)}>
                  Create Project
                </V2Button>
              )
            ) : null}
            {activeProject ? (
              <div className="v2x-associations">
                <div className="v2-library-meta">
                  Use {activeProject} automatically
                </div>
                <div className="v2-inline-actions">
                  <V2Button
                    disabled={projectAssociations.some(
                      (item) =>
                        item.scope === "page" &&
                        item.project_name === activeProject,
                    )}
                    onClick={() => onRememberProject("page")}
                  >
                    For this page
                  </V2Button>
                  <V2Button
                    disabled={projectAssociations.some(
                      (item) =>
                        item.scope === "site" &&
                        item.project_name === activeProject,
                    )}
                    onClick={() => onRememberProject("site")}
                  >
                    For this site
                  </V2Button>
                </div>
              </div>
            ) : null}
            {projectAssociations.length ? (
              <div className="v2x-association-list" aria-label="Project rules">
                {projectAssociations.map((association) => (
                  <div key={association.id}>
                    <span>
                      <strong>
                        {association.scope === "page"
                          ? "This page"
                          : "This site"}
                      </strong>
                      <small>{association.project_name}</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteProjectAssociation(association.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <label className="v2x-field">
              Tags
              <input
                value={(state.tags ?? []).join(", ")}
                onChange={(event) =>
                  onTagsChange(
                    event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="research, decision"
              />
            </label>
          </section>
        ) : null}
        {pendingVoiceQueueFull ? (
          <div className="v2-warning-bar" role="alert">
            Saved recording storage is full. Export or delete one before
            recording again.
          </div>
        ) : pendingVoices.length ? (
          <div className="v2-offline-bar" role="status">
            <strong>
              {pendingVoices.length} recording
              {pendingVoices.length === 1 ? "" : "s"} saved on this Mac.
            </strong>{" "}
            Retry when the Host is available.
          </div>
        ) : error?.kind === "service" ? (
          <div className="v2-offline-bar" role="alert">
            Host unavailable · new recordings stay on this Mac.
          </div>
        ) : null}
        {providerNotice && error?.kind !== "service" ? (
          <div className="v2-warning-bar" role="status">
            <span>{providerNotice}</span>
            <V2Button onClick={onOpenModelSettings}>Model settings…</V2Button>
          </div>
        ) : null}
        {error?.kind === "target" ? (
          <div className="v2-warning-bar" role="alert">{error.message}</div>
        ) : error && error.kind !== "service" ? (
          <div className="v2-warning-bar" role="alert">
            <span>{error.message}</span>
            {error.kind === "transcription" ? <div className="v2-inline-actions"><V2Button onClick={onRetryTranscription}>Retry</V2Button><V2Button onClick={onOpenModelSettings}>Model settings…</V2Button></div> : null}
            {error.kind === "model" ? <div className="v2-inline-actions"><V2Button onClick={onRetryModel} disabled={generating}>{generating ? "Retrying…" : "Retry"}</V2Button><V2Button onClick={onOpenModelSettings}>Model settings…</V2Button></div> : null}
          </div>
        ) : null}
        <div className="v2-panel-scroll">
          {serverSettingsOpen ? (
            <section className="v2-settings-section">
              <div className="v2-panel-section-heading">
                <h2>Host</h2>
                <V2Button
                  icon
                  aria-label="Close Host settings"
                  onClick={onCloseServerSettings}
                >
                  <X size={14} />
                </V2Button>
              </div>
              <label className="v2x-field">
                Host address
                <input
                  type="url"
                  value={serverURLDraft}
                  onChange={(event) =>
                    onServerURLDraftChange(event.target.value)
                  }
                  placeholder="http://127.0.0.1:8787"
                  autoFocus
                />
              </label>
              <label className="v2x-field">
                Pairing code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={serverPairingCodeDraft}
                  onChange={(event) =>
                    onServerPairingCodeDraftChange(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  placeholder="Only for another device"
                />
              </label>
              {serverSettingsError ? (
                <p className="v2-warning-bar">{serverSettingsError}</p>
              ) : null}
              <div className="v2-inline-actions">
                <V2Button onClick={onCloseServerSettings}>Cancel</V2Button>
                {serverCandidateURL ? (
                  <V2Button
                    onClick={onConnectCandidateServer}
                    disabled={serverConnecting}
                  >
                    Use detected Host
                  </V2Button>
                ) : null}
                <V2Button
                  primary
                  onClick={onConnectServer}
                  disabled={serverConnecting || !serverURLDraft.trim()}
                >
                  {serverConnecting ? "Connecting…" : "Connect"}
                </V2Button>
              </div>
            </section>
          ) : (
            <>
              {pendingVoices.length ? (
                <section className="v2-panel-section">
                  <div className="v2-panel-section-heading">
                    <h2>Saved recordings</h2>
                    <span className="v2-quiet-pill">Local</span>
                  </div>
                  {pendingVoices.map((item) => (
                    <article className="v2-comment-card" key={item.id}>
                      <V2Origin
                        origin="you"
                        detail={item.error ? "Needs retry" : "Waiting for Host"}
                      />
                      <p>{item.pageTitle || "Voice recording"}</p>
                      <div className="v2-inline-actions">
                        <V2Button
                          disabled={Boolean(retryingPendingVoiceId)}
                          onClick={() => onRetryPendingVoice(item.id)}
                        >
                          {retryingPendingVoiceId === item.id
                            ? "Retrying…"
                            : "Retry"}
                        </V2Button>
                        <V2Button onClick={() => onExportPendingVoice(item.id)}>
                          Export audio
                        </V2Button>
                        <V2Button onClick={() => onDeletePendingVoice(item.id)}>
                          Delete
                        </V2Button>
                      </div>
                    </article>
                  ))}
                </section>
              ) : null}
              {voiceCandidate ? (
                <section className="v2-panel-section">
                  <V2VoiceCandidate
                    candidate={voiceCandidate}
                    context={voiceProfileContext}
                    overrides={voiceProfileOverrides}
                    onOverridesChange={onVoiceProfileOverridesChange}
                    onTextChange={onVoiceCandidateTextChange}
                    onRetranscribe={onVoiceCandidateRetranscribe}
                    onInsert={onVoiceCandidateInsert}
                    onCopy={onVoiceCandidateCopy}
                    onUndo={onVoiceCandidateUndo}
                    onRetryAdoption={onVoiceCandidateRetryAdoption}
                    onDelete={onVoiceCandidateDelete}
                    onDismiss={onVoiceCandidateDismiss}
                  />
                </section>
              ) : generatedText ? (
                <section className="v2-panel-section">
                  <div className="v2-panel-section-heading">
                    <h2>{generated ? "Draft reply" : "Page action"}</h2>
                    <span className="v2-quiet-pill">
                      {commandSources.length} sources
                    </span>
                  </div>
                  <div className="v2-draft-card">
                    <textarea
                      value={generatedText}
                      readOnly={generatedUndoAvailable || generatedAdoptionPending}
                      onChange={(event) =>
                        onGeneratedTextChange(event.target.value)
                      }
                      aria-label={
                        generated ? "Draft reply" : "Page action result"
                      }
                    />
                    <div className="v2-citation-list">
                      {commandSources.map((source, index) => (
                        <button
                          key={source.id}
                          className="v2-citation-chip"
                          aria-pressed={openSourceId === source.id}
                          onClick={() =>
                            setOpenSourceId((current) =>
                              current === source.id ? undefined : source.id,
                            )
                          }
                        >
                          <span>{index + 1}</span>
                          {commandSourceLabel(source, index)}
                        </button>
                      ))}
                    </div>
                    <div className="v2-inline-actions v2x-candidate-actions">
                      <V2Button disabled={generatedAdoptionPending} onClick={onCopyGenerated}>
                        <Copy size={14} />
                        Copy
                      </V2Button>
                      <V2Button disabled={generatedAdoptionPending} onClick={generatedKeepUndoAvailable ? onUndoGeneratedKeep : onKeepGenerated}>
                        {generatedKeepUndoAvailable ? <RotateCcw size={14} /> : <Sparkles size={14} />}
                        {generatedKeepUndoAvailable ? "Undo Keep in Logue" : "Keep in Logue"}
                      </V2Button>
                      {generatedDocumentUndoAvailable ? (
                        <V2Button disabled={savingGeneratedDocument} onClick={onUndoGeneratedDocument}>
                          <RotateCcw size={14} />
                          {savingGeneratedDocument ? "Undoing…" : "Undo Document update"}
                        </V2Button>
                      ) : <div className="v2-action-menu-wrap">
                        <V2Button
                          disabled={savingGeneratedDocument || generatedAdoptionPending}
                          aria-expanded={documentTargetOpen}
                          onClick={() => setDocumentTargetOpen((current) => !current)}
                        >
                          <FileText size={14} />
                          {savingGeneratedDocument ? "Saving…" : "Document…"}
                        </V2Button>
                        {documentTargetOpen ? (
                          <div className="v2-skill-picker" role="menu" aria-label="Choose Document target">
                            <div className="v2-skill-picker-scroll">
                              <div className="v2-skill-picker-group">
                                <div className="v2-skill-picker-label">Create</div>
                                <button type="button" role="menuitem" disabled={savingGeneratedDocument} onClick={() => { setDocumentTargetOpen(false); onSaveGeneratedDocument?.(); }}>
                                  <span>New Document</span>
                                  <small>Start a Document with this sourced result</small>
                                </button>
                              </div>
                              {projectDocuments.length ? (
                                <div className="v2-skill-picker-group">
                                  <div className="v2-skill-picker-label">Update existing</div>
                                  {projectDocuments.map((document) => (
                                    <button key={document.id} type="button" role="menuitem" disabled={savingGeneratedDocument} onClick={() => { setDocumentTargetOpen(false); onSaveGeneratedDocument?.(document); }}>
                                      <span>{document.title}</span>
                                      <small>Replace as revision {document.revision + 1}</small>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>}
                      {generatedAdoptionPending ? (
                        <V2Button
                          disabled={insertingGenerated}
                          onClick={onRetryGeneratedAdoption}
                        >
                          {insertingGenerated ? "Saving…" : "Retry save"}
                        </V2Button>
                      ) : null}
                      {!generatedAdoptionPending && generatedUndoAvailable ? (
                        <V2Button
                          primary
                          disabled={insertingGenerated}
                          onClick={onUndoGenerated}
                        >
                          <RotateCcw size={14} />
                          Undo
                        </V2Button>
                      ) : !generatedAdoptionPending && generated && generatedInsertAvailable ? (
                        <V2Button
                          primary
                          disabled={insertingGenerated}
                          onClick={onInsertGenerated}
                        >
                          {insertingGenerated ? "Inserting…" : "Insert"}
                        </V2Button>
                      ) : null}
                    </div>
                  </div>
                  {openedSource ? (
                    <article className="v2-context-card">
                      <div className="v2-panel-section-heading">
                        <V2Origin
                          origin={
                            openedSource.actor === "user"
                              ? "you"
                              : openedSource.kind === "derived"
                                ? "ai"
                                : "web"
                          }
                          detail="Source used"
                        />
                        {openedSource.source?.url ? (
                          <a
                            href={openedSource.source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : null}
                      </div>
                      <strong>
                        {commandSourceLabel(
                          openedSource,
                          commandSources.indexOf(openedSource),
                        )}
                      </strong>
                      <p>{openedSource.content}</p>
                    </article>
                  ) : null}
                </section>
              ) : (
                <>
                  <section className="v2-panel-section">
                    <div className="v2-panel-section-heading">
                      <h2>On this page</h2>
                      {state.source.url ? (
                        <a
                          href={state.source.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open current page"
                        >
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
                    </div>
                    <article className="v2-context-card">
                      <V2Origin
                        origin="web"
                        detail={
                          state.selectionText ? "Selected text" : "Current page"
                        }
                      />
                      <p>{state.selectionText || title}</p>
                      <div className="v2-library-meta">
                        Snapshot retained when saved
                      </div>
                    </article>
                    <div className="v2x-page-actions">
                      <V2Button
                        disabled={
                          generating || !(state.selectionText || state.pageText)
                        }
                        onClick={onCapturePage}
                      >
                        <Bookmark size={14} />
                        {state.selectionText ? "Save selection" : "Save page"}
                      </V2Button>
                      {skills
                        .filter((skill) => skill.task === "generate")
                        .slice(0, 3)
                        .map((skill) => (
                          <V2Button
                            key={skill.id}
                            disabled={
                              generating ||
                              !(state.selectionText || state.pageText)
                            }
                            onClick={() => onRunPageSkill(skill.id)}
                          >
                            <Sparkles size={14} />
                            {skill.name}
                          </V2Button>
                        ))}
                    </div>
                  </section>
                  <section className="v2-panel-section">
                    <div className="v2-panel-section-heading">
                      <h2>Comments</h2>
                      <span className="v2-quiet-pill">
                        {pageMaterialGroups.length}
                      </span>
                    </div>
                    {pageMaterialGroups.map((group) => {
                      const material = group.primary;
                      const anchorMaterial =
                        group.source ??
                        (material.kind === "selection" ? material : undefined);
                      const anchorStatus =
                        anchorMaterial?.source?.anchor?.status;
                      const unlinked = material.commentState === "unlinked";
                      const transcriptionPending =
                        Boolean(material.transcriptionPending);
                      const included = Boolean(
                        activeProject &&
                          group.items.some((item) =>
                            item.projects.includes(activeProject),
                          ),
                      );
                      const excluded = Boolean(
                        activeProject &&
                          group.items.some((item) =>
                            item.excludedProjects.includes(activeProject),
                          ),
                      );
                      const assignedProjects = Array.from(
                        new Set(group.items.flatMap((item) => item.projects)),
                      );
                      const groupExcludedProjects = Array.from(
                        new Set(
                          group.items.flatMap((item) => item.excludedProjects),
                        ),
                      );
                      const groupSavedOnlyProjects = Array.from(
                        new Set(
                          group.items.flatMap((item) => item.savedOnlyProjects),
                        ),
                      );
                      const groupTags = Array.from(
                        new Set(group.items.flatMap((item) => item.tags)),
                      );
                      const suggested = activeProject
                        ? group.items.find((item) =>
                            item.organization?.suggestedProjects?.includes(
                              activeProject,
                            ),
                          )
                        : undefined;
                      const autoAdded = Boolean(
                        activeProject &&
                          group.items.some(
                            (item) =>
                              item.organization?.membershipOrigins?.[
                                activeProject
                              ] === "auto_added",
                          ),
                      );
                      const duplicateLinked = group.items.some((item) =>
                        Boolean(item.organization?.duplicateOf),
                      );
                      const classification = excluded
                        ? "Excluded"
                        : duplicateLinked && included
                          ? "Duplicate-linked"
                          : included
                            ? autoAdded
                              ? "Auto-added"
                              : "Added"
                            : suggested
                              ? "Suggested"
                              : "Saved only";
                      const classificationReason = excluded
                        ? "Your exclusion prevents automatic re-adding."
                        : duplicateLinked && included
                          ? "Linked to an existing Source, so Project results use this evidence once."
                          : suggested?.organization?.reason ||
                            material.organization?.reason ||
                            "Saved in your private Library.";
                      const editable =
                        !unlinked &&
                        material.kind !== "selection" &&
                        (material.actor ?? "user").toLowerCase() === "user";
                      const editing = editingCommentId === group.key;
              const updateGroup = (changes: PageMaterialChanges) =>
                onUpdatePageMaterial(material.id, changes);
              const updateGroupQuietly = (changes: PageMaterialChanges) => {
                void updateGroup(changes).catch(() => undefined);
              };
                      return (
                        <article className="v2-comment-card" key={group.key}>
                          <div className="v2-panel-section-heading">
                            <V2Origin
                              origin="you"
                              detail={
                                transcriptionPending
                                  ? "Transcription pending"
                                  : unlinked
                                    ? "Unlinked voice comment"
                                  : group.source
                                    ? `Web + You · ${classification}`
                                    : classification
                              }
                            />
                            {editable && !editing ? (
                              <V2Button
                                onClick={() => {
                                  setEditingCommentId(group.key);
                                  setCommentDraft(material.content);
                                  setCommentTags(groupTags.join(", "));
                                  setCommentProjects(assignedProjects);
                                }}
                              >
                                Edit
                              </V2Button>
                            ) : null}
                          </div>
                          {editing ? (
                            <div className="v2-settings-section">
                              <label className="v2x-field">
                                Comment
                                <textarea
                                  value={commentDraft}
                                  onChange={(event) =>
                                    setCommentDraft(event.target.value)
                                  }
                                />
                              </label>
                              <fieldset className="v2x-choice-list">
                                <legend>Projects</legend>
                                {projects.map((project) => (
                                  <label key={project.name}>
                                    <input
                                      type="checkbox"
                                      checked={commentProjects.includes(
                                        project.name,
                                      )}
                                      onChange={(event) =>
                                        setCommentProjects(
                                          event.target.checked
                                            ? [...commentProjects, project.name]
                                            : commentProjects.filter(
                                                (name) => name !== project.name,
                                              ),
                                        )
                                      }
                                    />
                                    {project.name}
                                  </label>
                                ))}
                              </fieldset>
                              <label className="v2x-field">
                                Tags
                                <input
                                  value={commentTags}
                                  onChange={(event) =>
                                    setCommentTags(event.target.value)
                                  }
                                  placeholder="research, decision"
                                />
                              </label>
                              <div className="v2-recovery-card">
                                <p>{classificationReason}</p>
                              </div>
                              <div className="v2-inline-actions">
                                <V2Button
                                  disabled={commentSaving}
                                  onClick={() => setEditingCommentId(undefined)}
                                >
                                  Cancel
                                </V2Button>
                                <V2Button
                                  primary
                                  disabled={
                                    commentSaving || !commentDraft.trim()
                                  }
                                  onClick={() => {
                                    const selectedProjects = Array.from(
                                      new Set(commentProjects),
                                    );
                                    const tags = Array.from(
                                      new Set(
                                        commentTags
                                          .split(",")
                                          .map((tag) => tag.trim())
                                          .filter(Boolean),
                                      ),
                                    );
                                    const nextExcludedProjects =
                                      groupExcludedProjects.filter(
                                        (name) =>
                                          !selectedProjects.includes(name),
                                      );
                                    setCommentSaving(true);
                                    void updateGroup({
                                      ...(commentDraft.trim() !==
                                      material.content.trim()
                                        ? { content: commentDraft.trim() }
                                        : {}),
                                      projects: selectedProjects,
                                      excludedProjects: nextExcludedProjects,
                                      savedOnlyProjects: Array.from(
                                        new Set([
                                          ...groupSavedOnlyProjects,
                                          ...assignedProjects.filter(
                                            (name) =>
                                              !selectedProjects.includes(name),
                                          ),
                                        ]),
                                      ).filter(
                                        (name) =>
                                          !selectedProjects.includes(name) &&
                                          !nextExcludedProjects.includes(name),
                                      ),
                                      tags,
                                    })
                                      .then(() =>
                                        setEditingCommentId(undefined),
                                      )
                                      .finally(() => setCommentSaving(false));
                                  }}
                                >
                                  {commentSaving ? "Saving…" : "Save changes"}
                                </V2Button>
                              </div>
                            </div>
                          ) : (
                            <p>
                              {transcriptionPending
                                ? "Transcription pending…"
                                : material.content}
                            </p>
                          )}
                          {group.source ? (
                            <small className="v2x-comment-source">
                              On “{group.source.content}”
                            </small>
                          ) : null}
                          <div className="v2-library-meta">
                            {[
                              transcriptionPending
                                ? "Saved · Retry transcription"
                                : unlinked
                                  ? "Saved · Finish linking to this page"
                                : assignedProjects.length
                                  ? assignedProjects.join(", ")
                                  : "Saved only",
                              groupTags.length
                                ? groupTags.map((tag) => `#${tag}`).join(" ")
                                : "",
                              !editing ? classificationReason : "",
                              anchorStatusLabel(anchorStatus),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          {!editing &&
                          anchorMaterial &&
                          (anchorStatus === "anchored" ||
                            anchorStatus === "reanchored") ? (
                            <div className="v2-inline-actions">
                              <V2Button
                                onClick={() =>
                                  onLocatePageAnchor(anchorMaterial)
                                }
                              >
                                Locate on page
                              </V2Button>
                            </div>
                          ) : null}
                          {!editing &&
                          anchorMaterial &&
                          (anchorStatus === "page_changed" ||
                            anchorStatus === "snapshot_only") ? (
                            <div className="v2-inline-actions">
                              <V2Button
                                primary={anchorStatus === "page_changed"}
                                onClick={() =>
                                  onReanchorPageMaterial(anchorMaterial)
                                }
                              >
                                Use current selection
                              </V2Button>
                              {anchorStatus === "page_changed" ? (
                                <V2Button
                                  onClick={() =>
                                    onKeepSnapshotAnchor(anchorMaterial)
                                  }
                                >
                                  Keep snapshot
                                </V2Button>
                              ) : null}
                            </div>
                          ) : null}
                          {!editing &&
                            (unlinked ? (
                              <div className="v2-inline-actions">
                                {!transcriptionPending ? (
                                  <V2Button
                                    primary
                                    onClick={() =>
                                      onFinishUnlinkedVoiceComment(material)
                                    }
                                  >
                                    Finish comment
                                  </V2Button>
                                ) : null}
                                <V2Button
                                  onClick={() =>
                                    onDeleteUnlinkedVoiceComment(material)
                                  }
                                >
                                  Delete comment
                                </V2Button>
                              </div>
                            ) : activeProject ? (
                              <div className="v2-inline-actions">
                                {excluded ? (
                                  <V2Button
                                    onClick={() =>
                                      updateGroupQuietly({
                                        projects: assignedProjects.filter(
                                          (name) => name !== activeProject,
                                        ),
                                        excludedProjects:
                                          groupExcludedProjects.filter(
                                            (name) => name !== activeProject,
                                          ),
                                        savedOnlyProjects: Array.from(
                                          new Set([
                                            ...groupSavedOnlyProjects,
                                            activeProject,
                                          ]),
                                        ),
                                      })
                                    }
                                  >
                                    Undo exclusion
                                  </V2Button>
                                ) : included ? (
                                  <>
                                    <V2Button
                                      onClick={() =>
                                        updateGroupQuietly({
                                          projects: assignedProjects.filter(
                                            (name) => name !== activeProject,
                                          ),
                                          excludedProjects:
                                            groupExcludedProjects.filter(
                                              (name) => name !== activeProject,
                                            ),
                                          savedOnlyProjects: Array.from(
                                            new Set([
                                              ...groupSavedOnlyProjects,
                                              activeProject,
                                            ]),
                                          ),
                                        })
                                      }
                                    >
                                      Remove
                                    </V2Button>
                                    <V2Button
                                      onClick={() =>
                                        updateGroupQuietly({
                                          projects: assignedProjects.filter(
                                            (name) => name !== activeProject,
                                          ),
                                          excludedProjects: Array.from(
                                            new Set([
                                              ...groupExcludedProjects,
                                              activeProject,
                                            ]),
                                          ),
                                          savedOnlyProjects:
                                            groupSavedOnlyProjects.filter(
                                              (name) => name !== activeProject,
                                            ),
                                        })
                                      }
                                    >
                                      Exclude
                                    </V2Button>
                                  </>
                                ) : (
                                  <V2Button
                                    primary
                                    onClick={() =>
                                      updateGroupQuietly({
                                        projects: Array.from(
                                          new Set([
                                            ...assignedProjects,
                                            activeProject,
                                          ]),
                                        ),
                                        excludedProjects:
                                          groupExcludedProjects.filter(
                                            (name) => name !== activeProject,
                                          ),
                                        savedOnlyProjects:
                                          groupSavedOnlyProjects.filter(
                                            (name) => name !== activeProject,
                                          ),
                                      })
                                    }
                                  >
                                    Add to project
                                  </V2Button>
                                )}
                              </div>
                            ) : null)}
                        </article>
                      );
                    })}
                    {pageMaterialGroups.length === 0 ? (
                      <div className="v2-recovery-card">
                        <p>No comments on this page yet.</p>
                      </div>
                    ) : null}
                  </section>
                </>
              )}
              {generated && !generatedText && !voiceCandidate ? (
                <section className="v2-panel-section">
                  <div className="v2-panel-section-heading">
                    <h2>Draft with sources</h2>
                    <V2Button
                      icon
                      aria-label="Back to page"
                      onClick={onReturnToPage}
                    >
                      <ArrowLeft size={16} />
                    </V2Button>
                  </div>
                  <label className="v2x-field">
                    Skill
                    <select
                      value={skillId}
                      onChange={(event) => onSkillIdChange(event.target.value)}
                    >
                      {skills.map((skill) => (
                        <option key={skill.id} value={skill.id}>
                          {skill.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeProject ? (
                    <div className="v2x-sources">
                      <button
                        type="button"
                        onClick={() => setSourcesOpen((value) => !value)}
                      >
                        <span>Sources</span>
                        <span>
                          {generationSourceIds.length} selected{" "}
                          <ChevronDown size={12} />
                        </span>
                      </button>
                      {sourcesOpen
                        ? generationSources.map((source, index) => (
                            <label key={source.id}>
                              <input
                                type="checkbox"
                                checked={generationSourceIds.includes(
                                  source.id,
                                )}
                                onChange={(event) =>
                                  onGenerationSourceIdsChange(
                                    event.target.checked
                                      ? [...generationSourceIds, source.id]
                                      : generationSourceIds.filter(
                                          (id) => id !== source.id,
                                        ),
                                  )
                                }
                              />
                              <span>
                                <strong>
                                  {commandSourceLabel(source, index)}
                                </strong>
                                <small>{source.content}</small>
                              </span>
                              <button
                                type="button"
                                aria-label={
                                  pinnedSourceIds.includes(source.id)
                                    ? "Unpin source"
                                    : "Pin source"
                                }
                                onClick={() => onPinGenerationSource(source.id)}
                              >
                                <Pin
                                  size={13}
                                  fill={
                                    pinnedSourceIds.includes(source.id)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                            </label>
                          ))
                        : null}
                    </div>
                  ) : (
                    <div className="v2-recovery-card">
                      <p>
                        Choose a Project to draft from saved Sources, or
                        continue with this page.
                      </p>
                    </div>
                  )}
                </section>
              ) : null}
              {pendingInsert ? (
                <section className="v2-panel-section">
                  <div className="v2-recovery-card" role="status">
                    <p>
                      The original input is unavailable. Your text is saved in
                      Logue.
                    </p>
                    <div className="v2-inline-actions">
                      <V2Button onClick={onCopyPendingInsert}>Copy</V2Button>
                      {state.targetAvailable &&
                      state.source.url === pendingInsert.sourceURL ? (
                        <V2Button
                          primary
                          disabled={insertingPending}
                          onClick={onRetryInsert}
                        >
                          {insertingPending ? "Inserting…" : "Insert again"}
                        </V2Button>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
        {!serverSettingsOpen &&
        !voiceCandidate &&
        !generatedText &&
        error?.kind !== "service" ? (
          <footer className="v2-panel-footer">
            {phase === "recording" ? (
              <div className="v2-panel-composer">
                <span className="v2-recording-status">
                  <span />
                  Recording {elapsed}s
                </span>
                <span className="v2x-spacer" />
                <V2Button
                  primary
                  onClick={onStopRecording}
                  aria-keyshortcuts="Enter"
                >
                  <Square size={13} fill="currentColor" />
                  Accept
                </V2Button>
                <V2Button
                  onClick={onCancelRecording}
                  aria-keyshortcuts="Escape"
                >
                  Cancel
                </V2Button>
              </div>
            ) : presentation.captureActive ? (
              <div className="v2-panel-composer">
                <LoaderCircle size={16} className="v2x-spin" />
                <span>{presentation.status || "Preparing voice…"}</span>
                <span className="v2x-spacer" />
                <V2Button onClick={onCancelRecording}>Cancel</V2Button>
              </div>
            ) : (
              <>
                <div className="v2-panel-composer">
                  <textarea
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    placeholder={
                      generated
                        ? "What should Logue write?"
                        : state.selectionText
                          ? "Add a comment…"
                          : "Add a comment about this page…"
                    }
                    aria-label={generated ? "Draft instruction" : "Comment"}
                  />
                  <V2Button
                    icon
                    aria-label={
                      pendingVoiceQueueFull
                        ? "Saved recording storage is full"
                        : "Record"
                    }
                    disabled={pendingVoiceQueueFull}
                    onClick={onStartRecording}
                  >
                    <Mic size={17} />
                  </V2Button>
                  {generated ? (
                    <V2Button
                      icon
                      primary
                      aria-label="Generate"
                      disabled={!draft.trim() || !skillId || generating}
                      onClick={onGenerate}
                    >
                      {generating ? (
                        <LoaderCircle size={16} className="v2x-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </V2Button>
                  ) : (
                    <V2Button
                      icon
                      primary
                      aria-label="Save comment"
                      disabled={!draft.trim()}
                      onClick={onSave}
                    >
                      <Send size={16} />
                    </V2Button>
                  )}
                </div>
                <div className="v2-inline-actions v2x-footer-actions">
                  <button
                    className="v2x-profile"
                    aria-expanded={voiceProfilePickerOpen}
                    onClick={() =>
                      onVoiceProfilePickerOpenChange(!voiceProfilePickerOpen)
                    }
                  >
                    {voiceProfileContext?.resolved_voice_profile.label ||
                      "Default voice"}
                    <ChevronDown size={11} />
                  </button>
                  <span className="v2x-spacer" />
                  {!generated ? (
                    <V2Button onClick={onRequestGeneration}>
                      <Sparkles size={14} />
                      Ask or draft
                    </V2Button>
                  ) : null}
                </div>
                {voiceProfilePickerOpen ? (
                  <div className="v2x-profile-popover">
                    <VoiceProfilePicker
                      context={voiceProfileContext}
                      overrides={voiceProfileOverrides}
                      onChange={onVoiceProfileOverridesChange}
                      onClose={() => onVoiceProfilePickerOpenChange(false)}
                      embedded
                    />
                  </div>
                ) : null}
              </>
            )}
          </footer>
        ) : null}
        {error?.kind === "service" && !serverSettingsOpen ? (
          <footer className="v2-panel-footer">
            <div className="v2-inline-actions">
              <V2Button onClick={onRetryServer} disabled={serverConnecting}>
                {serverConnecting ? "Retrying…" : "Retry Host"}
              </V2Button>
              <V2Button onClick={onOpenServerSettings}>Change Host…</V2Button>
            </div>
          </footer>
        ) : null}
      </aside>
    </main>
  );
}
