import type { Material } from "@logue/ui";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  Filter,
  PanelRightClose,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  captureAudioURL,
  executeDeletion,
  getDeletionPreview,
  getMaterialRevisions,
  getTopics,
  retrySkillRun,
  setSkillRunPinned,
  restoreMaterialRevision,
  searchDocuments,
  searchMaterials,
  updateDocument,
  updateMaterial,
  updateMaterialMembership,
  type DocumentSearchMatch,
  type DiscoveredTopic,
  type LogueDocument,
  type DeletionPreview,
  type MaterialSearchMatch,
  type ProjectSummary,
  type SkillRun,
  type SourceRevision,
} from "../api";
import {
  groupLibraryMaterials,
  type LibraryMaterialGroup,
} from "../commentBundles";
import { adoptSkillRun, createAdoptionId, saveSkillRunAsDocument } from "../skillApi";
import { Button, IconButton } from "../components/ui";
import { RecordingAudioPlayer } from "../components/RecordingAudioPlayer";
import {
  OriginLabel,
  type OriginLabelType,
} from "../v2-mock/primitives/OriginLabel";
import { ProjectShell, type V2PrimaryRoute } from "../v2-mock/web/ProjectShell";
import { V2TopicsPanel } from "./V2TopicsPanel";
import { updateNavigationState } from "./navigationState";
import { ContentSummary, contentSummary } from "./contentPresentation";

type LibraryTab = "saved" | "activity" | "topics";
type OriginFilter = "all" | "web" | "you" | "ai";
type TimeFilter = "all" | "today" | "week" | "month" | "year";
type ContentTypeFilter =
  "all" | "comment" | "voice" | "selection" | "note" | "ai-source";
type AdoptedFilter = "all" | "adopted" | "not-adopted";

function sourceOrigin(material: Material): OriginLabelType {
  if (material.actor && material.actor.toLowerCase() !== "user") return "ai";
  if (material.kind === "selection") return "web";
  return "you";
}

