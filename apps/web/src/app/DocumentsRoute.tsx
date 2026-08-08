import { ProductStatus, type ExtensionInputTarget, type Material } from "@logue/ui";
import {
  Clock3,
  Copy,
  Download,
  FilePlus2,
  History,
  MoreHorizontal,
  PanelRightClose,
  RotateCcw,
  Redo2,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createMaterial,
  createDocument,
  executeDeletion,
  getDeletionPreview,
  getDocumentRevisions,
  restoreDocumentRevision,
  updateDocument,
  type DeletionPreview,
  type DocumentRevision,
  type LogueDocument,
  type ProjectSummary,
  type SkillRunSourceSnapshot,
} from "../lib/api";
import {
  adoptSkillRun,
  createAdoptionId,
  createSkillRun,
  isLogueDocumentTombstone,
  resolveDocumentUndoFailure,
  retrySkillRun,
  saveSkillRunAsDocument,
  SkillRunFailure,
  type LogueSkill,
  type LogueSkillRun,
} from "../lib/skillApi";
import { Button, IconButton } from "../ui/Button";
import { PanelResizer, usePersistentPanelSize } from "../ui/PanelResizer";
import { sanitizeEditorHTML } from "../lib/documentEditing";
import { OriginLabel } from "../ui/OriginLabel";
import { AppShell, type PrimaryRoute } from "./AppShell";
import {
  DocumentContent,
  documentSelectionOffsets,
  replaceDocumentTextRange,
  restoreDocumentCaret,
} from "./DocumentContent";
import {
  insertDocumentIntoTarget,
  listExtensionInputTargets,
  undoDocumentTargetInsert,
} from "../lib/extensionTargetBridge";
import {
  readNavigationState,
  saveDocumentPosition,
  updateNavigationState,
} from "./navigationState";
import { contentSummary } from "./contentPresentation";
import { axisClass, cardClass, contextSummaryClass, dangerCardClass, documentMenuClass, eyebrowClass, headingCopyClass, inlineActionsClass, inputClass, inspectorHeaderClass, inspectorScrollClass, leadClass, metaClass, panelHeadingClass, scrollClass, sourceBundleClass, sourceListClass, sourceToggleClass, textareaClass, toolbarSelectClass, warningBarClass } from "./layout";

type DisplaySource = Material | SkillRunSourceSnapshot;

function materialTitle(material: DisplaySource) {
  return (
    material.source?.title?.trim() ||
    material.source?.domain?.trim() ||
    (material.kind === "voice" ? "Voice input" : "Saved Source")
  );
}

function sourceOrigin(material: DisplaySource) {
  if (material.actor && material.actor.toLowerCase() !== "user")
    return "ai" as const;
  if (material.kind === "selection") return "web" as const;
  return "you" as const;
}

