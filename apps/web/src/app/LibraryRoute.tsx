import type { Material } from "@logue/ui";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
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
} from "../lib/api";
import {
  groupLibraryMaterials,
  type LibraryMaterialGroup,
} from "../lib/commentBundles";
import {
  adoptSkillRun,
  createAdoptionId,
  documentAdoptionFromResult,
  isLogueDocumentTombstone,
  resolveDocumentUndoFailure,
  resolveDocumentUndoResult,
  saveSkillRunAsDocument,
  skillResolutionLabel,
  type DocumentAdoption,
} from "../lib/skillApi";
import { Banner, Button, Card, CheckboxField, IconButton, InlineActions, Input, Meta, OriginLabel, RecordingAudioPlayer, Select, Tab, Tabs, Textarea, type OriginLabelType } from "../ui";
import { AppShell, type PrimaryRoute } from "./AppShell";
import { TopicsPanel } from "./TopicsPanel";
import { updateNavigationState } from "./navigationState";
import { ContentSummary, contentSummary } from "./contentPresentation";
import { HeadingCopy, Lead, LibraryList, LibraryRow, LibraryRowMain, PageAxis, PageScroll, PickerGroup, ReviewList, ReviewRow, RowSelect, SettingRow, SettingsSection } from "./layout";
import { Chip, InspectorHeader, InspectorScroll, SourceBody, SourceBundle, SourceMeta, SourceToggle } from "./Inspector";

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
  onOpenDocument,
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
  onOpenDocument: (document: LogueDocument) => void;
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
  const linkedDocument = documents.find((document) =>
    group.items.some((item) => item.source?.document_id === document.id),
  );
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
      <InspectorHeader>
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
      </InspectorHeader>
      <InspectorScroll>
        <SourceBundle active>
          {group.bundle ? (
            <>
              <SourceBody>
                <OriginLabel origin="you" detail="Your comment" />
                <p>{groupCopy(group)}</p>
              </SourceBody>
              <SourceBody>
                <OriginLabel origin="web" detail="Original evidence" />
                <p>{contentSummary(evidence?.content)}</p>
              </SourceBody>
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
              <p>{contentSummary(displayedContent)}</p>
            </>
          )}
          <SourceMeta>
            {shortDate(primary.createdAt)} ·{" "}
            {originalSource.source?.domain || "This Mac"}
          </SourceMeta>
          <InlineActions>
            {linkedDocument ? (
              <Button size="sm" onClick={() => onOpenDocument(linkedDocument)}>
                <FileText size={14} />
                Open Document
              </Button>
            ) : null}
            {originalSource.source?.url ? (
              <Chip
                
                href={originalSource.source.url}
                target="_blank"
                rel="noreferrer">
                <ExternalLink size={14} />
                Open original
              </Chip>
            ) : null}
          </InlineActions>
        </SourceBundle>
        {anchor ? (
          <SettingsSection>
            <h2>{anchorStatusLabel(anchor.status)}</h2>
            {anchor.status === "page_changed" ? (
              <Lead>
                The saved passage no longer matches this page. Open the original
                page, select the replacement passage, then use Re-anchor in the
                Side Panel.
              </Lead>
            ) : anchor.status === "snapshot_only" ? (
              <Lead>
                The original passage remains saved even without a live page
                anchor. Re-anchor it later from the Side Panel.
              </Lead>
            ) : (
              <Lead>
                The saved passage can be located on the original page from the
                Side Panel.
              </Lead>
            )}
            {anchor.status === "reanchored" &&
            anchor.quote &&
            anchor.quote !== anchorOwner?.content ? (
              <SourceBody>
                <OriginLabel
                  origin="web"
                  detail={`Current anchor · Revision ${anchor.revision}`}
                />
                <p>{anchor.quote}</p>
              </SourceBody>
            ) : null}
          </SettingsSection>
        ) : null}
        {primary.captureId ? (
          <SettingsSection>
            <h2>Original audio</h2>
            <RecordingAudioPlayer
              src={captureAudioURL(primary.captureId)}
              label="Play original recording"
            />
          </SettingsSection>
        ) : null}
        {isAISource ? (
          <SettingsSection>
            <InlineActions>
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
            </InlineActions>
            {editingSource ? (
              <>
                <Textarea
                  aria-label="AI Source content"
                  value={sourceDraft}
                  onChange={(event) => setSourceDraft(event.target.value)}
                />
                <InlineActions>
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
                </InlineActions>
              </>
            ) : (
              <>
                <Select
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
                </Select>
                {revisionSources.length ? (
                  <ReviewList>
                    {revisionSources.map((source) => (
                      <ReviewRow
                        type="button"
                        
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
                      </ReviewRow>
                    ))}
                    {openRevisionSource ? (
                      <SourceBody>
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
                          <Chip
                            
                            href={openRevisionSource.source.url}
                            target="_blank"
                            rel="noreferrer">
                            <ExternalLink size={14} />
                            Open original
                          </Chip>
                        ) : null}
                      </SourceBody>
                    ) : null}
                  </ReviewList>
                ) : previewRevision?.parent_ids?.length ? (
                  <ReviewList>
                    {previewRevision.parent_ids.map((id) => (
                      <ReviewRow  key={id}>
                        <div>
                          <strong>Frozen Source ID</strong>
                          <p>{id}</p>
                        </div>
                      </ReviewRow>
                    ))}
                  </ReviewList>
                ) : (
                  <Lead>
                    No parent Sources were attached to this revision.
                  </Lead>
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
          </SettingsSection>
        ) : null}
        {primary.transcript ? (
          <SettingsSection>
            <h2>Voice history</h2>
            {primary.rawTranscript ? (
              <SettingRow>
                <div>
                  <strong>Raw transcript</strong>
                  <p>{primary.rawTranscript}</p>
                </div>
              </SettingRow>
            ) : null}
            <SettingRow>
              <div>
                <strong>Transformed transcript</strong>
                <p>{primary.transcript}</p>
              </div>
            </SettingRow>
            <SettingRow>
              <div>
                <strong>Saved version</strong>
                <p>{contentSummary(primary.content)}</p>
              </div>
            </SettingRow>
            {primary.appliedContext ? (
              <>
                <SettingRow>
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
                </SettingRow>
                <SettingRow>
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
                </SettingRow>
                <SettingRow>
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
                </SettingRow>
                {primary.appliedContext.reference_project ? (
                  <SettingRow>
                    <div>
                      <strong>Project used for transcription</strong>
                      <p>{primary.appliedContext.reference_project}</p>
                    </div>
                  </SettingRow>
                ) : null}
                {primary.appliedContext.custom_instructions ||
                primary.appliedContext.formatting_preference ||
                primary.appliedContext.phrases?.length ||
                primary.appliedContext.avoid_terms?.length ? (
                  <details className="mt-2.5 text-[13px] text-ink-soft [&>summary]:cursor-pointer [&>summary]:text-muted">
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
          </SettingsSection>
        ) : null}
        {primary.adoptedRevisions?.length ? (
          <SettingsSection>
            <h2>Adopted versions</h2>
            <ReviewList>
              {[...primary.adoptedRevisions]
                .sort((left, right) => right.revision - left.revision)
                .map((revision) => (
                  <ReviewRow  key={revision.id}>
                    <div>
                      <OriginLabel
                        origin="ai"
                        detail={`${adoptionActionLabel(revision.action)} · Revision ${revision.revision}${revision.undone ? " · Undone" : ""}`}
                      />
                      <p>{contentSummary(revision.content)}</p>
                      <Meta>
                        {shortDate(revision.created_at)}
                        {revision.target?.surface
                          ? ` · ${revision.target.surface}`
                          : ""}
                        {revision.target?.url
                          ? ` · ${new URL(revision.target.url).hostname}`
                          : ""}
                      </Meta>
                    </div>
                  </ReviewRow>
                ))}
            </ReviewList>
          </SettingsSection>
        ) : null}
        <SettingsSection>
          <h2>Project Context</h2>
          <div className="flex items-center gap-2">
            <Select
              value={project}
              onChange={(event) => setProject(event.target.value)}
            >
              <option value="">Choose a Project</option>
              {projects.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
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
            <Lead>{primary.organization.reason}</Lead>
          ) : null}
        </SettingsSection>
        <SettingsSection>
          <h2>Use in a Document</h2>
          <div className="flex items-center gap-2">
            <Select
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              <option value="">Choose a Document</option>
              {documents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
            <Button
              disabled={!documentId || busy}
              onClick={() => void addToDocument()}
            >
              Add Source
            </Button>
          </div>
        </SettingsSection>
        {parentSources.length ? (
          <SettingsSection>
            <h2>Lineage</h2>
            <Lead>
              Derived from {parentSources.length} frozen Source
              {parentSources.length === 1 ? "" : "s"}.
            </Lead>
            <ReviewList>
              {parentSources.map(({ id, source }) => (
                <ReviewRow
                  type="button"
                  
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
                </ReviewRow>
              ))}
            </ReviewList>
          </SettingsSection>
        ) : null}
        {error ? (
          <Banner tone="warning"  role="alert">
            {error}
          </Banner>
        ) : null}
        <SettingsSection>
          <InlineActions>
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
          </InlineActions>
        </SettingsSection>
      </InspectorScroll>
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
  const [documentAdoption, setDocumentAdoption] =
    useState<DocumentAdoption>();
  const [documentUndoRetryable, setDocumentUndoRetryable] = useState(false);
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
      if (isLogueDocumentTombstone(result.document)) {
        throw new Error("Could not create this Document.");
      }
      await onRefresh();
      delete adoptionAttempts.current.document;
      setDocumentTargetOpen(false);
      setDocumentAdoption(
        documentAdoptionFromResult(
          adoptionId,
          result.document,
          targetDocument ? "replace" : "document",
        ),
      );
      setDocumentUndoRetryable(false);
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
      const result = await saveSkillRunAsDocument(run.id, {
        title: run.skill_name,
        content: draft,
        documentId: documentAdoption.documentId,
        expectedRevision: documentAdoption.documentRevision,
        adoptionId: documentAdoption.id,
        adoptionAction: "undo",
        target: { surface: "activity-inspector", target_key: `document:${documentAdoption.documentId}` },
      });
      resolveDocumentUndoResult(documentAdoption, result.document);
      await onRefresh();
      setDocumentAdoption(undefined);
      setDocumentUndoRetryable(false);
    } catch (cause) {
      const failure = resolveDocumentUndoFailure(documentAdoption, cause);
      setDocumentAdoption(failure.adoption);
      setDocumentUndoRetryable(failure.retryable);
      setError(failure.message);
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
      <InspectorHeader>
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
      </InspectorHeader>
      <InspectorScroll>
        <SourceBundle active>
          <OriginLabel
            origin="you"
            detail={
              run.project ? `${run.project} activity` : "Private activity"
            }
          />
          <h3>{run.instruction || "Deleted Run"}</h3>
          <SourceMeta>
            {shortDate(run.created_at)} · Skill revision {run.skill_revision} ·{" "}
            {skillResolutionLabel(run.skill_resolution)} · {run.sources.length} frozen Sources{run.pinned ? " · pinned" : ""}
            {run.retry_run_id ? " · retry" : ""}
          </SourceMeta>
        </SourceBundle>
        {run.error ? (
          <Banner tone="warning"  role="alert">
            {run.error}
          </Banner>
        ) : null}
        {draft ? (
          <SettingsSection>
            <h2>{adopted ? "Adopted result" : "Recover candidate"}</h2>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <InlineActions>
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
                  {documentUndoRetryable
                    ? "Retry Undo"
                    : documentAdoption.action === "document"
                    ? "Undo Save as document"
                    : "Undo Document update"}
                </Button>
              ) : <div className="relative w-fit max-[480px]:w-full">
                <Button variant="primary" disabled={busy || !draft.trim()} aria-expanded={documentTargetOpen} onClick={() => setDocumentTargetOpen((open) => !open)}>
                  <FilePlus2 size={14} />
                  Save as Document…
                </Button>
                {documentTargetOpen ? (
                  <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-10 w-full max-w-90 overflow-hidden rounded-md border border-line-strong bg-surface shadow-[0_14px_36px_rgba(30,31,29,0.16)]" role="menu" aria-label="Choose Document target">
                    <div className="max-h-90 overflow-auto p-1.5">
                      <PickerGroup>
                        <div className="px-2 pt-1.5 pb-1 text-[11px] font-[650] text-muted">Create</div>
                        <button type="button" role="menuitem" onClick={() => void saveDocument()}><span>New Document</span><small>Start with this recovered Candidate</small></button>
                      </PickerGroup>
                      {projectDocuments.length ? <PickerGroup>
                        <div className="px-2 pt-1.5 pb-1 text-[11px] font-[650] text-muted">Update existing</div>
                        {projectDocuments.map((document) => <button key={document.id} type="button" role="menuitem" onClick={() => void saveDocument(document)}><span>{document.title}</span><small>Replace as revision {document.revision + 1}</small></button>)}
                      </PickerGroup> : null}
                    </div>
                  </div>
                ) : null}
              </div>}
            </InlineActions>
          </SettingsSection>
        ) : null}
        {run.adoption_revisions?.length ? (
          <SettingsSection>
            <h2>Adoption history</h2>
            <ReviewList>
              {[...run.adoption_revisions]
                .sort((left, right) => right.revision - left.revision)
                .map((revision) => (
                  <ReviewRow  key={revision.id}>
                    <div>
                      <OriginLabel
                        origin="ai"
                        detail={`${adoptionActionLabel(revision.action)} · Revision ${revision.revision}${revision.undone ? " · Undone" : ""}`}
                      />
                      <ContentSummary value={revision.content} />
                      <Meta>
                        {revision.created_at ? shortDate(revision.created_at) : "Saved"}
                        {revision.document_revision ? ` · Document revision ${revision.document_revision}` : ""}
                        {revision.target?.surface ? ` · ${revision.target.surface}` : ""}
                      </Meta>
                    </div>
                  </ReviewRow>
                ))}
            </ReviewList>
          </SettingsSection>
        ) : null}
        <SettingsSection>
          <h2>Context sent</h2>
          <Card>
            <OriginLabel origin="you" detail="Instruction" />
            <p>{modelContext?.instruction || run.instruction}</p>
          </Card>
          <Card>
            <OriginLabel origin="ai" detail={`Skill revision ${modelContext?.skill.revision ?? run.skill_revision}`} />
            <strong>{modelContext?.skill.name || run.skill_name}</strong>
            {modelContext?.skill.instructions ? (
              <p>{modelContext.skill.instructions}</p>
            ) : null}
          </Card>
          {modelContext?.project.overview ? (
            <Card>
              <OriginLabel origin="you" detail={modelContext.project.name || "Project context"} />
              <p>{modelContext.project.overview}</p>
            </Card>
          ) : null}
          {modelContext?.personal_context ? (
            <Card>
              <OriginLabel origin="you" detail="Personal context" />
              <p>{modelContext.personal_context}</p>
            </Card>
          ) : null}
          {modelContext?.selection || modelContext?.target_text ? (
            <Card>
              <OriginLabel origin="web" detail="Page context" />
              <p>{modelContext.selection || modelContext.target_text}</p>
            </Card>
          ) : null}
        </SettingsSection>
        <SettingsSection>
          <h2>Sources used</h2>
          {run.sources.map((source, index) => (
            <Card  key={source.id}>
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
                <SourceToggle
                  
                  href={source.source.url}
                  target="_blank"
                  rel="noreferrer">
                  Open original
                </SourceToggle>
              ) : null}
            </Card>
          ))}
        </SettingsSection>
        {!run.tombstone ? (
          <InlineActions>
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
          </InlineActions>
        ) : (
          <Card>
            Run details were deleted. Minimal lineage remains for an adopted
            result.
          </Card>
        )}
        {deletePreview ? (
          <Banner tone="danger">
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
                <Input
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                />
              </label>
            ) : null}
            <InlineActions>
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
            </InlineActions>
          </Banner>
        ) : null}
        {error ? (
          <Banner tone="warning"  role="alert">
            {error}
          </Banner>
        ) : null}
      </InspectorScroll>
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
      <InspectorHeader>
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
      </InspectorHeader>
      <InspectorScroll>
        <SourceBundle active>
          <h3>{materialTitle(item)}</h3>
          <p>{contentSummary(item.content)}</p>
          <SourceMeta>
            {shortDate(item.createdAt)} · Private Activity · never Project
            Context
          </SourceMeta>
        </SourceBundle>
        {item.captureId ? (
          <SettingsSection>
            <h2>Original audio</h2>
            <RecordingAudioPlayer
              src={captureAudioURL(item.captureId)}
              label="Play original voice command"
            />
          </SettingsSection>
        ) : null}
        {item.transcript ? (
          <SettingsSection>
            <h2>Voice history</h2>
            {item.rawTranscript ? (
              <SettingRow>
                <div>
                  <strong>Raw transcript</strong>
                  <p>{item.rawTranscript}</p>
                </div>
              </SettingRow>
            ) : null}
            <SettingRow>
              <div>
                <strong>Transformed transcript</strong>
                <p>{item.transcript}</p>
              </div>
            </SettingRow>
            <SettingRow>
              <div>
                <strong>Saved activity</strong>
                <p>{contentSummary(item.content)}</p>
              </div>
            </SettingRow>
          </SettingsSection>
        ) : null}
        <InlineActions>
          {run ? (
            <Button variant="primary" onClick={onOpenRun}>
              Open generated Run
            </Button>
          ) : null}
          <Button onClick={onReviewDelete}>
            <Trash2 size={14} />
            Review deletion
          </Button>
        </InlineActions>
      </InspectorScroll>
    </>
  );
}