function materialTitle(material: Material) {
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

function groupTitle(group: LibraryMaterialGroup) {
  return materialTitle(group.bundle?.source ?? group.representative);
}

function groupCopy(group: LibraryMaterialGroup) {
  return contentSummary(
    group.bundle?.primaryComment.content.trim() ||
    group.representative.content.trim(),
  );
}

function groupContentType(group: LibraryMaterialGroup): ContentTypeFilter {
  if (group.bundle) return "comment";
  const item = group.representative;
  if (sourceOrigin(item) === "ai") return "ai-source";
  if (item.kind === "voice" || item.captureId) return "voice";
  if (item.kind === "selection") return "selection";
  return "note";
}

function groupWasAdopted(group: LibraryMaterialGroup) {
  return group.items.some((item) => Boolean(item.adoptedRevisions?.length));
}

function timeFilterStart(filter: TimeFilter) {
  if (filter === "all") return 0;
  const current = new Date();
  if (filter === "today")
    return new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
    ).getTime();
  const days = filter === "week" ? 7 : filter === "month" ? 30 : 365;
  return current.getTime() - days * 24 * 60 * 60 * 1_000;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      new Date(value).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

function activityLabel(activityType: Material["activityType"]) {
  if (activityType === "voice-command") return "Voice Command";
  if (activityType === "text-command") return "Text Command";
  if (activityType === "ask") return "Ask";
  if (activityType === "compare") return "Compare";
  if (activityType === "draft") return "Draft";
  return "Activity";
}

function adoptionActionLabel(action?: string) {
  if (action === "copy") return "Copy";
  if (action === "insert") return "Insert";
  if (action === "replace") return "Replace";
  if (action === "keep") return "Keep";
  if (action === "document") return "Document";
  return "Adopted";
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

function matchLabel(match?: MaterialSearchMatch) {
  if (!match) return "";
  if (match.reason) return match.reason;
  if (match.match === "source") return "Matched the original page";
  if (match.match === "project") return "Matched a Project";
  if (match.match === "tag") return "Matched a tag";
  return "Matched saved content";
}

function documentMatchLabel(match?: DocumentSearchMatch) {
  if (!match) return "";
  return match.reason || `Matched Document ${match.match}`;
}

function downloadJSON(name: string, value: unknown) {
  const href = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
}

function SourceInspector({
  group,
  materials,
  projects,
  documents,
  onClose,
  onOpenSource,
  onRefresh,
  onReviewDelete,
  onReviewDeleteComment,
}: {
  group: LibraryMaterialGroup;
  materials: Material[];
  projects: ProjectSummary[];
  documents: LogueDocument[];
  onClose: () => void;
  onOpenSource: (id: string) => void;
  onRefresh: () => Promise<void>;
  onReviewDelete: () => void;
  onReviewDeleteComment: () => void;
}) {
  const primary = group.bundle?.primaryComment ?? group.representative;
  const evidence = group.bundle?.source;
  const anchorOwner = evidence?.source?.anchor
    ? evidence
    : primary.source?.anchor
      ? primary
      : undefined;
  const anchor = anchorOwner?.source?.anchor;
  const originalSource = evidence?.source?.url ? evidence : primary;
  const [project, setProject] = useState(group.projects[0] ?? "");
  const [documentId, setDocumentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAISource =
    primary.kind === "derived" &&
    (primary.actor ?? "user").toLowerCase() !== "user";
  const [sourceRevisions, setSourceRevisions] = useState<SourceRevision[]>([]);
  const [selectedSourceRevision, setSelectedSourceRevision] =
    useState<number>();
  const [openRevisionSourceId, setOpenRevisionSourceId] = useState<string>();
  const [editingSource, setEditingSource] = useState(false);
  const [sourceDraft, setSourceDraft] = useState(primary.content);
  useEffect(() => {
    setEditingSource(false);
    setSourceDraft(primary.content);
    setSelectedSourceRevision(undefined);
    setOpenRevisionSourceId(undefined);
    if (!isAISource) {
      setSourceRevisions([]);
      return;
    }
    void getMaterialRevisions(primary.id)
      .then(setSourceRevisions)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load Source history.",
        ),
      );
  }, [isAISource, primary.content, primary.id, primary.revision]);
  const previewRevision =
    selectedSourceRevision === undefined
      ? sourceRevisions.find((revision) => revision.current)
      : sourceRevisions.find(
          (revision) => revision.revision === selectedSourceRevision,
        );
  const displayedContent =
    previewRevision && !previewRevision.current
      ? previewRevision.content
      : primary.content;
  const revisionSources = previewRevision?.sources ?? [];
  const openRevisionSource = revisionSources.find(
    (source) => source.id === openRevisionSourceId,
  );
  const parentSources = (primary.parentIds ?? []).map((id) => ({
    id,
    source: materials.find((item) => item.id === id),
  }));
  const updateBundle = async (
    changes: Parameters<typeof updateMaterial>[1],
  ) => {
    setBusy(true);
    setError("");
    try {
      await Promise.all(
        group.items.map((item) => updateMaterial(item.id, changes)),
      );
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update this Source.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateMembership = async (
    mode: "add" | "remove" | "exclude" | "undo",
  ) => {
    if (!project) return;
    setBusy(true);
    setError("");
    try {
      await updateMaterialMembership(group.representative.id, {
        action: mode,
        project,
      });
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update this Source.",
      );
    } finally {
      setBusy(false);
    }
  };
  const addToDocument = async () => {
    const target = documents.find((item) => item.id === documentId);
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await updateDocument(target.id, {
        sourceIds: [
          ...new Set([
            ...target.source_ids,
            ...group.items.map((item) => item.id),
          ]),
        ],
        contextSourceIds: [
          ...new Set([
            ...(target.context_source_ids ?? []),
            ...group.items.map((item) => item.id),
          ]),
        ],
        expectedRevision: target.revision,
      });
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not add this Source to the Document.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveSourceEdit = async () => {
    if (!sourceDraft.trim() || sourceDraft.trim() === primary.content.trim()) {
      setEditingSource(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateMaterial(primary.id, { content: sourceDraft.trim() });
      await onRefresh();
      setEditingSource(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this Source revision.",
      );
    } finally {
      setBusy(false);
    }
  };
  const restoreSourceRevision = async () => {
    if (!previewRevision || previewRevision.current) return;
    setBusy(true);
    setError("");
    try {
      await restoreMaterialRevision(primary.id, previewRevision.revision);
      await onRefresh();
      setSelectedSourceRevision(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not restore this Source revision.",
      );
    } finally {
      setBusy(false);
    }
  };
  const excluded = Boolean(
    project &&
    group.items.some((item) => item.excludedProjects?.includes(project)),
  );
  const included = Boolean(
    project && group.items.some((item) => item.projects.includes(project)),
  );
  return (
    <>
      <header className="v2-inspector-header">
        <div>
          <OriginLabel
            origin={group.bundle ? "you" : sourceOrigin(primary)}
            detail={group.bundle ? "Comment bundle" : "Saved Source"}
          />
          <h2>{groupTitle(group)}</h2>
        </div>
        <IconButton label="Close source" variant="ghost" onClick={onClose}>
          <PanelRightClose size={17} />
        </IconButton>
      </header>
      <div className="v2-inspector-scroll">
        <article className="v2-source-bundle is-active">
          {group.bundle ? (
            <>
              <div className="v2-source-comment">
                <OriginLabel origin="you" detail="Your comment" />
                <p>{groupCopy(group)}</p>
              </div>
              <div className="v2-source-excerpt is-expanded">
                <OriginLabel origin="web" detail="Original evidence" />
                <p>{contentSummary(evidence?.content)}</p>
              </div>
            </>
          ) : (
            <>
              <OriginLabel
                origin={sourceOrigin(primary)}
                detail={
                  isAISource
                    ? `AI Source · Revision ${previewRevision?.revision ?? primary.revision ?? 1}`
                    : primary.kind === "voice"
                      ? "Voice input"
                      : "Saved content"
                }
              />
              <p>{displayedContent}</p>
            </>
          )}
          <div className="v2-source-meta">
            {shortDate(primary.createdAt)} ·{" "}
            {originalSource.source?.domain || "This Mac"}
          </div>
          <div className="v2-inline-actions">
            {originalSource.source?.url ? (
              <a
                className="v2-download-button"
                href={originalSource.source.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
                Open original
              </a>
            ) : null}
          </div>
        </article>
        {anchor ? (
          <section className="v2-settings-section">
            <h2>{anchorStatusLabel(anchor.status)}</h2>
            {anchor.status === "page_changed" ? (
              <p className="v2-settings-lead">
                The saved passage no longer matches this page. Open the original
                page, select the replacement passage, then use Re-anchor in the
                Side Panel.
              </p>
            ) : anchor.status === "snapshot_only" ? (
              <p className="v2-settings-lead">
                The original passage remains saved even without a live page
                anchor. Re-anchor it later from the Side Panel.
              </p>
            ) : (
              <p className="v2-settings-lead">
                The saved passage can be located on the original page from the
                Side Panel.
              </p>
            )}
            {anchor.status === "reanchored" &&
            anchor.quote &&
            anchor.quote !== anchorOwner?.content ? (
              <div className="v2-source-excerpt is-expanded">
                <OriginLabel
                  origin="web"
                  detail={`Current anchor · Revision ${anchor.revision}`}
                />
                <p>{anchor.quote}</p>
              </div>
            ) : null}
          </section>
        ) : null}
        {primary.captureId ? (
          <section className="v2-settings-section">
            <h2>Original audio</h2>
            <RecordingAudioPlayer
              src={captureAudioURL(primary.captureId)}
              label="Play original recording"
            />
          </section>
        ) : null}
        {isAISource ? (
          <section className="v2-settings-section">
            <div className="v2-inline-actions">
              <h2>Revision history</h2>
              <span style={{ marginLeft: "auto" }} />
              {!editingSource &&
              (!previewRevision || previewRevision.current) ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setSourceDraft(primary.content);
                    setEditingSource(true);
                  }}
                >
                  Edit
                </Button>
              ) : null}
            </div>
            {editingSource ? (
              <>
                <textarea
                  className="v2-textarea"
                  aria-label="AI Source content"
                  value={sourceDraft}
                  onChange={(event) => setSourceDraft(event.target.value)}
                />
                <div className="v2-inline-actions">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSource(false);
                      setSourceDraft(primary.content);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy || !sourceDraft.trim()}
                    onClick={() => void saveSourceEdit()}
                  >
                    Save new revision
                  </Button>
                </div>
              </>
            ) : (
              <>
                <select
                  className="v2-input"
                  aria-label="Source revision"
                  value={previewRevision?.revision ?? primary.revision ?? 1}
                  onChange={(event) => {
                    setSelectedSourceRevision(Number(event.target.value));
                    setOpenRevisionSourceId(undefined);
                  }}
                >
                  {sourceRevisions.map((revision) => (
                    <option key={revision.revision} value={revision.revision}>
                      Revision {revision.revision}
                      {revision.current ? " · Current" : ""}
                    </option>
                  ))}
                </select>
                {revisionSources.length ? (
                  <div className="v2-review-list">
                    {revisionSources.map((source) => (
                      <button
                        type="button"
                        className="v2-review-row"
                        key={source.id}
                        aria-pressed={openRevisionSourceId === source.id}
                        onClick={() =>
                          setOpenRevisionSourceId((current) =>
                            current === source.id ? undefined : source.id,
                          )
                        }
                      >
                        <div>
                          <OriginLabel
                            origin={
                              source.actor !== "user"
                                ? "ai"
                                : source.kind === "selection"
                                  ? "web"
                                  : "you"
                            }
                            detail="Frozen Source"
                          />
                          <strong>
                            {source.source?.title ||
                              source.source?.domain ||
                              (source.actor !== "user"
                                ? "AI Source"
                                : "Your input")}
                          </strong>
                          <p>{contentSummary(source.content)}</p>
                        </div>
                      </button>
                    ))}
                    {openRevisionSource ? (
                      <div className="v2-source-excerpt is-expanded">
                        <OriginLabel
                          origin={
                            openRevisionSource.actor !== "user"
                              ? "ai"
                              : openRevisionSource.kind === "selection"
                                ? "web"
                                : "you"
                          }
                          detail="Exact frozen evidence"
                        />
                        <p>{contentSummary(openRevisionSource.content)}</p>
                        {openRevisionSource.source?.url ? (
                          <a
                            className="v2-download-button"
                            href={openRevisionSource.source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                            Open original
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : previewRevision?.parent_ids?.length ? (
                  <div className="v2-review-list">
                    {previewRevision.parent_ids.map((id) => (
                      <div className="v2-review-row" key={id}>
                        <div>
                          <strong>Frozen Source ID</strong>
                          <p>{id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="v2-settings-lead">
                    No parent Sources were attached to this revision.
                  </p>
                )}
                {previewRevision && !previewRevision.current ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy}
                    onClick={() => void restoreSourceRevision()}
                  >
                    <RotateCcw size={14} />
                    Restore as new revision
                  </Button>
                ) : null}
              </>
            )}
          </section>
        ) : null}
        {primary.transcript ? (
          <section className="v2-settings-section">
            <h2>Voice history</h2>
            {primary.rawTranscript ? (
              <div className="v2-setting-row">
                <div>
                  <strong>Raw transcript</strong>
                  <p>{primary.rawTranscript}</p>
                </div>
              </div>
            ) : null}
            <div className="v2-setting-row">
              <div>
                <strong>Transformed transcript</strong>
                <p>{primary.transcript}</p>
              </div>
            </div>
            <div className="v2-setting-row">
              <div>
                <strong>Saved version</strong>
                <p>{contentSummary(primary.content)}</p>
              </div>
            </div>
            {primary.appliedContext ? (
              <>
                <div className="v2-setting-row">
                  <div>
                    <strong>Profile</strong>
                    <p>
                      {primary.appliedContext.voice_profile_label ||
                        "Default voice"}
                      {primary.appliedContext.project_profile_mode
                        ? ` · ${primary.appliedContext.project_profile_mode}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="v2-setting-row">
                  <div>
                    <strong>Transcription Skill</strong>
                    <p>
                      {primary.appliedContext.transcription_skill_name ||
                        primary.appliedContext.transcription_skill_id ||
                        "Default Transcription Skill"}
                      {primary.appliedContext.transcription_skill_revision
                        ? ` · Revision ${primary.appliedContext.transcription_skill_revision}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="v2-setting-row">
                  <div>
                    <strong>Language and vocabulary</strong>
                    <p>
                      {primary.appliedContext.language_override ||
                        primary.appliedContext.primary_language ||
                        "Automatic language"}
                      {primary.appliedContext.topic_vocabulary_name
                        ? ` · ${primary.appliedContext.topic_vocabulary_name}`
                        : " · No Topic Vocabulary"}
                    </p>
                  </div>
                </div>
                {primary.appliedContext.reference_project ? (
                  <div className="v2-setting-row">
                    <div>
                      <strong>Project used for transcription</strong>
                      <p>{primary.appliedContext.reference_project}</p>
                    </div>
                  </div>
                ) : null}
                {primary.appliedContext.custom_instructions ||
                primary.appliedContext.formatting_preference ||
                primary.appliedContext.phrases?.length ||
                primary.appliedContext.avoid_terms?.length ? (
                  <details className="v2-context-details">
                    <summary>Actual instructions used</summary>
                    {primary.appliedContext.custom_instructions ? (
                      <p>{primary.appliedContext.custom_instructions}</p>
                    ) : null}
                    {primary.appliedContext.formatting_preference ? (
                      <p>
                        Formatting:{" "}
                        {primary.appliedContext.formatting_preference}
                      </p>
                    ) : null}
                    {primary.appliedContext.phrases?.length ? (
                      <p>
                        Phrases: {primary.appliedContext.phrases.join(", ")}
                      </p>
                    ) : null}
                    {primary.appliedContext.avoid_terms?.length ? (
                      <p>
                        Avoid: {primary.appliedContext.avoid_terms.join(", ")}
                      </p>
                    ) : null}
                  </details>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}
        {primary.adoptedRevisions?.length ? (
          <section className="v2-settings-section">
            <h2>Adopted versions</h2>
            <div className="v2-review-list">
              {[...primary.adoptedRevisions]
                .sort((left, right) => right.revision - left.revision)
                .map((revision) => (
                  <article className="v2-review-row" key={revision.id}>
                    <div>
                      <OriginLabel
                        origin="ai"
                        detail={`${adoptionActionLabel(revision.action)} · Revision ${revision.revision}${revision.undone ? " · Undone" : ""}`}
                      />
                      <p>{contentSummary(revision.content)}</p>
                      <div className="v2-library-meta">
                        {shortDate(revision.created_at)}
                        {revision.target?.surface
                          ? ` · ${revision.target.surface}`
                          : ""}
                        {revision.target?.url
                          ? ` · ${new URL(revision.target.url).hostname}`
                          : ""}
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ) : null}
        <section className="v2-settings-section">
          <h2>Project Context</h2>
          <div className="v2-filter-row">
            <select
              className="v2-input"
              value={project}
              onChange={(event) => setProject(event.target.value)}
            >
              <option value="">Choose a Project</option>
              {projects.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            {project ? (
              excluded ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void updateMembership("undo")}
                >
                  Undo exclusion
                </Button>
              ) : included ? (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void updateMembership("remove")}
                  >
                    Remove
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void updateMembership("exclude")}
                  >
                    Exclude
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void updateMembership("add")}
                >
                  Add to Context
                </Button>
              )
            ) : null}
          </div>
          {primary.organization?.reason ? (
            <p className="v2-settings-lead">{primary.organization.reason}</p>
          ) : null}
        </section>
        <section className="v2-settings-section">
          <h2>Use in a Document</h2>
          <div className="v2-filter-row">
            <select
              className="v2-input"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              <option value="">Choose a Document</option>
              {documents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <Button
              disabled={!documentId || busy}
              onClick={() => void addToDocument()}
            >
              Add Source
            </Button>
          </div>
        </section>
        {parentSources.length ? (
          <section className="v2-settings-section">
            <h2>Lineage</h2>
            <p className="v2-settings-lead">
              Derived from {parentSources.length} frozen Source
              {parentSources.length === 1 ? "" : "s"}.
            </p>
            <div className="v2-review-list">
              {parentSources.map(({ id, source }) => (
                <button
                  type="button"
                  className="v2-review-row"
                  key={id}
                  disabled={!source}
                  onClick={() => source && onOpenSource(source.id)}
                >
                  <div>
                    <OriginLabel
                      origin={source ? sourceOrigin(source) : "web"}
                      detail="Frozen parent"
                    />
                    <strong>{source ? materialTitle(source) : id}</strong>
                    {source ? <p>{contentSummary(source.content)}</p> : null}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {error ? (
          <div className="v2-warning-bar" role="alert">
            {error}
          </div>
        ) : null}
        <section className="v2-settings-section">
          <div className="v2-inline-actions">
            {group.bundle ? (
              <Button size="sm" onClick={onReviewDeleteComment}>
                <Trash2 size={14} />
                Delete comment
              </Button>
            ) : null}
            <Button size="sm" onClick={onReviewDelete}>
              <Trash2 size={14} />
              {group.bundle ? "Delete bundle" : "Review deletion"}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

export function RunInspector({
  run,
  documents = [],
  onClose,
  onRefresh,
}: {
  run: SkillRun;
  documents?: LogueDocument[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(
    run.adopted_output || run.original_output || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deletePreview, setDeletePreview] = useState<DeletionPreview>();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [documentTargetOpen, setDocumentTargetOpen] = useState(false);
  const [documentAdoption, setDocumentAdoption] = useState<{ id: string; documentId: string; documentRevision: number }>();
  const [keepAdoptionId, setKeepAdoptionId] = useState<string>();
  const adoptionAttempts = useRef<Partial<Record<"copy" | "keep" | "document", { id: string; content: string; targetKey?: string }>>>({});
  const projectDocuments = documents.filter((document) => document.project === run.project);
  const adopted = run.adoption_revisions?.length
    ? run.adoption_revisions.some((revision) => !revision.undone)
    : Boolean((run.adopted_output || run.document_id || run.material_id) && !run.adoption_undone);
  const modelContext = run.model_context;
  const copy = async () => {
    setBusy(true);
    setError("");
    const previousAttempt = adoptionAttempts.current.copy;
    const adoptionId = previousAttempt?.content === draft ? previousAttempt.id : createAdoptionId();
    adoptionAttempts.current.copy = { id: adoptionId, content: draft };
    try {
      await navigator.clipboard.writeText(draft);
      await adoptSkillRun(run.id, draft, {
        action: "copy",
        adoptionId,
        target: { surface: "clipboard", target_key: `activity:${run.id}` },
      });
      await onRefresh();
      delete adoptionAttempts.current.copy;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not copy this result.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveDocument = async (targetDocument?: LogueDocument) => {
    setBusy(true);
    setError("");
    const targetKey = targetDocument?.id ?? "new";
    const previousAttempt = adoptionAttempts.current.document;
    const adoptionId = previousAttempt?.content === draft && previousAttempt.targetKey === targetKey ? previousAttempt.id : createAdoptionId();
    adoptionAttempts.current.document = { id: adoptionId, content: draft, targetKey };
    try {
      const frozenSources = run.sources.map((source) => ({
        id: source.id,
        kind: source.kind,
        actor: source.actor,
        content: source.content,
        projects: source.projects ?? [],
        tags: source.tags ?? [],
        created_at: source.created_at ?? "",
        source: source.source ?? null,
      }));
      const sourceIds = frozenSources.map((source) => source.id);
      const result = await saveSkillRunAsDocument(run.id, {
        title: targetDocument?.title ?? run.skill_name,
        content: draft,
        documentId: targetDocument?.id,
        project: run.project,
        sourceIds,
        contextSourceIds: sourceIds,
        sources: frozenSources,
        contextSources: frozenSources,
        expectedRevision: targetDocument?.revision,
        adoptionId,
        adoptionAction: targetDocument ? "replace" : "document",
        target: { surface: "activity-inspector", target_key: targetDocument ? `document:${targetDocument.id}` : `activity:${run.id}:new-document` },
      });
      await onRefresh();
      delete adoptionAttempts.current.document;
      setDocumentTargetOpen(false);
      setDocumentAdoption(targetDocument ? { id: adoptionId, documentId: result.document.id, documentRevision: result.document.revision } : undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create a Document.",
      );
    } finally {
      setBusy(false);
    }
  };
  const keep = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError("");
    const previousAttempt = adoptionAttempts.current.keep;
    const adoptionId = previousAttempt?.content === draft ? previousAttempt.id : createAdoptionId();
    adoptionAttempts.current.keep = { id: adoptionId, content: draft };
    try {
      await adoptSkillRun(run.id, draft, {
        action: "keep",
        adoptionId,
        target: { surface: "activity-inspector", target_key: `activity:${run.id}:kept-source` },
      });
      await onRefresh();
      delete adoptionAttempts.current.keep;
      setKeepAdoptionId(adoptionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not keep this result in Logue.");
    } finally {
      setBusy(false);
    }
  };
  const undoKeep = async () => {
    if (!keepAdoptionId || busy) return;
    setBusy(true);
    setError("");
    try {
      await adoptSkillRun(run.id, draft, {
        action: "undo",
        adoptionId: keepAdoptionId,
        target: { surface: "activity-inspector", target_key: `activity:${run.id}:kept-source` },
      });
      await onRefresh();
      setKeepAdoptionId(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not undo Keep in Logue.");
    } finally {
      setBusy(false);
    }
  };
  const undoDocumentUpdate = async () => {
    if (!documentAdoption || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveSkillRunAsDocument(run.id, {
        title: run.skill_name,
        content: draft,
        documentId: documentAdoption.documentId,
        expectedRevision: documentAdoption.documentRevision,
        adoptionId: documentAdoption.id,
        adoptionAction: "undo",
        target: { surface: "activity-inspector", target_key: `document:${documentAdoption.documentId}` },
      });
      await onRefresh();
      setDocumentAdoption(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not undo this Document update.");
    } finally {
      setBusy(false);
    }
  };
  const retry = async () => {
    setBusy(true);
    setError("");
    try {
      await retrySkillRun(run);
      await onRefresh();
      onClose();
    } catch (cause) {
      await onRefresh();
      setError(
        cause instanceof Error ? cause.message : "Could not retry this Run.",
      );
    } finally {
      setBusy(false);
    }
  };
  const togglePin = async () => {
    setBusy(true);
    setError("");
    try {
      await setSkillRunPinned(run.id, !run.pinned);
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this Run.",
      );
    } finally {
      setBusy(false);
    }
  };
  const reviewRemoval = async () => {
    setBusy(true);
    setError("");
    try {
      setDeletePreview(
        await getDeletionPreview({ scope: "run", ids: [run.id] }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not review this Run.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !deletePreview ||
      (deletePreview.requires_lineage && deleteConfirm !== "DELETE")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const outcome = await executeDeletion(
        { scope: "run", ids: [run.id] },
        deletePreview,
      );
      if (outcome.preview) {
        setDeletePreview(outcome.preview);
        setError("Dependencies changed. Review the updated summary, then delete again.");
        return;
      }
      await onRefresh();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete this Run.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <header className="v2-inspector-header">
        <div>
          <OriginLabel
            origin="ai"
            detail={`${run.skill_name} · ${run.status}`}
          />
          <h2>Run</h2>
        </div>
        <IconButton label="Close Run" variant="ghost" onClick={onClose}>
          <PanelRightClose size={17} />
        </IconButton>
      </header>
      <div className="v2-inspector-scroll">
        <article className="v2-source-bundle is-active">
          <OriginLabel
            origin="you"
            detail={
              run.project ? `${run.project} activity` : "Private activity"
            }
          />
          <h3>{run.instruction || "Deleted Run"}</h3>
          <div className="v2-source-meta">
            {shortDate(run.created_at)} · Skill revision {run.skill_revision} ·{" "}
            {run.sources.length} frozen Sources{run.pinned ? " · pinned" : ""}
            {run.retry_run_id ? " · retry" : ""}
          </div>
        </article>
        {run.error ? (
          <div className="v2-warning-bar" role="alert">
            {run.error}
          </div>
        ) : null}
        {draft ? (
          <section className="v2-settings-section">
            <h2>{adopted ? "Adopted result" : "Recover candidate"}</h2>
            <textarea
              className="v2-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="v2-inline-actions">
              <Button
                disabled={busy || !draft.trim()}
                onClick={() => void copy()}
              >
                <Copy size={14} />
                Copy
              </Button>
              <Button disabled={busy || (!keepAdoptionId && !draft.trim())} onClick={() => void (keepAdoptionId ? undoKeep() : keep())}>
                {keepAdoptionId ? <RotateCcw size={14} /> : <Check size={14} />}
                {keepAdoptionId ? "Undo Keep in Logue" : "Keep in Logue"}
              </Button>
              {documentAdoption ? (
                <Button variant="primary" disabled={busy} onClick={() => void undoDocumentUpdate()}>
                  <RotateCcw size={14} />
                  Undo Document update
                </Button>
              ) : <div className="v2-action-menu-wrap">
                <Button variant="primary" disabled={busy || !draft.trim()} aria-expanded={documentTargetOpen} onClick={() => setDocumentTargetOpen((open) => !open)}>
                  <FilePlus2 size={14} />
                  Save as Document…
                </Button>
                {documentTargetOpen ? (
                  <div className="v2-skill-picker" role="menu" aria-label="Choose Document target">
                    <div className="v2-skill-picker-scroll">
                      <div className="v2-skill-picker-group">
                        <div className="v2-skill-picker-label">Create</div>
                        <button type="button" role="menuitem" onClick={() => void saveDocument()}><span>New Document</span><small>Start with this recovered Candidate</small></button>
                      </div>
                      {projectDocuments.length ? <div className="v2-skill-picker-group">
                        <div className="v2-skill-picker-label">Update existing</div>
                        {projectDocuments.map((document) => <button key={document.id} type="button" role="menuitem" onClick={() => void saveDocument(document)}><span>{document.title}</span><small>Replace as revision {document.revision + 1}</small></button>)}
                      </div> : null}
                    </div>
                  </div>
                ) : null}
              </div>}
            </div>
          </section>
        ) : null}
        {run.adoption_revisions?.length ? (
          <section className="v2-settings-section">
            <h2>Adoption history</h2>
            <div className="v2-review-list">
              {[...run.adoption_revisions]
                .sort((left, right) => right.revision - left.revision)
                .map((revision) => (
                  <article className="v2-review-row" key={revision.id}>
                    <div>
                      <OriginLabel
                        origin="ai"
                        detail={`${adoptionActionLabel(revision.action)} · Revision ${revision.revision}${revision.undone ? " · Undone" : ""}`}
                      />
                      <ContentSummary value={revision.content} />
                      <div className="v2-library-meta">
                        {revision.created_at ? shortDate(revision.created_at) : "Saved"}
                        {revision.document_revision ? ` · Document revision ${revision.document_revision}` : ""}
                        {revision.target?.surface ? ` · ${revision.target.surface}` : ""}
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ) : null}
        <section className="v2-settings-section">
          <h2>Context sent</h2>
          <article className="v2-context-card">
            <OriginLabel origin="you" detail="Instruction" />
            <p>{modelContext?.instruction || run.instruction}</p>
          </article>
          <article className="v2-context-card">
            <OriginLabel origin="ai" detail={`Skill revision ${modelContext?.skill.revision ?? run.skill_revision}`} />
            <strong>{modelContext?.skill.name || run.skill_name}</strong>
            {modelContext?.skill.instructions ? (
              <p>{modelContext.skill.instructions}</p>
            ) : null}
          </article>
          {modelContext?.project.overview ? (
            <article className="v2-context-card">
              <OriginLabel origin="you" detail={modelContext.project.name || "Project context"} />
              <p>{modelContext.project.overview}</p>
            </article>
          ) : null}
          {modelContext?.personal_context ? (
            <article className="v2-context-card">
              <OriginLabel origin="you" detail="Personal context" />
              <p>{modelContext.personal_context}</p>
            </article>
          ) : null}
          {modelContext?.selection || modelContext?.target_text ? (
            <article className="v2-context-card">
              <OriginLabel origin="web" detail="Page context" />
              <p>{modelContext.selection || modelContext.target_text}</p>
            </article>
          ) : null}
        </section>
        <section className="v2-settings-section">
          <h2>Sources used</h2>
          {run.sources.map((source, index) => (
            <article className="v2-context-card" key={source.id}>
              <OriginLabel
                origin={
                  source.actor === "user"
                    ? "you"
                    : source.kind === "selection"
                      ? "web"
                      : "ai"
                }
                detail={`Frozen Source ${index + 1}`}
              />
              <strong>
                {source.source?.title ||
                  source.source?.domain ||
                  "Saved Source"}
              </strong>
              {source.content ? <p>{contentSummary(source.content)}</p> : null}
              {source.source?.url ? (
                <a
                  className="v2-source-excerpt-toggle"
                  href={source.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original
                </a>
              ) : null}
            </article>
          ))}
        </section>
        {!run.tombstone ? (
          <div className="v2-inline-actions">
            <Button disabled={busy} onClick={() => void togglePin()}>
              {run.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              {run.pinned ? "Unpin" : "Pin"}
            </Button>
            {run.status === "failed" ||
            (!adopted && Boolean(run.original_output)) ? (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void retry()}
              >
                <RotateCcw size={14} />
                Retry
              </Button>
            ) : null}
            <Button disabled={busy} onClick={() => void reviewRemoval()}>
              <Trash2 size={14} />
              Review deletion
            </Button>
          </div>
        ) : (
          <div className="v2-recovery-card">
            Run details were deleted. Minimal lineage remains for an adopted
            result.
          </div>
        )}
        {deletePreview ? (
          <div className="v2-danger-card">
            <p>
              {adopted
                ? "This Run has an adopted result. Its prompt, output, and frozen Source text will be deleted; a minimal lineage marker remains."
                : deletePreview.requires_lineage
                  ? "A later result depends on this Run. Its details will be deleted; a minimal lineage marker remains."
                  : "This Run has no adopted result. Its Activity details will be removed from this Host."}
            </p>
            {deletePreview.requires_lineage ? (
              <label>
                Type DELETE to continue
                <input
                  className="v2-input"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                />
              </label>
            ) : null}
            <div className="v2-inline-actions">
              <Button
                onClick={() => {
                  setDeletePreview(undefined);
                  setDeleteConfirm("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={
                  busy ||
                  (deletePreview.requires_lineage && deleteConfirm !== "DELETE")
                }
                onClick={() => void remove()}
              >
                Delete Run details
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="v2-warning-bar" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </>
  );
}

function ActivityInspector({
  item,
  run,
  onClose,
  onOpenRun,
  onReviewDelete,
}: {
  item: Material;
  run?: SkillRun;
  onClose: () => void;
  onOpenRun: () => void;
  onReviewDelete: () => void;
}) {
  return (
    <>
      <header className="v2-inspector-header">
        <div>
          <OriginLabel
            origin="you"
            detail={activityLabel(item.activityType)}
          />
          <h2>Activity</h2>
        </div>
        <IconButton label="Close Activity" variant="ghost" onClick={onClose}>
          <PanelRightClose size={17} />
        </IconButton>
      </header>
      <div className="v2-inspector-scroll">
        <article className="v2-source-bundle is-active">
          <h3>{materialTitle(item)}</h3>
          <p>{contentSummary(item.content)}</p>
          <div className="v2-source-meta">
            {shortDate(item.createdAt)} · Private Activity · never Project
            Context
          </div>
        </article>
        {item.captureId ? (
          <section className="v2-settings-section">
            <h2>Original audio</h2>
            <RecordingAudioPlayer
              src={captureAudioURL(item.captureId)}
              label="Play original voice command"
            />
          </section>
        ) : null}
        {item.transcript ? (
          <section className="v2-settings-section">
            <h2>Voice history</h2>
            {item.rawTranscript ? (
              <div className="v2-setting-row">
                <div>
                  <strong>Raw transcript</strong>
                  <p>{item.rawTranscript}</p>
                </div>
              </div>
            ) : null}
            <div className="v2-setting-row">
              <div>
                <strong>Transformed transcript</strong>
                <p>{item.transcript}</p>
              </div>
            </div>
            <div className="v2-setting-row">
              <div>
                <strong>Saved activity</strong>
                <p>{contentSummary(item.content)}</p>
              </div>
            </div>
          </section>
        ) : null}
        <div className="v2-inline-actions">
          {run ? (
            <Button variant="primary" onClick={onOpenRun}>
              Open generated Run
            </Button>
          ) : null}
          <Button onClick={onReviewDelete}>
            <Trash2 size={14} />
            Review deletion
          </Button>
        </div>
      </div>
    </>
  );
}

export function V2LibraryRoute({
  materials,
  runs,
  projects,
  documents,
  loading,
  onRoute,
  onRefresh,
}: {
  materials: Material[];
  runs: SkillRun[];
  projects: ProjectSummary[];
  documents: LogueDocument[];
  loading: boolean;
  onRoute: (route: V2PrimaryRoute) => void;
  onRefresh: () => Promise<void>;
}) {
  const initialQuery =
    new URLSearchParams(window.location.search).get("q") ?? "";
  const [tab, setTab] = useState<LibraryTab>("saved");
  const [query, setQuery] = useState(initialQuery);
  const [matches, setMatches] = useState<MaterialSearchMatch[]>([]);
  const [documentMatches, setDocumentMatches] = useState<DocumentSearchMatch[]>(
    [],
  );
  const [strategy, setStrategy] = useState<"semantic" | "local">("local");
  const [searching, setSearching] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [siteFilter, setSiteFilter] = useState("");
  const [contentTypeFilter, setContentTypeFilter] =
    useState<ContentTypeFilter>("all");
  const [adoptedFilter, setAdoptedFilter] = useState<AdoptedFilter>("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [topics, setTopics] = useState<DiscoveredTopic[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkProject, setBulkProject] = useState("");
  const [openKey, setOpenKey] = useState<string>();
  const [openRunId, setOpenRunId] = useState<string>();
  const [openActivityId, setOpenActivityId] = useState<string>();
  const [deleteGroups, setDeleteGroups] = useState<LibraryMaterialGroup[]>([]);
  const [sourceDeletePreview, setSourceDeletePreview] =
    useState<DeletionPreview>();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getTopics()
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    url.searchParams.delete("find");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    if (!query.trim()) {
      setMatches([]);
      setDocumentMatches([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError("");
      void Promise.all([
        searchMaterials(query.trim(), controller.signal),
        searchDocuments(query.trim(), controller.signal),
      ])
        .then(([materialResult, documentResult]) => {
          setMatches(materialResult.matches);
          setDocumentMatches(documentResult.matches);
          setStrategy(
            materialResult.strategy === "semantic" ||
              documentResult.strategy === "semantic"
              ? "semantic"
              : "local",
          );
        })
        .catch((cause) => {
          if ((cause as Error).name !== "AbortError")
            setError(cause instanceof Error ? cause.message : "Search failed.");
        })
        .finally(() => setSearching(false));
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const savedMaterials = materials.filter(
    (item) => !item.activityType && !item.tombstone,
  );
  const matchById = useMemo(
    () => new Map(matches.map((match) => [match.id, match])),
    [matches],
  );
  const candidates = query.trim()
    ? savedMaterials.filter((item) => matchById.has(item.id))
    : savedMaterials;
  const sites = useMemo(
    () =>
      [...new Set(savedMaterials.flatMap((item) => item.source?.domain ?? []))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [savedMaterials],
  );
  const selectedTopic = topics.find((topic) => topic.id === topicFilter);
  const activeFilterCount = [
    projectFilter,
    topicFilter,
    originFilter !== "all",
    timeFilter !== "all",
    siteFilter,
    contentTypeFilter !== "all",
    adoptedFilter !== "all",
    reviewOnly,
  ].filter(Boolean).length;
  const groups = useMemo(
    () =>
      groupLibraryMaterials(candidates, savedMaterials).filter((group) => {
        const item = group.bundle?.primaryComment ?? group.representative;
        if (
          projectFilter &&
          !group.items.some((entry) => entry.projects.includes(projectFilter))
        )
          return false;
        if (
          originFilter !== "all" &&
          sourceOrigin(item) !== originFilter &&
          !(group.bundle && originFilter === "web")
        )
          return false;
        if (
          selectedTopic &&
          !group.items.some((entry) =>
            selectedTopic.source_ids.includes(entry.id),
          )
        )
          return false;
        if (
          timeFilter !== "all" &&
          !group.items.some(
            (entry) =>
              new Date(entry.createdAt).getTime() >=
              timeFilterStart(timeFilter),
          )
        )
          return false;
        if (
          siteFilter &&
          !group.items.some((entry) => entry.source?.domain === siteFilter)
        )
          return false;
        if (
          contentTypeFilter !== "all" &&
          groupContentType(group) !== contentTypeFilter
        )
          return false;
        const adopted = groupWasAdopted(group);
        if (adoptedFilter === "adopted" && !adopted) return false;
        if (adoptedFilter === "not-adopted" && adopted) return false;
        if (reviewOnly && !group.needsReview) return false;
        return true;
      }),
    [
      adoptedFilter,
      candidates,
      contentTypeFilter,
      originFilter,
      projectFilter,
      reviewOnly,
      savedMaterials,
      selectedTopic,
      siteFilter,
      timeFilter,
    ],
  );
  const visibleDocumentMatches = useMemo(
    () =>
      documentMatches.filter((match) => {
        const item = documents.find((document) => document.id === match.id);
        if (!item) return false;
        if (projectFilter && item.project !== projectFilter) return false;
        if (originFilter !== "all" && originFilter !== "ai") return false;
        if (contentTypeFilter !== "all") return false;
        if (adoptedFilter !== "all") return false;
        if (
          timeFilter !== "all" &&
          new Date(item.updated_at).getTime() < timeFilterStart(timeFilter)
        )
          return false;
        if (
          selectedTopic &&
          !item.source_ids.some((id) => selectedTopic.source_ids.includes(id))
        )
          return false;
        if (
          siteFilter &&
          !item.source_ids.some(
            (id) =>
              savedMaterials.find((material) => material.id === id)?.source
                ?.domain === siteFilter,
          )
        )
          return false;
        return true;
      }),
    [
      adoptedFilter,
      contentTypeFilter,
      documentMatches,
      documents,
      originFilter,
      projectFilter,
      savedMaterials,
      selectedTopic,
      siteFilter,
      timeFilter,
    ],
  );
  const openGroup =
    groups.find((group) => group.key === openKey) ??
    deleteGroups.find((group) => group.key === openKey);
  const openRun = runs.find((run) => run.id === openRunId);
  const openActivity = materials.find(
    (item) => item.id === openActivityId && item.activityType,
  );
  const activityRun = runs.find(
    (item) => item.activity_source_id === openActivityId,
  );
  const selectedGroups = groups.filter((group) =>
    selectedKeys.includes(group.key),
  );

  async function applyMembership(mode: "add" | "exclude") {
    if (!bulkProject || !selectedGroups.length) return;
    setBusy(true);
    setError("");
    try {
      await Promise.all(
        selectedGroups.map((group) =>
          updateMaterialMembership(group.representative.id, {
            action: mode,
            project: bulkProject,
          }),
        ),
      );
      await onRefresh();
      setSelectedKeys([]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the selected Sources.",
      );
    } finally {
      setBusy(false);
    }
  }

  function draftWithSelectedSources() {
    if (!bulkProject || !selectedGroups.length) return;
    const sourceIds = [
      ...new Set(
        selectedGroups.flatMap((group) => group.items.map((item) => item.id)),
      ),
    ];
    updateNavigationState((current) => ({
      ...current,
      project: {
        ...current.project,
        name: bulkProject,
        mode: "draft",
        view: "workspace",
      },
      draftHandoff: { projectName: bulkProject, sourceIds },
    }));
    onRoute("projects");
  }

  async function reviewDeletion(targets: LibraryMaterialGroup[]) {
    setDeleteGroups(targets);
    setSourceDeletePreview(undefined);
    setDeleteConfirm("");
    setError("");
    const ids = targets.flatMap((group) => group.items.map((item) => item.id));
    try {
      setSourceDeletePreview(
        await getDeletionPreview({ scope: "source", ids }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not inspect deletion dependencies.",
      );
    }
  }

  async function confirmDeletion() {
    if (deleteConfirm !== "DELETE" || !sourceDeletePreview) return;
    setBusy(true);
    setError("");
    try {
      const ids = deleteGroups.flatMap((group) =>
        group.items.map((item) => item.id),
      );
      const outcome = await executeDeletion(
        { scope: "source", ids },
        sourceDeletePreview,
      );
      if (outcome.preview) {
        setSourceDeletePreview(outcome.preview);
        setError("Dependencies changed. Review the updated summary, then delete again.");
        return;
      }
      await onRefresh();
      setDeleteGroups([]);
      setSourceDeletePreview(undefined);
      setSelectedKeys([]);
      setOpenKey(undefined);
      setOpenActivityId(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not delete the selected Sources.",
      );
    } finally {
      setBusy(false);
    }
  }

  const dependencyTotals = sourceDeletePreview?.summary;
  const inspector = deleteGroups.length ? (
    <>
      <header className="v2-inspector-header">
        <div>
          <OriginLabel origin="you" detail="Local data" />
          <h2>Review deletion</h2>
        </div>
        <IconButton
          label="Close deletion review"
          variant="ghost"
          onClick={() => {
            setDeleteGroups([]);
            setSourceDeletePreview(undefined);
          }}
        >
          <X size={17} />
        </IconButton>
      </header>
      <div className="v2-inspector-scroll">
        <div className="v2-danger-card">
          <p>
            Delete {deleteGroups.length} selected item
            {deleteGroups.length === 1 ? "" : "s"} from this Host. Existing text
            already inserted into other apps is unchanged.
          </p>
          <div className="v2-review-list">
            <div className="v2-review-row">
              <div>
                <strong>{dependencyTotals?.projects ?? 0} Project links</strong>
                <p>Removed with the Source.</p>
              </div>
            </div>
            <div className="v2-review-row">
              <div>
                <strong>
                  {dependencyTotals?.documents ?? 0} Documents ·{" "}
                  {dependencyTotals?.citations ?? 0} revision citations ·{" "}
                  {dependencyTotals?.derived ?? 0} derived items ·{" "}
                  {dependencyTotals?.runs ?? 0} Runs
                </strong>
                <p>
                  Referenced Sources keep only a minimal lineage marker after
                  their private content and audio are deleted.
                </p>
              </div>
            </div>
          </div>
          <label>
            Type DELETE to continue
            <input
              className="v2-input"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
            />
          </label>
          <div className="v2-inline-actions">
            <Button
              onClick={() => {
                setDeleteGroups([]);
                setSourceDeletePreview(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                busy || !sourceDeletePreview || deleteConfirm !== "DELETE"
              }
              onClick={() => void confirmDeletion()}
            >
              Delete from this Host
            </Button>
          </div>
        </div>
        {error ? <div className="v2-warning-bar">{error}</div> : null}
      </div>
    </>
  ) : openRun ? (
    <RunInspector
      run={openRun}
      documents={documents}
      onClose={() => setOpenRunId(undefined)}
      onRefresh={onRefresh}
    />
  ) : openActivity ? (
    <ActivityInspector
      item={openActivity}
      run={activityRun}
      onClose={() => setOpenActivityId(undefined)}
      onOpenRun={() => {
        if (activityRun) {
          setOpenActivityId(undefined);
          setOpenRunId(activityRun.id);
        }
      }}
      onReviewDelete={() =>
        void reviewDeletion([
          {
            key: `activity:${openActivity.id}`,
            items: [openActivity],
            representative: openActivity,
            projects: [],
            needsReview: false,
          },
        ])
      }
    />
  ) : openGroup ? (
    <SourceInspector
      group={openGroup}
      materials={materials}
      projects={projects}
      documents={documents}
      onClose={() => setOpenKey(undefined)}
      onOpenSource={(id) => {
        const target = groupLibraryMaterials(
          materials.filter((item) => item.id === id),
          materials,
        )[0];
        if (target) setOpenKey(target.key);
      }}
      onRefresh={onRefresh}
      onReviewDelete={() => void reviewDeletion([openGroup])}
      onReviewDeleteComment={() => {
        const comment = openGroup.bundle?.primaryComment;
        if (comment)
          void reviewDeletion([
            {
              key: `comment:${comment.id}`,
              items: [comment],
              representative: comment,
              projects: comment.projects,
              needsReview: comment.organization?.status === "needs_review",
            },
          ]);
      }}
    />
  ) : undefined;

  return (
    <ProjectShell
      route="library"
      onRouteChange={onRoute}
      inspectorOpen={Boolean(inspector)}
      onInspectorOpenChange={(open) => {
        if (!open) {
          setOpenKey(undefined);
          setOpenRunId(undefined);
          setOpenActivityId(undefined);
          setDeleteGroups([]);
        }
      }}
      inspector={inspector}
    >
      <div className="v2-editor-scroll">
        <div className="v2-list-axis">
          <div className="v2-page-heading">
            <div className="v2-page-heading-copy">
              <h1>{query.trim() ? "Find" : "Library"}</h1>
              <p>
                {query.trim()
                  ? `${searching ? "Searching" : `${groups.length + visibleDocumentMatches.length} results`} · ${strategy === "semantic" ? "meaning and exact words" : "exact words"}`
                  : "Everything you capture stays private on this Host until you delete it."}
              </p>
            </div>
          </div>
          <label className="v2-search-field v2-global-find">
            <Search size={17} />
            <span className="sr-only">Find saved content</span>
            <input
              autoFocus={new URLSearchParams(window.location.search).has(
                "find",
              )}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find something you said, read, or created"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={15} />
              </button>
            ) : null}
          </label>
          <div
            className="v2-segmented"
            role="tablist"
            aria-label="Library content"
          >
            <button
              role="tab"
              aria-selected={tab === "saved"}
              className={tab === "saved" ? "is-active" : ""}
              onClick={() => setTab("saved")}
            >
              Saved content
            </button>
            <button
              role="tab"
              aria-selected={tab === "activity"}
              className={tab === "activity" ? "is-active" : ""}
              onClick={() => setTab("activity")}
            >
              All activity
            </button>
            <button
              role="tab"
              aria-selected={tab === "topics"}
              className={tab === "topics" ? "is-active" : ""}
              onClick={() => setTab("topics")}
            >
              Topics
            </button>
          </div>
          {tab === "saved" ? (
            <>
              <div className="v2-filter-row">
                <Button
                  size="sm"
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <Filter size={14} />
                  {activeFilterCount
                    ? `Filters · ${activeFilterCount}`
                    : "Filter"}
                </Button>
                {activeFilterCount ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setProjectFilter("");
                      setTopicFilter("");
                      setOriginFilter("all");
                      setTimeFilter("all");
                      setSiteFilter("");
                      setContentTypeFilter("all");
                      setAdoptedFilter("all");
                      setReviewOnly(false);
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              {filterOpen ? (
                <div
                  className="v2-library-filters"
                  aria-label="Library filters"
                >
                  <label>
                    Project
                    <select
                      className="v2-input"
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                    >
                      <option value="">Every Project</option>
                      {projects.map((project) => (
                        <option key={project.name} value={project.name}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Topic
                    <select
                      className="v2-input"
                      value={topicFilter}
                      onChange={(event) => setTopicFilter(event.target.value)}
                    >
                      <option value="">Every Topic</option>
                      {topics
                        .filter((topic) => !topic.hidden)
                        .map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Origin
                    <select
                      className="v2-input"
                      value={originFilter}
                      onChange={(event) =>
                        setOriginFilter(event.target.value as OriginFilter)
                      }
                    >
                      <option value="all">Every origin</option>
                      <option value="web">Web</option>
                      <option value="you">You</option>
                      <option value="ai">AI</option>
                    </select>
                  </label>
                  <label>
                    Time
                    <select
                      className="v2-input"
                      value={timeFilter}
                      onChange={(event) =>
                        setTimeFilter(event.target.value as TimeFilter)
                      }
                    >
                      <option value="all">Any time</option>
                      <option value="today">Today</option>
                      <option value="week">Past 7 days</option>
                      <option value="month">Past 30 days</option>
                      <option value="year">Past year</option>
                    </select>
                  </label>
                  <label>
                    Site
                    <select
                      className="v2-input"
                      value={siteFilter}
                      onChange={(event) => setSiteFilter(event.target.value)}
                    >
                      <option value="">Every site</option>
                      {sites.map((site) => (
                        <option key={site} value={site}>
                          {site}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Type
                    <select
                      className="v2-input"
                      value={contentTypeFilter}
                      onChange={(event) =>
                        setContentTypeFilter(
                          event.target.value as ContentTypeFilter,
                        )
                      }
                    >
                      <option value="all">Every type</option>
                      <option value="comment">Comments</option>
                      <option value="voice">Voice inputs</option>
                      <option value="selection">Web captures</option>
                      <option value="note">Saved notes</option>
                      <option value="ai-source">AI Sources</option>
                    </select>
                  </label>
                  <label>
                    Adoption
                    <select
                      className="v2-input"
                      value={adoptedFilter}
                      onChange={(event) =>
                        setAdoptedFilter(event.target.value as AdoptedFilter)
                      }
                    >
                      <option value="all">Any adoption</option>
                      <option value="adopted">Adopted</option>
                      <option value="not-adopted">Not adopted</option>
                    </select>
                  </label>
                  <label className="v2-checkbox-row">
                    <input
                      type="checkbox"
                      checked={reviewOnly}
                      onChange={(event) => setReviewOnly(event.target.checked)}
                    />
                    Needs review
                  </label>
                </div>
              ) : null}
              {selectedGroups.length ? (
                <div className="v2-bulk-bar">
                  <strong>{selectedGroups.length} selected</strong>
                  <select
                    className="v2-input"
                    value={bulkProject}
                    onChange={(event) => setBulkProject(event.target.value)}
                  >
                    <option value="">Choose a Project</option>
                    {projects.map((project) => (
                      <option key={project.name} value={project.name}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!bulkProject || busy}
                    onClick={() => void applyMembership("add")}
                  >
                    <Check size={14} />
                    Add
                  </Button>
                  <Button
                    size="sm"
                    disabled={!bulkProject || busy}
                    onClick={() => void applyMembership("exclude")}
                  >
                    Exclude
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!bulkProject || busy}
                    onClick={draftWithSelectedSources}
                  >
                    <FilePlus2 size={14} />
                    Draft
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      downloadJSON("logue-selected-sources.json", {
                        exported_at: new Date().toISOString(),
                        materials: selectedGroups.flatMap(
                          (group) => group.items,
                        ),
                      })
                    }
                  >
                    <Download size={14} />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void reviewDeletion(selectedGroups)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                  <IconButton
                    label="Clear selection"
                    variant="ghost"
                    onClick={() => setSelectedKeys([])}
                  >
                    <X size={15} />
                  </IconButton>
                </div>
              ) : null}
              <div className="v2-library-list">
                {groups.map((group) => {
                  const material =
                    group.bundle?.primaryComment ?? group.representative;
                  const match = group.items
                    .map((item) => matchById.get(item.id))
                    .find(Boolean);
                  const copy = groupCopy(group);
                  const title = groupTitle(group);
                  return (
                    <article className="v2-library-row" key={group.key}>
                      <label className="v2-row-select">
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(group.key)}
                          onChange={(event) =>
                            setSelectedKeys(
                              event.target.checked
                                ? [...selectedKeys, group.key]
                                : selectedKeys.filter(
                                    (key) => key !== group.key,
                                  ),
                            )
                          }
                        />
                        <span className="sr-only">Select {title}</span>
                      </label>
                      <button
                        type="button"
                        className="v2-library-row-main"
                        onClick={() => setOpenKey(group.key)}
                      >
                        <OriginLabel
                          origin={group.bundle ? "you" : sourceOrigin(material)}
                          detail={
                            group.bundle
                              ? "Web + You"
                              : material.kind === "voice"
                                ? "Voice"
                                : "Saved"
                          }
                        />
                        <h3>{copy || title}</h3>
                        {copy !== title ? <p>{title}</p> : null}
                        <div className="v2-library-meta">
                          {match ? `${matchLabel(match)} · ` : ""}
                          {shortDate(material.createdAt)} ·{" "}
                          {material.source?.domain || "This Mac"}
                          {group.projects.length
                            ? ` · ${group.projects.join(", ")}`
                            : " · Saved only"}
                        </div>
                      </button>
                    </article>
                  );
                })}
                {query &&
                  visibleDocumentMatches.map((match) => {
                    const document = documents.find(
                      (item) => item.id === match.id,
                    );
                    return document ? (
                      <article
                        className="v2-library-row"
                        key={`document:${document.id}`}
                      >
                        <span />
                        <button
                          type="button"
                          className="v2-library-row-main"
                          onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set("doc", document.id);
                            window.history.replaceState(null, "", url);
                            onRoute("documents");
                          }}
                        >
                          <OriginLabel origin="ai" detail="Document" />
                          <h3>{document.title}</h3>
                          <p>{contentSummary(document.content)}</p>
                          <div className="v2-library-meta">
                            {documentMatchLabel(match)} ·{" "}
                            {document.project || "No Project"} · Revision{" "}
                            {document.revision}
                          </div>
                        </button>
                      </article>
                    ) : null;
                  })}
                {loading && !groups.length && !visibleDocumentMatches.length ? (
                  <div className="v2-recovery-card" aria-live="polite">
                    <p>Loading saved content…</p>
                  </div>
                ) : null}
                {!loading && !groups.length &&
                !visibleDocumentMatches.length &&
                !searching ? (
                  <div className="v2-recovery-card">
                    <p>No saved content matches this search.</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : tab === "activity" ? (
            <div className="v2-review-list">
              {materials
                .filter(
                  (item) =>
                    Boolean(item.activityType) &&
                    (!query.trim() ||
                      item.content.toLowerCase().includes(query.toLowerCase())),
                )
                .map((item) => (
                  <article className="v2-review-row" key={item.id}>
                    <div>
                      <OriginLabel
                        origin="you"
                        detail={activityLabel(item.activityType)}
                      />
                      <h3>{materialTitle(item)}</h3>
                      <ContentSummary value={item.content} />
                      <div className="v2-library-meta">
                        {shortDate(item.createdAt)} · Activity only · never
                        added to Project Context
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setOpenActivityId(item.id)}
                    >
                      Open
                    </Button>
                  </article>
                ))}
              {runs
                .filter(
                  (run) =>
                    !query.trim() ||
                    `${run.skill_name} ${run.instruction} ${run.original_output ?? ""}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((run) => (
                  <article className="v2-review-row" key={run.id}>
                    <div>
                      <OriginLabel origin="ai" detail={run.status} />
                      <h3>{run.skill_name}</h3>
                      <ContentSummary
                        value={run.instruction}
                        fallback="Deleted Run details"
                      />
                      <div className="v2-library-meta">
                        {shortDate(run.created_at)} · {run.sources.length}{" "}
                        frozen Sources
                        {run.tombstone
                          ? " · lineage only"
                          : run.adopted_output ||
                              run.document_id ||
                              run.material_id
                            ? " · adopted"
                            : " · candidate recoverable"}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setOpenRunId(run.id)}>
                      Open
                    </Button>
                  </article>
                ))}
              {runs.length === 0 &&
              materials.every((item) => !item.activityType) ? (
                <div className="v2-recovery-card">
                  <p>No activity yet.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <V2TopicsPanel
              materials={savedMaterials}
              projects={projects}
              onRefresh={onRefresh}
              onOpenSource={(id) => {
                const target = groupLibraryMaterials(
                  savedMaterials.filter((item) => item.id === id),
                  savedMaterials,
                )[0];
                setQuery("");
                setProjectFilter("");
                setTopicFilter("");
                setOriginFilter("all");
                setTimeFilter("all");
                setSiteFilter("");
                setContentTypeFilter("all");
                setAdoptedFilter("all");
                setReviewOnly(false);
                setTab("saved");
                if (target) setOpenKey(target.key);
              }}
            />
          )}
          {error && !deleteGroups.length ? (
            <div className="v2-warning-bar" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </ProjectShell>
  );
}