export function DocumentsRoute({
  documents,
  projects,
  materials,
  skills,
  aiReady,
  loading,
  onRoute,
  onRefresh,
}: {
  documents: LogueDocument[];
  projects: ProjectSummary[];
  materials: Material[];
  skills: LogueSkill[];
  aiReady: boolean;
  loading: boolean;
  onRoute: (route: PrimaryRoute) => void;
  onRefresh: () => Promise<void>;
}) {
  const { size: documentListWidth, setSize: setDocumentListWidth } =
    usePersistentPanelSize({
      storageKey: "logue.documents.list.width",
      defaultSize: 220,
      min: 180,
      max: 360,
    });
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () =>
      new URLSearchParams(window.location.search).get("doc") ??
      readNavigationState().documents?.selectedId,
  );
  const selected =
    documents.find((item) => item.id === selectedId) ?? documents[0];
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [project, setProject] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inspector, setInspector] = useState<"sources" | "history">();
  const [openCitationSourceId, setOpenCitationSourceId] = useState<string>();
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [preview, setPreview] = useState<DocumentRevision>();
  const [revisionDeletePreview, setRevisionDeletePreview] =
    useState<DeletionPreview>();
  const [revisionDeleteConfirm, setRevisionDeleteConfirm] = useState("");
  const [revisionNotice, setRevisionNotice] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeletionPreview>();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [actionSkillId, setActionSkillId] = useState("");
  const [actionRun, setActionRun] = useState<LogueSkillRun>();
  const [actionText, setActionText] = useState("");
  const [actionSnapshot, setActionSnapshot] = useState<{
    content: string;
    revision: number;
    start: number;
    end: number;
  }>();
  const [actionBusy, setActionBusy] = useState(false);
  const [actionUndo, setActionUndo] = useState<{
    runId: string;
    adoptionId: string;
    documentId: string;
    expectedRevision: number;
    content: string;
    title: string;
    project: string;
  }>();
  const [actionUndoRetryable, setActionUndoRetryable] = useState(false);
  const [actionKeepAdoption, setActionKeepAdoption] = useState<{
    runId: string;
    adoptionId: string;
    content: string;
  }>();
  const actionAdoptionAttempts = useRef<Partial<Record<"replace" | "copy" | "keep", { id: string; content: string }>>>({});
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [inputTargets, setInputTargets] = useState<ExtensionInputTarget[]>([]);
  const [selectedInputTarget, setSelectedInputTarget] =
    useState<ExtensionInputTarget>();
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetError, setTargetError] = useState("");
  const [editorHistory, setEditorHistory] = useState({
    undo: false,
    redo: false,
  });
  const [targetUndo, setTargetUndo] = useState<{
    target: ExtensionInputTarget;
    token: string;
  }>();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const editVersionRef = useRef(0);
  const baseRevisionRef = useRef(0);
  const selectedDocumentIdRef = useRef<string | undefined>(undefined);
  const sourceIds = preview?.source_ids ?? selected?.source_ids ?? [];
  const frozenSources = preview?.sources ?? selected?.sources ?? [];
  const sources = useMemo(
    () =>
      sourceIds.flatMap((id) => {
        const item =
          frozenSources.find((source) => source.id === id) ??
          materials.find((material) => material.id === id);
        return item ? [item] : [];
      }),
    [frozenSources, materials, sourceIds.join("|")],
  );
  const citationSource = sources.find(
    (source) => source.id === openCitationSourceId,
  );

  useEffect(() => {
    if (!selectedId && documents[0]) setSelectedId(documents[0].id);
  }, [documents, selectedId]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected?.id) url.searchParams.set("doc", selected.id);
    else url.searchParams.delete("doc");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    if (selected?.id) {
      updateNavigationState((current) => ({
        ...current,
        documents: { ...current.documents, selectedId: selected.id },
      }));
    }
  }, [selected?.id]);
  useEffect(() => {
    setTitle(selected?.title ?? "");
    setContent(selected?.content ?? "");
    setProject(selected?.project ?? "");
    setDirty(false);
    setPreview(undefined);
    setRevisions([]);
    setRevisionDeletePreview(undefined);
    setRevisionDeleteConfirm("");
    setRevisionNotice("");
    setDeleteOpen(false);
    setActionRun(undefined);
    setActionSnapshot(undefined);
    setOpenCitationSourceId(undefined);
    setTargetUndo(undefined);
    setTargetError("");
    setEditorHistory({ undo: false, redo: false });
    setError("");
    editVersionRef.current += 1;
    baseRevisionRef.current = selected?.revision ?? 0;
    selectedDocumentIdRef.current = selected?.id;
    const saved = selected?.id
      ? readNavigationState().documents?.positions?.[selected.id]
      : undefined;
    if (saved) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (editorScrollRef.current)
            editorScrollRef.current.scrollTop = saved.scrollTop;
          if (editorRef.current) {
            editorRef.current.focus({ preventScroll: true });
            restoreDocumentCaret(editorRef.current, saved.caret);
          }
        });
      });
    }
  }, [selected?.id, selected?.revision]);
  useEffect(() => {
    setActionUndo(undefined);
  }, [selected?.id]);

  function refreshEditorHistory() {
    setEditorHistory({
      undo: document.queryCommandEnabled("undo"),
      redo: document.queryCommandEnabled("redo"),
    });
  }

  function markEdited() {
    editVersionRef.current += 1;
    setDirty(true);
  }

  function applyEditorHistory(direction: "undo" | "redo") {
    const editor = editorRef.current;
    if (!editor || preview) return;
    editor.focus({ preventScroll: true });
    document.execCommand(direction);
    setContent(sanitizeEditorHTML(editor.innerHTML));
    markEdited();
    window.requestAnimationFrame(refreshEditorHistory);
  }
  useEffect(() => {
    if (!actionSkillId)
      setActionSkillId(
        skills.find(
          (skill) =>
            skill.enabled &&
            skill.task === "generate" &&
            skill.surfaces.includes("web"),
        )?.id ?? "",
      );
  }, [actionSkillId, skills]);
  useEffect(() => {
    if (!selected || !dirty || saving || preview) return;
    const timer = window.setTimeout(() => {
      const saveVersion = editVersionRef.current;
      const saveDocumentId = selected.id;
      const snapshot = { title, content, project };
      setSaving(true);
      setError("");
      void updateDocument(selected.id, {
        ...snapshot,
        expectedRevision: baseRevisionRef.current,
      })
        .then(async (updated) => {
          if (selectedDocumentIdRef.current !== saveDocumentId) return;
          baseRevisionRef.current = updated.revision;
          if (editVersionRef.current !== saveVersion) return;
          setDirty(false);
          await onRefresh();
        })
        .catch((cause) =>
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not save this Document.",
          ),
        )
        .finally(() => setSaving(false));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [content, dirty, preview, project, saving, selected?.id, title, onRefresh]);

  async function createNew() {
    const created = await createDocument({
      title: "Untitled",
      project: projects[0]?.name,
    });
    await onRefresh();
    setSelectedId(created.id);
  }

  async function openHistory() {
    if (!selected) return;
    setInspector("history");
    setError("");
    try {
      setRevisions(await getDocumentRevisions(selected.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load revision history.",
      );
    }
  }

  async function retryDocumentAction() {
    if (!actionRun || actionRun.status !== "failed" || actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      const retried = await retrySkillRun(actionRun);
      setActionRun(retried);
      setActionText(retried.original_output ?? "");
      await onRefresh();
    } catch (cause) {
      if (cause instanceof SkillRunFailure) {
        setActionRun(cause.run);
        setActionText(cause.run.original_output ?? "");
        setError(`${cause.message} The failed Run and its Sources are saved.`);
        await onRefresh();
      } else {
        setError(
          cause instanceof Error ? cause.message : "Could not retry this Run.",
        );
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function restoreRevision() {
    if (!selected || !preview || preview.tombstone) return;
    setSaving(true);
    setError("");
    try {
      await restoreDocumentRevision(selected.id, preview.revision);
      await onRefresh();
      setPreview(undefined);
      setRevisions(await getDocumentRevisions(selected.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not restore this revision.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewRevisionDeletion() {
    if (!selected || !preview || preview.current || preview.tombstone) return;
    setRevisionDeletePreview(undefined);
    setRevisionDeleteConfirm("");
    setRevisionNotice("");
    setError("");
    try {
      setRevisionDeletePreview(
        await getDeletionPreview({
          scope: "document_revision",
          documentId: selected.id,
          documentRevision: preview.revision,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not review this revision deletion.",
      );
    }
  }

  async function removeRevision() {
    if (
      !selected ||
      !preview ||
      !revisionDeletePreview ||
      revisionDeleteConfirm !== "DELETE"
    )
      return;
    const deletedRevision = preview.revision;
    setSaving(true);
    setError("");
    try {
      const outcome = await executeDeletion(
        {
          scope: "document_revision",
          documentId: selected.id,
          documentRevision: deletedRevision,
        },
        revisionDeletePreview,
      );
      if (outcome.preview) {
        setRevisionDeletePreview(outcome.preview);
        setRevisionDeleteConfirm("");
        setError(
          "Dependencies changed. Review the updated summary, then delete again.",
        );
        return;
      }
      setRevisionNotice(
        outcome.result?.status === "tombstoned"
          ? `Revision ${deletedRevision} details were deleted. A minimal lineage marker remains for ${revisionDeletePreview.summary.sources} pinned ${revisionDeletePreview.summary.sources === 1 ? "Source" : "Sources"}.`
          : `Revision ${deletedRevision} was permanently deleted.`,
      );
      setPreview(undefined);
      setRevisionDeletePreview(undefined);
      setRevisionDeleteConfirm("");
      setRevisions(await getDocumentRevisions(selected.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not delete this revision.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewDocumentDeletion() {
    if (!selected) return;
    setDeleteOpen(true);
    setDeletePreview(undefined);
    setDeleteConfirm("");
    setError("");
    try {
      setDeletePreview(
        await getDeletionPreview({ scope: "document", ids: [selected.id] }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not review this Document deletion.",
      );
    }
  }

  async function removeDocument() {
    if (!selected || !deletePreview || deleteConfirm !== "DELETE") return;
    setSaving(true);
    setError("");
    try {
      const outcome = await executeDeletion(
        { scope: "document", ids: [selected.id] },
        deletePreview,
      );
      if (outcome.preview) {
        setDeletePreview(outcome.preview);
        setError("Dependencies changed. Review the updated summary, then delete again.");
        return;
      }
      setSelectedId(documents.find((item) => item.id !== selected.id)?.id);
      await onRefresh();
      setDeleteOpen(false);
      setDeletePreview(undefined);
      setDeleteConfirm("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not delete this Document.",
      );
    } finally {
      setSaving(false);
    }
  }

  function exportMarkdown() {
    if (!selected) return;
    const href = URL.createObjectURL(
      new Blob([`# ${title}\n\n${content}`], { type: "text/markdown" }),
    );
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${title.trim() || "untitled"}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }

  async function pinRevisionAsSource() {
    if (!selected) return;
    const revision = preview ?? selected;
    if (preview?.tombstone) return;
    setSaving(true);
    setError("");
    try {
      await createMaterial({
        kind: "derived",
        content: revision.content,
        projects: revision.project ? [revision.project] : [],
        parentIds: revision.context_source_ids ?? revision.source_ids,
        actor: "Logue AI",
        source: {
          title: `${revision.title} · revision ${revision.revision}`,
          document_id: selected.id,
          document_revision: revision.revision,
        },
        requestId: `document-revision:${selected.id}:${revision.revision}`,
      });
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not pin this revision as a Source.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function chooseInput() {
    setTargetPickerOpen(true);
    setTargetBusy(true);
    setTargetError("");
    try {
      const targets = await listExtensionInputTargets();
      setInputTargets(targets);
      if (
        selectedInputTarget &&
        !targets.some((target) => target.id === selectedInputTarget.id)
      )
        setSelectedInputTarget(undefined);
    } catch (cause) {
      setInputTargets([]);
      setSelectedInputTarget(undefined);
      setTargetError(
        cause instanceof Error
          ? cause.message
          : "Could not find an available input.",
      );
    } finally {
      setTargetBusy(false);
    }
  }

  async function sendToInput() {
    if (!selectedInputTarget || targetBusy || preview) return;
    const text = editorRef.current?.innerText.trim() ?? "";
    if (!text) {
      setTargetError("This Document is empty.");
      return;
    }
    setTargetBusy(true);
    setTargetError("");
    try {
      const result = await insertDocumentIntoTarget(
        selectedInputTarget.id,
        text,
      );
      setSelectedInputTarget(result.target);
      setTargetUndo({ target: result.target, token: result.undoToken });
      setTargetPickerOpen(false);
    } catch (cause) {
      setSelectedInputTarget(undefined);
      setTargetUndo(undefined);
      setTargetPickerOpen(true);
      setTargetError(
        cause instanceof Error
          ? cause.message
          : "Could not write to this input. Choose another input or copy the Document.",
      );
      void listExtensionInputTargets()
        .then(setInputTargets)
        .catch(() => setInputTargets([]));
    } finally {
      setTargetBusy(false);
    }
  }

  async function undoTargetInsert() {
    if (!targetUndo || targetBusy) return;
    setTargetBusy(true);
    setTargetError("");
    try {
      await undoDocumentTargetInsert(targetUndo.target.id, targetUndo.token);
      setTargetUndo(undefined);
    } catch (cause) {
      setTargetUndo(undefined);
      setSelectedInputTarget(undefined);
      setTargetPickerOpen(true);
      setTargetError(
        cause instanceof Error
          ? cause.message
          : "This insert can no longer be undone. Choose another input or copy the Document.",
      );
      void listExtensionInputTargets()
        .then(setInputTargets)
        .catch(() => setInputTargets([]));
    } finally {
      setTargetBusy(false);
    }
  }

  async function runSelectionAction() {
    if (!selected || !actionSkillId || actionBusy) return;
    if (!aiReady) {
      setError(
        "Connect a provider in Settings → Models before applying a Skill. This Document remains fully available locally.",
      );
      return;
    }
    const target = editorRef.current;
    const selection = target ? documentSelectionOffsets(target) : undefined;
    const selectedText = selection?.text || target?.innerText || content;
    const start = selection?.start ?? 0;
    const end = selection?.end ?? target?.textContent?.length ?? content.length;
    if (!selectedText.trim()) return;
    setActionBusy(true);
    setError("");
    try {
      const run = await createSkillRun({
        skill_id: actionSkillId,
        instruction: `Apply this Skill to the ${end > start ? "selected text" : "Document"}.`,
        project,
        source_ids: selected.context_source_ids ?? selected.source_ids,
        selection: selectedText,
        auto_search: false,
      });
      setActionRun(run);
      setActionText(run.original_output ?? "");
      setActionSnapshot({
        content,
        revision: selected.revision,
        start: end > start ? start : 0,
        end: end > start ? end : content.length,
      });
    } catch (cause) {
      if (cause instanceof SkillRunFailure) {
        setActionRun(cause.run);
        setActionText(cause.run.original_output ?? "");
        setActionSnapshot({
          content,
          revision: selected.revision,
          start: end > start ? start : 0,
          end: end > start ? end : content.length,
        });
        setError(`${cause.message} The failed Run and its Sources are saved.`);
        await onRefresh();
      } else {
        setError(cause instanceof Error ? cause.message : "Could not run this Skill.");
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function adoptAction(mode: "replace" | "copy" | "keep") {
    if (!actionRun || !actionText.trim() || !actionSnapshot) return;
    const attemptContent = actionText.trim();
    const previousAttempt = actionAdoptionAttempts.current[mode];
    const adoptionId = previousAttempt?.content === attemptContent ? previousAttempt.id : createAdoptionId();
    actionAdoptionAttempts.current[mode] = { id: adoptionId, content: attemptContent };
    setActionBusy(true);
    setError("");
    try {
      if (mode === "replace") {
        if (content !== actionSnapshot.content) {
          throw new Error("The Document changed after this Skill ran. Run it again on the current text.");
        }
        const nextContent = replaceDocumentTextRange(
          actionSnapshot.content,
          title,
          actionSnapshot.start,
          actionSnapshot.end,
          actionText.trim(),
        );
        const result = await saveSkillRunAsDocument(actionRun.id, {
          title,
          content: nextContent,
          documentId: selected.id,
          project,
          sourceIds: selected.source_ids,
          contextSourceIds: selected.context_source_ids,
          expectedRevision: actionSnapshot.revision,
          adoptionId,
          adoptionAction: "replace",
          target: {
            surface: "web-document",
            target_key: `document:${selected.id}`,
          },
        });
        setContent(result.document.content);
        setDirty(false);
        setActionUndo({
          runId: actionRun.id,
          adoptionId,
          documentId: result.document.id,
          expectedRevision: result.document.revision,
          content: result.document.content,
          title: result.document.title,
          project: result.document.project ?? "",
        });
        setActionUndoRetryable(false);
        await onRefresh();
      }
      if (mode === "copy") {
        await navigator.clipboard.writeText(actionText.trim());
        await adoptSkillRun(actionRun.id, actionText.trim(), {
          action: "copy",
          adoptionId,
          target: {
            surface: "clipboard",
            target_key: `document:${selected.id}`,
          },
        });
        await onRefresh();
      }
      if (mode === "keep") {
        await adoptSkillRun(actionRun.id, actionText.trim(), {
          action: "keep",
          adoptionId,
          target: {
            surface: "web-document",
            target_key: `document:${selected.id}`,
          },
        });
        await onRefresh();
        delete actionAdoptionAttempts.current.keep;
        setActionKeepAdoption({
          runId: actionRun.id,
          adoptionId,
          content: attemptContent,
        });
        return;
      }
      delete actionAdoptionAttempts.current[mode];
      setActionRun(undefined);
      setActionSnapshot(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not adopt this result.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function undoActionKeep() {
    if (
      !actionRun ||
      !actionKeepAdoption ||
      actionKeepAdoption.runId !== actionRun.id ||
      actionBusy
    ) return;
    setActionBusy(true);
    setError("");
    try {
      await adoptSkillRun(actionRun.id, actionKeepAdoption.content, {
        action: "undo",
        adoptionId: actionKeepAdoption.adoptionId,
        target: {
          surface: "web-document",
          target_key: `document:${selected.id}`,
        },
      });
      await onRefresh();
      setActionKeepAdoption(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not undo Keep in Logue.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function undoActionReplacement() {
    if (!selected || !actionUndo || actionBusy) return;
    if (dirty || content !== actionUndo.content || title !== actionUndo.title || project !== actionUndo.project) {
      setError("The Document changed after this Skill edit. Undo it from revision history instead.");
      return;
    }
    setActionBusy(true);
    setError("");
    try {
      const result = await saveSkillRunAsDocument(actionUndo.runId, {
        title,
        content,
        documentId: actionUndo.documentId,
        project,
        sourceIds: selected.source_ids,
        contextSourceIds: selected.context_source_ids,
        expectedRevision: actionUndo.expectedRevision,
        adoptionId: actionUndo.adoptionId,
        adoptionAction: "undo",
        target: {
          surface: "web-document",
          target_key: `document:${actionUndo.documentId}`,
        },
      });
      if (isLogueDocumentTombstone(result.document)) {
        throw new Error("Could not restore this Document update.");
      }
      setContent(result.document.content);
      setDirty(false);
      setActionUndo(undefined);
      setActionUndoRetryable(false);
      await onRefresh();
    } catch (cause) {
      const failure = resolveDocumentUndoFailure(
        {
          id: actionUndo.adoptionId,
          documentId: actionUndo.documentId,
          documentRevision: actionUndo.expectedRevision,
          action: "replace",
        },
        cause,
      );
      if (!failure.adoption) setActionUndo(undefined);
      setActionUndoRetryable(failure.retryable);
      setError(failure.message);
    } finally {
      setActionBusy(false);
    }
  }

  const inspectorContent =
    inspector === "history" ? (
      <>
        <header className={inspectorHeaderClass}>
          <div>
            <OriginLabel origin="you" detail="Document lineage" />
            <h2>Revision history</h2>
          </div>
          <IconButton
            label="Close history"
            variant="ghost"
            onClick={() => setInspector(undefined)}
          >
            <PanelRightClose size={17} />
          </IconButton>
        </header>
        <div className={inspectorScrollClass}>
          <p className={leadClass}>
            Restoring creates a new revision. Existing history never changes.
          </p>
          <div className="my-4.5 grid gap-1 [&>button]:flex [&>button]:items-center [&>button]:justify-between [&>button]:gap-3 [&>button]:rounded-md [&>button]:p-[9px] [&>button]:text-left [&>button]:text-muted [&>button:hover]:bg-surface-muted [&_strong]:block [&_strong]:text-[13px] [&_strong]:text-ink-soft [&_small]:mt-[3px] [&_small]:block [&_small]:text-[11px] [&_small]:text-faint">
            {revisions.map((revision) => (
              <button
                type="button"
                key={`${revision.document_id}-${revision.revision}`}
                className={
                  preview?.revision === revision.revision ? "bg-surface-muted" : ""
                }
                onClick={() =>
                  setPreview((current) => {
                    setRevisionDeletePreview(undefined);
                    setRevisionDeleteConfirm("");
                    return revision.current
                      ? undefined
                      : current?.revision === revision.revision
                        ? undefined
                        : revision;
                  })
                }
              >
                <span>
                  <strong>
                    {revision.tombstone
                      ? `Deleted revision ${revision.revision}`
                      : revision.current
                      ? "Current"
                      : `Revision ${revision.revision}`}
                  </strong>
                  <small>
                    {new Date(revision.updated_at).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </span>
                <span>
                  {revision.tombstone
                    ? "Lineage only"
                    : `${(revision.context_source_ids ?? revision.source_ids).length} Sources`}
                </span>
              </button>
            ))}
          </div>
          {revisionNotice ? (
            <div className={metaClass} role="status">
              {revisionNotice}
            </div>
          ) : null}
          {preview ? (
            <div className={cardClass}>
              <OriginLabel
                origin="you"
                detail={
                  preview.tombstone
                    ? `Revision ${preview.revision} · lineage only`
                    : `Revision ${preview.revision} · read only`
                }
              />
              {preview.tombstone ? (
                <>
                  <h3>Revision details deleted</h3>
                  <p>
                    A minimal marker remains because a pinned Source still
                    refers to this revision. The current Document and other
                    revisions are unchanged.
                  </p>
                </>
              ) : (
                <>
                  <h3>{preview.title}</h3>
                  <DocumentContent
                    value={preview.content}
                    title={preview.title}
                    readOnly
                    onCitationClick={(sourceNumber) => {
                      setOpenCitationSourceId(
                        preview.source_ids[sourceNumber - 1],
                      );
                      setInspector("sources");
                    }}
                  />
                  <div className={inlineActionsClass}>
                    <Button
                      variant="primary"
                      disabled={saving}
                      onClick={() => void restoreRevision()}
                    >
                      <RotateCcw size={14} />
                      Restore as new revision
                    </Button>
                    <Button
                      disabled={saving}
                      onClick={() => void reviewRevisionDeletion()}
                    >
                      <Trash2 size={14} />
                      Review deletion
                    </Button>
                  </div>
                  {revisionDeletePreview ? (
                    <div className={dangerCardClass}>
                      <p>
                        {revisionDeletePreview.requires_lineage
                          ? `${revisionDeletePreview.summary.sources} pinned ${revisionDeletePreview.summary.sources === 1 ? "Source keeps" : "Sources keep"} its frozen content. This revision becomes a minimal lineage marker.`
                          : "No saved Source depends on this revision. Its historical details will be permanently deleted."}
                      </p>
                      <p>
                        The current Document and every other frozen revision
                        stay unchanged.
                      </p>
                      <label>
                        Type DELETE to continue
                        <input
                          className={inputClass}
                          value={revisionDeleteConfirm}
                          onChange={(event) =>
                            setRevisionDeleteConfirm(event.target.value)
                          }
                        />
                      </label>
                      <div className={inlineActionsClass}>
                        <Button
                          onClick={() => {
                            setRevisionDeletePreview(undefined);
                            setRevisionDeleteConfirm("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          disabled={
                            saving || revisionDeleteConfirm !== "DELETE"
                          }
                          onClick={() => void removeRevision()}
                        >
                          Delete revision
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </>
    ) : (
      <>
        <header className={inspectorHeaderClass}>
          <div>
            <OriginLabel
              origin="web"
              detail={citationSource ? "Frozen citation" : "Frozen lineage"}
            />
            <h2>
              {citationSource ? materialTitle(citationSource) : "Sources"}
            </h2>
          </div>
          <IconButton
            label="Close sources"
            variant="ghost"
            onClick={() => {
              setInspector(undefined);
              setOpenCitationSourceId(undefined);
            }}
          >
            <PanelRightClose size={17} />
          </IconButton>
        </header>
        <div className={inspectorScrollClass}>
          <div className={sourceListClass}>
            {(citationSource ? [citationSource] : sources).map(
              (source, index) => (
                <article className={sourceBundleClass} key={source.id}>
                  <OriginLabel
                    origin={sourceOrigin(source)}
                    detail={
                      citationSource ? "Source used" : `Source ${index + 1}`
                    }
                  />
                  <h3>{materialTitle(source)}</h3>
                  <p>{contentSummary(source.content)}</p>
                  {source.source?.url ? (
                    <a
                      className={sourceToggleClass}
                      href={source.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original
                    </a>
                  ) : null}
                </article>
              ),
            )}
            {!sources.length ? (
              <div className={cardClass}>
                <p>This Document has no frozen Sources yet.</p>
              </div>
            ) : null}
          </div>
        </div>
      </>
    );

  return (
    <AppShell
      route="documents"
      projectName={selected?.project}
      onRouteChange={onRoute}
      topbarActions={
        <>
          <Button size="sm" onClick={() => void createNew()}>
            <FilePlus2 size={15} />
            New
          </Button>
          {selected ? (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setOpenCitationSourceId(undefined);
                  setInspector("sources");
                }}
              >
                Sources
              </Button>
              <Button size="sm" onClick={() => void openHistory()}>
                <History size={15} />
                History
              </Button>
              <details className={documentMenuClass}>
                <summary aria-label="More Document actions" title="More Document actions">
                  <MoreHorizontal size={17} aria-hidden="true" />
                </summary>
                <div role="menu">
                  <button type="button" role="menuitem" onClick={exportMarkdown}>
                    <Download size={14} />
                    Export Markdown
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={saving || Boolean(preview?.tombstone)}
                    onClick={() => void pinRevisionAsSource()}
                  >
                    <Sparkles size={14} />
                    Pin revision as Source
                  </button>
                </div>
              </details>
            </>
          ) : null}
        </>
      }
      inspectorOpen={Boolean(inspector)}
      onInspectorOpenChange={(open) => {
        if (!open) {
          setInspector(undefined);
          setOpenCitationSourceId(undefined);
        }
      }}
      inspector={inspector ? inspectorContent : undefined}
    >
      <ProductStatus
        message={
          actionBusy
            ? actionRun?.status === "failed"
              ? "Retrying Document action…"
              : "Running Document action…"
            : targetBusy
              ? targetUndo
                ? "Undoing external insert…"
                : "Sending Document to the selected input…"
              : actionRun?.status === "complete"
                ? "Document action result ready."
                : undefined
        }
      />
      <div
        className="grid min-h-0 min-w-0 flex-1"
        style={{ gridTemplateColumns: `${documentListWidth}px 1px minmax(0, 1fr)` }}
      >
        <aside className="scroll-surface min-h-0 overflow-auto border-r border-line bg-panel px-2 pt-3 pb-7 [&>button]:block [&>button]:w-full [&>button]:rounded-md [&>button]:px-2.5 [&>button]:py-[9px] [&>button]:text-left [&>button:hover]:bg-surface-muted [&>button_strong]:block [&>button_strong]:truncate [&>button_strong]:text-[13px] [&>button_strong]:font-[610] [&>button_strong]:text-ink-soft [&>button_span]:mt-[3px] [&>button_span]:block [&>button_span]:truncate [&>button_span]:text-[11px] [&>button_span]:text-faint [&>button_small]:mt-[3px] [&>button_small]:block [&>button_small]:truncate [&>button_small]:text-[11px] [&>button_small]:text-faint">
          <div className="flex items-center justify-between px-2.5 pt-2 pb-2.5 text-xs text-muted">
            <strong>Documents</strong>
            <span>{loading ? "…" : documents.length}</span>
          </div>
          {documents.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === selected?.id ? "bg-surface-muted" : ""}
              onClick={() => setSelectedId(item.id)}
            >
              <strong>{item.title}</strong>
              <span>{item.project || "No Project"}</span>
            </button>
          ))}
        </aside>
        <PanelResizer
          label="Resize Document list"
          value={documentListWidth}
          min={180}
          max={360}
          defaultValue={220}
          onChange={setDocumentListWidth}
          className="z-5"
        />
        <div
          ref={editorScrollRef}
          className={scrollClass}
          onScroll={(event) => {
            if (selected?.id)
              saveDocumentPosition(selected.id, {
                scrollTop: event.currentTarget.scrollTop,
              });
          }}
        >
          {selected ? (
            <article className={axisClass("reading")}>
              <div className={eyebrowClass}>
                {preview
                  ? `Revision ${preview.revision} · read only`
                  : saving
                    ? "Saving…"
                    : dirty
                      ? "Edited"
                      : `Revision ${selected.revision}`}
              </div>
              <input
                className="mb-4.5 w-full border-0 bg-transparent text-[clamp(34px,3vw,42px)] leading-[1.12] font-[690] tracking-[-0.045em] text-ink outline-0"
                aria-label="Document title"
                value={preview?.title ?? title}
                disabled={Boolean(preview)}
                onChange={(event) => {
                  setTitle(event.target.value);
                  markEdited();
                }}
              />
              <div className="mb-5.5 grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-2.5 @max-[720px]:grid-cols-[minmax(0,1fr)] @max-[720px]:items-start">
                <div className="flex min-w-0 items-center gap-1.5">
                  <select
                  className={toolbarSelectClass}
                  aria-label="Project"
                  value={preview?.project ?? project}
                  disabled={Boolean(preview)}
                  onChange={(event) => {
                    setProject(event.target.value);
                    markEdited();
                  }}
                >
                  <option value="">No Project</option>
                  {projects.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                  </select>
                  <div className="inline-flex min-w-0 items-center gap-[5px]">
                    <select
                      className={toolbarSelectClass}
                      aria-label="Document action"
                      value={actionSkillId}
                      disabled={Boolean(preview) || actionBusy}
                      onChange={(event) => setActionSkillId(event.target.value)}
                    >
                      {skills
                        .filter(
                          (skill) =>
                            skill.enabled &&
                            skill.task === "generate" &&
                            skill.surfaces.includes("web"),
                        )
                        .map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={Boolean(preview) || !actionSkillId || actionBusy}
                      onClick={() => void runSelectionAction()}
                    >
                      <Sparkles size={14} />
                      Apply
                    </Button>
                  </div>
                </div>
                <div className="flex min-w-0 items-center justify-start gap-1.5 min-[900px]:min-w-max min-[900px]:justify-end">
                {actionUndo?.documentId === selected.id && actionUndo.content === content && actionUndo.title === title && actionUndo.project === project ? (
                  <Button
                    size="sm"
                    disabled={Boolean(preview) || actionBusy || dirty}
                    onClick={() => void undoActionReplacement()}
                  >
                    <RotateCcw size={14} />
                    {actionUndoRetryable ? "Retry Undo" : "Undo Skill edit"}
                  </Button>
                ) : null}
                {!preview && editorHistory.undo ? (
                  <IconButton
                    label="Undo edit"
                    variant="ghost"
                    onClick={() => applyEditorHistory("undo")}
                  >
                    <Undo2 size={15} />
                  </IconButton>
                ) : null}
                {!preview && editorHistory.redo ? (
                  <IconButton
                    label="Redo edit"
                    variant="ghost"
                    onClick={() => applyEditorHistory("redo")}
                  >
                    <Redo2 size={15} />
                  </IconButton>
                ) : null}
                {targetUndo ? (
                  <>
                    <Button
                      size="sm"
                      disabled={targetBusy}
                      onClick={() => void undoTargetInsert()}
                    >
                      <RotateCcw size={14} />
                      Undo send
                    </Button>
                    <Button size="sm" onClick={() => setTargetUndo(undefined)}>
                      Done
                    </Button>
                  </>
                ) : selectedInputTarget ? (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={targetBusy || Boolean(preview)}
                      onClick={() => void sendToInput()}
                    >
                      <Send size={14} />
                      {targetBusy
                        ? "Sending…"
                        : `Send to ${selectedInputTarget.label}`}
                    </Button>
                  </>
                ) : (
                  null
                )}
                  <details className={documentMenuClass}>
                    <summary aria-label="More Document actions" title="More Document actions">
                      <MoreHorizontal size={17} aria-hidden="true" />
                    </summary>
                    <div role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          void navigator.clipboard.writeText(
                            editorRef.current?.innerText || preview?.content || content,
                          );
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                      >
                        <Copy size={14} />
                        Copy Document
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={targetBusy || Boolean(preview)}
                        onClick={(event) => {
                          void chooseInput();
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                      >
                        <Send size={14} />
                        {selectedInputTarget ? "Change input" : "Send to input…"}
                      </button>
                      <button className="!text-danger hover:!bg-[#f9ece9]" type="button" role="menuitem" onClick={() => void reviewDocumentDeletion()} disabled={Boolean(preview)}>
                        <Trash2 size={14} />
                        Delete Document
                      </button>
                    </div>
                  </details>
                </div>
              </div>
              {targetPickerOpen ? (
                <section
                  className="mt-[-10px] mb-5.5 rounded-lg border border-line bg-surface p-3"
                  aria-label="Choose an input"
                >
                  <div className={panelHeadingClass}>
                    <h2>Choose an input</h2>
                    <IconButton
                      label="Close input picker"
                      variant="ghost"
                      onClick={() => setTargetPickerOpen(false)}
                    >
                      <X size={15} />
                    </IconButton>
                  </div>
                  {targetBusy ? (
                    <div className={metaClass}>
                      Finding inputs in Chrome…
                    </div>
                  ) : inputTargets.length ? (
                    <div className="flex flex-col gap-0.5 [&>button]:grid [&>button]:min-h-[42px] [&>button]:w-full [&>button]:grid-cols-[minmax(0,1fr)_auto] [&>button]:items-center [&>button]:gap-x-3 [&>button]:gap-y-0.5 [&>button]:rounded-sm [&>button]:px-[9px] [&>button]:py-[7px] [&>button]:text-left [&>button]:text-ink [&>button:hover]:bg-surface-muted [&>button:focus-visible]:bg-surface-muted [&>button>span]:col-span-full [&_span]:truncate [&_span]:text-muted [&_small]:truncate [&_small]:text-muted">
                      {inputTargets.map((target) => (
                        <button
                          type="button"
                          key={target.id}
                          onClick={() => {
                            setSelectedInputTarget(target);
                            setTargetUndo(undefined);
                            setTargetPickerOpen(false);
                            setTargetError("");
                          }}
                        >
                          <strong>{target.label}</strong>
                          <span>{target.pageTitle}</span>
                          <small>{target.domain}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={cardClass}>
                      <p>
                        Focus the input you want in Chrome, then choose again.
                      </p>
                      <Button size="sm" onClick={() => void chooseInput()}>
                        Find inputs again
                      </Button>
                    </div>
                  )}
                </section>
              ) : null}
              {targetUndo ? (
                <div className="mt-[-10px] mb-4.5 text-xs text-faint">
                  Sent to {targetUndo.target.label} in{" "}
                  {targetUndo.target.pageTitle}. Undo is available until the
                  input changes.
                </div>
              ) : null}
              {targetError ? (
                <div className={warningBarClass} role="alert">
                  {targetError}
                </div>
              ) : null}
              {preview ? (
                <DocumentContent
                  value={preview.content}
                  title={preview.title}
                  readOnly
                  onCitationClick={(sourceNumber) => {
                    setOpenCitationSourceId(
                      preview.source_ids[sourceNumber - 1],
                    );
                    setInspector("sources");
                  }}
                />
              ) : (
                <DocumentContent
                  value={content}
                  title={title}
                  editorRef={editorRef}
                  onChange={(value) => {
                    setContent(value);
                    markEdited();
                    window.requestAnimationFrame(refreshEditorHistory);
                  }}
                  onCaretChange={(caret) => {
                    if (selected?.id)
                      saveDocumentPosition(selected.id, { caret });
                    refreshEditorHistory();
                  }}
                />
              )}
              {actionRun ? (
                <section className="rounded-lg border border-line bg-surface p-3.5 [&_textarea]:min-h-[190px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:p-0 [&_textarea]:text-[15px] [&_textarea]:leading-[1.62] [&_textarea]:text-ink [&_textarea]:outline-0">
                  <OriginLabel
                    origin="ai"
                    detail={`${actionRun.skill_name} · Candidate`}
                  />
                  <textarea
                    className={textareaClass}
                    aria-label="Document action result"
                    value={actionText}
                    onChange={(event) => setActionText(event.target.value)}
                  />
                  <div className={`${inlineActionsClass} justify-end`}>
                    {actionRun.status === "failed" ? (
                      <Button
                        variant="primary"
                        disabled={actionBusy}
                        onClick={() => void retryDocumentAction()}
                      >
                        {actionBusy ? "Retrying…" : "Retry"}
                      </Button>
                    ) : null}
                    <Button
                      disabled={actionBusy}
                      onClick={() => { setActionRun(undefined); setActionSnapshot(undefined); }}
                    >
                      Cancel
                    </Button>
                    {actionRun.status === "complete" ? (
                      <>
                        <Button
                          disabled={actionBusy || !actionText.trim()}
                          onClick={() => void adoptAction("copy")}
                        >
                          <Copy size={14} />
                          Copy
                        </Button>
                        <Button
                          disabled={
                            actionBusy ||
                            (actionKeepAdoption?.runId !== actionRun.id &&
                              !actionText.trim())
                          }
                          onClick={() =>
                            void (
                              actionKeepAdoption?.runId === actionRun.id
                                ? undoActionKeep()
                                : adoptAction("keep")
                            )
                          }
                        >
                          {actionKeepAdoption?.runId === actionRun.id ? (
                            <RotateCcw size={14} />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          {actionKeepAdoption?.runId === actionRun.id
                            ? "Undo Keep in Logue"
                            : "Keep in Logue"}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={actionBusy || !actionText.trim()}
                          onClick={() => void adoptAction("replace")}
                        >
                          Replace selection
                        </Button>
                      </>
                    ) : null}
                  </div>
                </section>
              ) : null}
              {error ? (
                <div className={warningBarClass} role="alert">
                  {error}
                </div>
              ) : null}
              <div className={contextSummaryClass}>
                <span>
                  <Clock3 size={14} />
                  {
                    (
                      preview?.context_source_ids ??
                      preview?.source_ids ??
                      selected.context_source_ids ??
                      selected.source_ids
                    ).length
                  }{" "}
                  frozen Sources
                </span>
                <button
                  className={sourceToggleClass}
                  onClick={() => {
                    setOpenCitationSourceId(undefined);
                    setInspector("sources");
                  }}
                >
                  Review citations
                </button>
              </div>
              {deleteOpen ? (
                <div className={dangerCardClass}>
                  <p>
                    Delete this Document and its revision history? Saved Sources
                    remain in the Library.
                  </p>
                  <p>
                    {deletePreview
                      ? `${deletePreview.summary.revisions} revisions · ${deletePreview.summary.runs} linked Runs keep a minimal Document marker.`
                      : "Preparing dependencies…"}
                  </p>
                  <label>
                    Type DELETE to continue
                    <input
                      className={inputClass}
                      value={deleteConfirm}
                      onChange={(event) => setDeleteConfirm(event.target.value)}
                    />
                  </label>
                  <div className={inlineActionsClass}>
                    <Button
                      onClick={() => {
                        setDeleteOpen(false);
                        setDeletePreview(undefined);
                        setDeleteConfirm("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      disabled={
                        saving || !deletePreview || deleteConfirm !== "DELETE"
                      }
                      onClick={() => void removeDocument()}
                    >
                      Delete Document
                    </Button>
                  </div>
                </div>
              ) : null}
            </article>
          ) : loading ? (
            <div className={axisClass("list")} aria-live="polite">
              <div className={headingCopyClass}>
                <h1>Documents</h1>
              </div>
              <div className={cardClass}>
                <p>Loading Documents…</p>
              </div>
            </div>
          ) : (
            <div className={axisClass("list")}>
              <div className={headingCopyClass}>
                <h1>Documents</h1>
                <p>Long-lived outputs with frozen source history.</p>
              </div>
              <div className={cardClass}>
                <p>
                  Create a Document or adopt a sourced Draft from a Project.
                </p>
                <Button variant="primary" onClick={() => void createNew()}>
                  New Document
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