export function LibraryRoute({
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
  onRoute: (route: PrimaryRoute) => void;
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
  const requestedSourceId = new URLSearchParams(window.location.search).get(
    "source",
  );

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

  const savedMaterials = useMemo(
    () => materials.filter((item) => !item.activityType && !item.tombstone),
    [materials],
  );
  const allGroups = useMemo(
    () => groupLibraryMaterials(savedMaterials, savedMaterials),
    [savedMaterials],
  );
  useEffect(() => {
    if (!requestedSourceId) return;
    const target = allGroups.find((group) =>
      group.items.some((item) => item.id === requestedSourceId),
    );
    if (target) setOpenKey(target.key);
  }, [allGroups, requestedSourceId]);
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
    allGroups.find((group) => group.key === openKey) ??
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

  function openDocument(document: LogueDocument) {
    onRoute("documents");
    const url = new URL(window.location.href);
    url.searchParams.set("doc", document.id);
    url.searchParams.delete("document");
    if (document.project) url.searchParams.set("project", document.project);
    else url.searchParams.delete("project");
    window.history.replaceState(null, "", url);
  }

  function closeSource() {
    setOpenKey(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("source");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openSource(group: LibraryMaterialGroup) {
    setOpenKey(group.key);
    const url = new URL(window.location.href);
    url.searchParams.set("source", group.representative.id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

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
      <InspectorHeader>
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
      </InspectorHeader>
      <InspectorScroll>
        <Banner tone="danger">
          <p>
            Delete {deleteGroups.length} selected item
            {deleteGroups.length === 1 ? "" : "s"} from this Host. Existing text
            already inserted into other apps is unchanged.
          </p>
          <ReviewList>
            <ReviewRow>
              <div>
                <strong>{dependencyTotals?.projects ?? 0} Project links</strong>
                <p>Removed with the Source.</p>
              </div>
            </ReviewRow>
            <ReviewRow>
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
            </ReviewRow>
          </ReviewList>
          <label>
            Type DELETE to continue
            <Input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
            />
          </label>
          <InlineActions>
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
          </InlineActions>
        </Banner>
        {error ? <Banner tone="warning">{error}</Banner> : null}
      </InspectorScroll>
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
      onClose={closeSource}
      onOpenSource={(id) => {
        const target = groupLibraryMaterials(
          materials.filter((item) => item.id === id),
          materials,
        )[0];
        if (target) openSource(target);
      }}
      onOpenDocument={openDocument}
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
    <AppShell
      route="library"
      onRouteChange={onRoute}
      inspectorOpen={Boolean(inspector)}
      onInspectorOpenChange={(open) => {
        if (!open) {
          closeSource();
          setOpenRunId(undefined);
          setOpenActivityId(undefined);
          setDeleteGroups([]);
        }
      }}
      inspector={inspector}
    >
      <PageScroll>
        <PageAxis axis="list">
          <div className="mb-10 flex items-start justify-between gap-6">
            <HeadingCopy>
              <h1>{query.trim() ? "Find" : "Library"}</h1>
              {query.trim() ? (
                <p>
                  {`${searching ? "Searching" : `${groups.length + visibleDocumentMatches.length} results`} · ${strategy === "semantic" ? "meaning and exact words" : "exact words"}`}
                </p>
              ) : null}
            </HeadingCopy>
          </div>
          <label className="my-4.5 mb-3.5 flex h-10 items-center gap-[9px] rounded-md border border-line-strong bg-surface px-3 text-muted [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-ink [&_input]:outline-0">
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
          <Tabs label="Library content">
            <Tab
              active={tab === "saved"}
              onClick={() => setTab("saved")}
            >
              Saved content
            </Tab>
            <Tab
              active={tab === "activity"}
              onClick={() => setTab("activity")}
            >
              All activity
            </Tab>
            <Tab
              active={tab === "topics"}
              onClick={() => setTab("topics")}
            >
              Topics
            </Tab>
          </Tabs>
          {tab === "saved" ? (
            <>
              <div className="flex items-center gap-2">
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
                  className="mt-2.5 grid grid-cols-2 gap-3 rounded-md border border-line bg-surface-muted p-3.5 min-[1120px]:grid-cols-4 [&>label]:grid [&>label]:gap-1.5 [&>label]:text-xs [&>label]:text-muted"
                  aria-label="Library filters"
                >
                  <label>
                    Project
                    <Select
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                    >
                      <option value="">Every Project</option>
                      {projects.map((project) => (
                        <option key={project.name} value={project.name}>
                          {project.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Topic
                    <Select
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
                    </Select>
                  </label>
                  <label>
                    Origin
                    <Select
                      value={originFilter}
                      onChange={(event) =>
                        setOriginFilter(event.target.value as OriginFilter)
                      }
                    >
                      <option value="all">Every origin</option>
                      <option value="web">Web</option>
                      <option value="you">You</option>
                      <option value="ai">AI</option>
                    </Select>
                  </label>
                  <label>
                    Time
                    <Select
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
                    </Select>
                  </label>
                  <label>
                    Site
                    <Select
                      value={siteFilter}
                      onChange={(event) => setSiteFilter(event.target.value)}
                    >
                      <option value="">Every site</option>
                      {sites.map((site) => (
                        <option key={site} value={site}>
                          {site}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Type
                    <Select
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
                    </Select>
                  </label>
                  <label>
                    Adoption
                    <Select
                      value={adoptedFilter}
                      onChange={(event) =>
                        setAdoptedFilter(event.target.value as AdoptedFilter)
                      }
                    >
                      <option value="all">Any adoption</option>
                      <option value="adopted">Adopted</option>
                      <option value="not-adopted">Not adopted</option>
                    </Select>
                  </label>
                  <CheckboxField>
                    <input
                      type="checkbox"
                      checked={reviewOnly}
                      onChange={(event) => setReviewOnly(event.target.checked)}
                    />
                    Needs review
                  </CheckboxField>
                </div>
              ) : null}
              {selectedGroups.length ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-2 [&>strong]:mr-auto [&>strong]:text-[13px] [&_select]:w-45">
                  <strong>{selectedGroups.length} selected</strong>
                  <Select
                    value={bulkProject}
                    onChange={(event) => setBulkProject(event.target.value)}
                  >
                    <option value="">Choose a Project</option>
                    {projects.map((project) => (
                      <option key={project.name} value={project.name}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
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
              <LibraryList selecting={selectedKeys.length > 0}>
                {groups.map((group) => {
                  const material =
                    group.bundle?.primaryComment ?? group.representative;
                  const match = group.items
                    .map((item) => matchById.get(item.id))
                    .find(Boolean);
                  const copy = groupCopy(group);
                  const title = groupTitle(group);
                  return (
                    <LibraryRow key={group.key}>
                      <RowSelect>
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
                      </RowSelect>
                      <LibraryRowMain
                        type="button"
                        
                        onClick={() => openSource(group)}
                      >
                        <OriginLabel
                          origin={group.bundle ? "you" : sourceOrigin(material)}
                          detail={
                            group.bundle
                              ? "Comment on Web"
                              : material.kind === "voice"
                                ? "Voice"
                                : "Saved"
                          }
                        />
                        <h3>{copy || title}</h3>
                        {copy !== title ? <p>{title}</p> : null}
                        <Meta>
                          {match ? `${matchLabel(match)} · ` : ""}
                          {shortDate(material.createdAt)} ·{" "}
                          {material.source?.domain || "This Mac"}
                          {group.projects.length
                            ? ` · ${group.projects.join(", ")}`
                            : " · Saved only"}
                        </Meta>
                      </LibraryRowMain>
                    </LibraryRow>
                  );
                })}
                {query &&
                  visibleDocumentMatches.map((match) => {
                    const document = documents.find(
                      (item) => item.id === match.id,
                    );
                    return document ? (
                      <LibraryRow key={`document:${document.id}`}>
                        <span />
                        <LibraryRowMain
                          type="button"
                          
                          onClick={() => openDocument(document)}
                        >
                          <OriginLabel origin="ai" detail="Document" />
                          <h3>{document.title}</h3>
                          <p>{contentSummary(document.content)}</p>
                          <Meta>
                            {documentMatchLabel(match)} ·{" "}
                            {document.project || "No Project"} · Revision{" "}
                            {document.revision}
                          </Meta>
                        </LibraryRowMain>
                      </LibraryRow>
                    ) : null;
                  })}
                {loading && !groups.length && !visibleDocumentMatches.length ? (
                  <Card  aria-live="polite">
                    <p>Loading saved content…</p>
                  </Card>
                ) : null}
                {!loading && !groups.length &&
                !visibleDocumentMatches.length &&
                !searching ? (
                  <Card>
                    <p>
                      {query.trim() || activeFilterCount
                        ? "No saved content matches these filters."
                        : "No saved content yet."}
                    </p>
                  </Card>
                ) : null}
              </LibraryList>
            </>
          ) : tab === "activity" ? (
            <ReviewList>
              {materials
                .filter(
                  (item) =>
                    Boolean(item.activityType) &&
                    (!query.trim() ||
                      item.content.toLowerCase().includes(query.toLowerCase())),
                )
                .map((item) => (
                  <ReviewRow  key={item.id}>
                    <div>
                      <OriginLabel
                        origin="you"
                        detail={activityLabel(item.activityType)}
                      />
                      <h3>{materialTitle(item)}</h3>
                      <ContentSummary value={item.content} />
                      <Meta>
                        {shortDate(item.createdAt)} · Activity only · never
                        added to Project Context
                      </Meta>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setOpenActivityId(item.id)}
                    >
                      Open
                    </Button>
                  </ReviewRow>
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
                  <ReviewRow  key={run.id}>
                    <div>
                      <OriginLabel origin="ai" detail={run.status} />
                      <h3>{run.skill_name}</h3>
                      <ContentSummary
                        value={run.instruction}
                        fallback="Deleted Run details"
                      />
                      <Meta>
                        {shortDate(run.created_at)} · {run.sources.length}{" "}
                        frozen Sources
                        {run.tombstone
                          ? " · lineage only"
                          : run.adopted_output ||
                              run.document_id ||
                              run.material_id
                            ? " · adopted"
                            : " · candidate recoverable"}
                      </Meta>
                    </div>
                    <Button size="sm" onClick={() => setOpenRunId(run.id)}>
                      Open
                    </Button>
                  </ReviewRow>
                ))}
              {runs.length === 0 &&
              materials.every((item) => !item.activityType) ? (
                <Card>
                  <p>No activity yet.</p>
                </Card>
              ) : null}
            </ReviewList>
          ) : (
            <TopicsPanel
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
            <Banner tone="warning"  role="alert">
              {error}
            </Banner>
          ) : null}
        </PageAxis>
      </PageScroll>
    </AppShell>
  );
}
