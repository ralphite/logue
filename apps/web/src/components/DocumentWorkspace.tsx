import {
  BookOpenText,
  ChevronDown,
  FilePlus2,
  FileText,
  FolderKanban,
  ArrowUpRight,
  Link2,
  MoreHorizontal,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { OverlayMenu, SelectionSkillMenu, captureStableEditableSelection, normalizeSelectionSkillReplacement, replaceSelectionIfUnchanged, saveSelectionSkillHistory, selectionSkillDismissalStillApplies, selectionSkillEligibility, type EditableSelectionSnapshot, type Material, type SelectionSkillApplyTransaction } from "@logue/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSerialTaskQueue } from "../documentSaveQueue";
import { groupIdenticalMaterials } from "../materialGroups";
import { matchesMaterialSearchText, orderMaterialSearchResults, useDocumentSearch, useMaterialSearch } from "../materialSearch";
import {
  createDocument,
  deleteDocument,
  getDocuments,
  generateDocument,
  updateDocument,
  type LogueDocument,
} from "../api";
import { adoptSkillRun, createSkillRun, getSkills, type LogueSkill } from "../skillApi";
import { MaterialGroupAddList, MaterialGroupPicker } from "./MaterialGroupPicker";
import { PanelResizer, usePersistentPanelSize } from "./PanelResizer";
import { SearchPending } from "./SearchPending";
import { readingColumnClass } from "./layout";

type SaveState = "saved" | "dirty" | "saving" | "error";

interface DocumentSnapshot {
  id: string;
  title: string;
  content: string;
  project: string;
  sourceIds: string[];
  version: number;
}

const editorTags = new Set(["P", "DIV", "H1", "H2", "H3", "UL", "OL", "LI", "BR", "BLOCKQUOTE", "STRONG", "EM", "CODE", "MARK"]);

function citationPattern(flags = "g") {
  return new RegExp("\\[Source (\\d+)\\]", flags);
}

function citationNumber(value?: string | null) {
  return value?.match(/Source (\d+)/)?.[1];
}

function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function availableSourcePanelWidth(workspaceWidth: number, documentListWidth: number) {
  return Math.max(240, Math.floor(workspaceWidth - documentListWidth - 560 - 1));
}

export function defaultSourcePanelWidth(workspaceWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(440, Math.round(workspaceWidth * 0.5)));
}

function escapeHTML(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function inlineMarkdown(value: string) {
  return escapeHTML(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(citationPattern(), "<mark>[Source $1]</mark>");
}

function markdownToEditorHTML(value: string, title: string) {
  const lines = value.split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | undefined;
  let firstContentSeen = false;
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = undefined;
  };
  for (const line of lines) {
    const text = line.trimEnd();
    if (!text) {
      closeList();
      continue;
    }
    if (!firstContentSeen) {
      firstContentSeen = true;
      if (text.startsWith("# ") && text.slice(2).trim() === title.trim()) continue;
    }
    if (text.startsWith("### ")) {
      closeList(); html.push(`<h3>${inlineMarkdown(text.slice(4))}</h3>`);
    } else if (text.startsWith("## ")) {
      closeList(); html.push(`<h2>${inlineMarkdown(text.slice(3))}</h2>`);
    } else if (text.startsWith("# ")) {
      closeList(); html.push(`<h1>${inlineMarkdown(text.slice(2))}</h1>`);
    } else if (/^[-*] /.test(text)) {
      if (list !== "ul") { closeList(); list = "ul"; html.push("<ul>"); }
      html.push(`<li>${inlineMarkdown(text.slice(2))}</li>`);
    } else if (/^\d+\. /.test(text)) {
      if (list !== "ol") { closeList(); list = "ol"; html.push("<ol>"); }
      html.push(`<li>${inlineMarkdown(text.replace(/^\d+\. /, ""))}</li>`);
    } else if (text.startsWith("> ")) {
      closeList(); html.push(`<blockquote>${inlineMarkdown(text.slice(2))}</blockquote>`);
    } else {
      closeList();
      html.push(`<p>${inlineMarkdown(text)}</p>`);
    }
  }
  closeList();
  return html.join("") || "<p><br></p>";
}

function sanitizeEditorHTML(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child instanceof HTMLElement) {
        if (!editorTags.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent ?? ""));
          continue;
        }
        for (const attribute of Array.from(child.attributes)) child.removeAttribute(attribute.name);
      }
      clean(child);
    }
  };
  clean(template.content);
  return template.innerHTML;
}

function withoutDuplicateTitle(value: string, title: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const first = template.content.firstElementChild;
  if (first?.tagName === "H1" && first.textContent?.trim() === title.trim()) first.remove();
  return template.innerHTML;
}

function toEditorHTML(value: string, title: string) {
  const html = value.trimStart().startsWith("<") ? sanitizeEditorHTML(value) : markdownToEditorHTML(value, title);
  return withoutDuplicateTitle(html.replace(citationPattern(), "[Source $1]"), title);
}

export function hasCitationNumber(value: string, sourceNumber: number) {
  return new RegExp(`\\[Source ${sourceNumber}\\]`).test(value);
}

export function renumberCitationsAfterRemoval(value: string, removedSourceNumber: number) {
  return value.replace(citationPattern(), (match, rawNumber: string) => {
    const sourceNumber = Number(rawNumber);
    return sourceNumber > removedSourceNumber ? `[Source ${sourceNumber - 1}]` : match;
  });
}

export function reconcileDocumentCitations(value: string, sourceIds: string[]) {
  const cited = new Set<number>();
  for (const match of value.matchAll(citationPattern())) {
    const sourceNumber = Number(match[1]);
    if (sourceNumber >= 1 && sourceNumber <= sourceIds.length) cited.add(sourceNumber);
  }
  const nextSourceIds: string[] = [];
  const renumber = new Map<number, number>();
  sourceIds.forEach((id, index) => {
    const sourceNumber = index + 1;
    if (!cited.has(sourceNumber)) return;
    nextSourceIds.push(id);
    renumber.set(sourceNumber, nextSourceIds.length);
  });
  const content = value
    .replace(citationPattern(), (_match, rawNumber: string) => {
      const nextNumber = renumber.get(Number(rawNumber));
      return nextNumber ? `[Source ${nextNumber}]` : "";
    })
    .replace(/<mark>\s*<\/mark>/gi, "")
    .replace(/(?:[ \t]|&nbsp;)+([\uFF0C\u3002\uFF1B\uFF1A\u3001\uFF01\uFF1F,.!?;:])/g, "$1")
    .trim();
  return { content, sourceIds: nextSourceIds };
}

export function removeSourceCitation(value: string, sourceIds: string[], id: string) {
  const sourceIndex = sourceIds.indexOf(id);
  if (sourceIndex < 0) return { content: value, sourceIds };
  const sourceNumber = sourceIndex + 1;
  const content = value
    .replace(citationPattern(), (match, rawNumber: string) => {
      const number = Number(rawNumber);
      if (number === sourceNumber) return "";
      return number > sourceNumber ? `[Source ${number - 1}]` : match;
    })
    .replace(/<mark>\s*<\/mark>/gi, "")
    .replace(/(?:[ \t]|&nbsp;)+([\uFF0C\u3002\uFF1B\uFF1A\u3001\uFF01\uFF1F,.!?;:])/g, "$1")
    .trim();
  return { content, sourceIds: sourceIds.filter((sourceId) => sourceId !== id) };
}

function caretOffsetWithin(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) return undefined;
  const before = range.cloneRange();
  before.selectNodeContents(element);
  before.setEnd(range.endContainer, range.endOffset);
  return before.toString().length;
}

function restoreCaretOffset(element: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function relativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sourceLabel(material: Material) {
  return material.source?.title || material.source?.domain || material.content.slice(0, 44);
}

function sourceOrigin(material: Material) {
  const domain = material.source?.domain;
  if (!domain) return material.actor || "User input";
  if (domain === "127.0.0.1" || domain === "localhost") return "Local Logue page";
  return domain;
}

function sourceMeta(material: Material) {
  const date = new Date(material.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return [material.projects[0], sourceOrigin(material), date].filter(Boolean).join(" / ");
}

function sourceExcerpt(material: Material) {
  const label = sourceLabel(material).trim();
  const content = material.content.trim();
  if (content && content !== label) return content;
  return material.source?.selection?.trim() || "";
}

export function ViewWorkspace({
  materials,
  initialDocumentId,
  initialProject,
  onSelectedDocumentChange,
  onOpenMaterials,
  onLeaveGuardChange,
  onOpenGenerate,
  onManageSkills,
  showDocumentSidebar = true,
  documents: suppliedDocuments,
  documentsLoading = false,
  onDocumentsChange,
}: {
  materials: Material[];
  initialDocumentId?: string;
  initialProject?: string;
  onSelectedDocumentChange: (documentId?: string, replace?: boolean) => void;
  onOpenMaterials: () => void;
  onLeaveGuardChange?: (guard?: () => Promise<boolean>) => void;
  onOpenGenerate?: () => void;
  onManageSkills?: () => void;
  showDocumentSidebar?: boolean;
  documents?: LogueDocument[];
  documentsLoading?: boolean;
  onDocumentsChange?: (documents: LogueDocument[]) => void;
}) {
  const [documents, setDocuments] = useState<LogueDocument[]>(() => suppliedDocuments ?? []);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [project, setProject] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [sourcePanelOpen, setSourcePanelOpen] = useState(() => window.innerWidth > 900);
  const [activeSourceId, setActiveSourceId] = useState<string>();
  const [sourceScope, setSourceScope] = useState<"project" | "all">("all");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceMessage, setSourceMessage] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generationTitle, setGenerationTitle] = useState("");
  const [generationProject, setGenerationProject] = useState("");
  const [generationInstruction, setGenerationInstruction] = useState("Summarize the key conclusions, evidence, and next steps while preserving source citations.");
  const [generationSourceIds, setGenerationSourceIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string>();
  const [selectionSnapshot, setSelectionSnapshot] = useState<EditableSelectionSnapshot>();
  const [selectionSkills, setSelectionSkills] = useState<LogueSkill[]>([]);
  const [selectionUndo, setSelectionUndo] = useState<{
    documentId: string;
    beforeContent: string;
    afterContent: string;
    sourceIds: string[];
  }>();
  const [selectionSkillNotice, setSelectionSkillNotice] = useState<{
    message: string;
    history?: SelectionSkillApplyTransaction;
  }>();
  const [focusSelectionSkillTrigger, setFocusSelectionSkillTrigger] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(!initialDocumentId);
  const effectiveMobileListOpen = showDocumentSidebar && mobileListOpen;
  const { size: documentListWidth, setSize: setDocumentListWidth } = usePersistentPanelSize({
    storageKey: "logue.panel.documents.width",
    defaultSize: 252,
    min: 200,
    max: 360,
  });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(() => window.innerWidth);
  const sourcePanelMaxWidth = availableSourcePanelWidth(workspaceWidth, showDocumentSidebar ? documentListWidth : 0);
  const { size: sourcePanelWidth, setSize: setSourcePanelWidth } = usePersistentPanelSize({
    storageKey: "logue.panel.sources.width.v4",
    defaultSize: defaultSourcePanelWidth(workspaceWidth, sourcePanelMaxWidth),
    min: 240,
    max: sourcePanelMaxWidth,
  });
  const loadedRef = useRef<string | undefined>(undefined);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorSelectionRef = useRef<Range | undefined>(undefined);
  const selectionSnapshotRef = useRef<EditableSelectionSnapshot | undefined>(undefined);
  const dismissedSelectionSnapshotRef = useRef<EditableSelectionSnapshot | undefined>(undefined);
  const selectionRefreshFrameRef = useRef<number | undefined>(undefined);
  const selectionDocumentRef = useRef<{ id: string } | undefined>(undefined);
  const selectionSkillsLoadedRef = useRef(false);
  const selectionUndoTimerRef = useRef<number | undefined>(undefined);
  const selectionNoticeTimerRef = useRef<number | undefined>(undefined);
  const documentsRef = useRef(documents);
  const dirtyVersionRef = useRef(0);
  const selectedIdRef = useRef<string | undefined>(undefined);
  const latestSnapshotRef = useRef<DocumentSnapshot | undefined>(undefined);
  const revisionByDocumentRef = useRef(new Map<string, number>());
  const saveQueueRef = useRef(createSerialTaskQueue());
  const saveByVersionRef = useRef(new Map<string, Promise<boolean>>());

  documentsRef.current = documents;
  selectedIdRef.current = selectedId;
  latestSnapshotRef.current = selectedId ? {
    id: selectedId,
    title,
    content,
    project,
    sourceIds: [...sourceIds],
    version: dirtyVersionRef.current,
  } : undefined;

  const setDocumentCollection = useCallback((next: LogueDocument[] | ((current: LogueDocument[]) => LogueDocument[])) => {
    const value = typeof next === "function" ? next(documentsRef.current) : next;
    documentsRef.current = value;
    setDocuments(value);
    onDocumentsChange?.(value);
  }, [onDocumentsChange]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    const measure = () => setWorkspaceWidth(workspace?.clientWidth || window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && workspace) {
      observer = new ResizeObserver(measure);
      observer.observe(workspace);
    }
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (suppliedDocuments) {
      revisionByDocumentRef.current = new Map(suppliedDocuments.map((item) => [item.id, item.revision]));
      documentsRef.current = suppliedDocuments;
      setDocuments(suppliedDocuments);
      setLoadError(undefined);
      setLoading(documentsLoading);
      return;
    }
    let cancelled = false;
    let retryTimer: number | undefined;
    const load = async (attempt: number) => {
      try {
        const items = await getDocuments();
        if (cancelled) return;
        revisionByDocumentRef.current = new Map(items.map((item) => [item.id, item.revision]));
        setDocumentCollection(items);
        setLoadError(undefined);
        setLoading(false);
      } catch (cause) {
        if (cancelled) return;
        if (attempt < 8) {
          retryTimer = window.setTimeout(() => void load(attempt + 1), Math.min(1200, 250 + attempt * 150));
          return;
        }
        setLoadError(cause instanceof Error ? cause.message : "Unable to load documents");
        setLoading(false);
      }
    };
    void load(0);
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [documentsLoading, setDocumentCollection, suppliedDocuments]);

  useEffect(() => {
    if (loading) return;
    const requested = initialDocumentId
      ? documents.find((item) => item.id === initialDocumentId)
      : initialProject
        ? documents.find((item) => item.project === initialProject)
        : undefined;
    const firstUseful = documents.find((item) => item.title.trim() !== "Untitled" || item.content.trim());
    const nextId = requested?.id ?? firstUseful?.id ?? documents[0]?.id;
    if (selectedId !== nextId) {
      loadedRef.current = undefined;
      selectedIdRef.current = nextId;
      setSelectedId(nextId);
    }
    if (initialDocumentId !== nextId) onSelectedDocumentChange(nextId, true);
  }, [documents, initialDocumentId, initialProject, loading, onSelectedDocumentChange, selectedId]);

  const selected = documents.find((document) => document.id === selectedId);

  useEffect(() => {
    if (!selected || loadedRef.current === selected.id) return;
    loadedRef.current = selected.id;
    setTitle(selected.title);
    setContent(selected.content);
    setProject(selected.project ?? "");
    setSourceIds(selected.source_ids ?? []);
    setSourceScope(selected.project ? "project" : "all");
    setSaveState("saved");
    dirtyVersionRef.current = 0;
    editorSelectionRef.current = undefined;
    selectionSnapshotRef.current = undefined;
    selectionDocumentRef.current = undefined;
    setSelectionSnapshot(undefined);
    setSelectionUndo(undefined);
    setSelectionSkillNotice(undefined);
  }, [selected]);

  useEffect(() => () => {
    if (selectionUndoTimerRef.current) window.clearTimeout(selectionUndoTimerRef.current);
    if (selectionNoticeTimerRef.current) window.clearTimeout(selectionNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    if (selected) document.title = `${title.trim() || "Untitled"} | Logue`;
  }, [selected, title]);

  useEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [selected?.id, title]);

  useEffect(() => {
    if (!selected || !editorRef.current) return;
    editorRef.current.innerHTML = toEditorHTML(selected.content, selected.title);
  }, [selected?.id]);

  const enqueueSave = useCallback((snapshot: DocumentSnapshot) => {
    const saveKey = `${snapshot.id}:${snapshot.version}`;
    const existing = saveByVersionRef.current.get(saveKey);
    if (existing) return existing;

    if (selectedIdRef.current === snapshot.id) setSaveState("saving");
    const pending = saveQueueRef.current(async () => {
      const expectedRevision = revisionByDocumentRef.current.get(snapshot.id);
      if (expectedRevision === undefined) throw new Error("Document version is missing. Reload and try again.");
      const updated = await updateDocument(snapshot.id, {
        title: snapshot.title,
        content: snapshot.content,
        project: snapshot.project,
        sourceIds: snapshot.sourceIds,
        expectedRevision,
      });
      revisionByDocumentRef.current.set(updated.id, updated.revision);
      setDocumentCollection((current) =>
        [updated, ...current.filter((document) => document.id !== updated.id)].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      );
      if (selectedIdRef.current === snapshot.id) {
        if (dirtyVersionRef.current === snapshot.version) {
          setTitle(updated.title);
          setContent(updated.content);
          setProject(updated.project ?? "");
          setSourceIds(updated.source_ids ?? []);
          if (editorRef.current && sanitizeEditorHTML(editorRef.current.innerHTML) !== updated.content) {
            editorRef.current.innerHTML = toEditorHTML(updated.content, updated.title);
          }
          setSaveState("saved");
        } else {
          setSaveState("dirty");
        }
      }
      return true;
    })
      .catch(() => {
        if (selectedIdRef.current === snapshot.id) {
          setSaveState(dirtyVersionRef.current === snapshot.version ? "error" : "dirty");
        }
        return false;
      })
      .finally(() => saveByVersionRef.current.delete(saveKey));
    saveByVersionRef.current.set(saveKey, pending);
    return pending;
  }, [setDocumentCollection]);

  useEffect(() => {
    if (!selected || loadedRef.current !== selected.id || saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      const snapshot = latestSnapshotRef.current;
      if (snapshot?.id === selected.id) void enqueueSave(snapshot);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [content, enqueueSave, project, saveState, selected, sourceIds, title]);

  const documentSearch = useDocumentSearch(query, documents);
  const filteredDocuments = useMemo(() => {
    if (!documentSearch.normalizedQuery) return documents;
    if (documentSearch.result) {
      const documentsByID = new Map(documents.map((document) => [document.id, document]));
      return documentSearch.result.matches
        .map((match) => documentsByID.get(match.id))
        .filter((document): document is LogueDocument => Boolean(document));
    }
    return documents.filter((document) =>
      [document.title, document.content, document.project]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(documentSearch.normalizedQuery)),
    );
  }, [documentSearch.normalizedQuery, documentSearch.result, documents]);
  const documentSearchReason = useCallback((document: LogueDocument) => {
    const match = documentSearch.matches.get(document.id);
    return match?.match === "related" ? match.reason : "";
  }, [documentSearch.matches]);

  const projects = useMemo(
    () => Array.from(new Set(materials.flatMap((material) => material.projects))).sort(),
    [materials],
  );

  const linkedSources = sourceIds
    .map((id) => materials.find((material) => material.id === id))
    .filter((material): material is Material => Boolean(material));

  const sourceCandidates = useMemo(() => materials.filter((material) => {
      if (sourceIds.includes(material.id)) return false;
      if (sourceScope === "project" && project && !material.projects.includes(project)) return false;
      return true;
    }), [materials, project, sourceIds, sourceScope]);
  const sourceSearch = useMaterialSearch(sourceQuery, sourceCandidates);
  const availableSources = useMemo(() => {
    if (!sourceSearch.normalizedQuery) return sourceCandidates;
    if (sourceSearch.result) return orderMaterialSearchResults(sourceCandidates, sourceSearch.result);
    return sourceCandidates.filter((material) => matchesMaterialSearchText(material, sourceSearch.normalizedQuery));
  }, [sourceCandidates, sourceSearch.normalizedQuery, sourceSearch.result]);
  const availableSourceGroupCount = useMemo(() => groupIdenticalMaterials(availableSources).length, [availableSources]);
  const sourceSearchReason = useCallback((material: Material) => {
    const match = sourceSearch.matches.get(material.id);
    return match?.match === "related" ? match.reason : "";
  }, [sourceSearch.matches]);

  function markDirty() {
    dirtyVersionRef.current += 1;
    setSaveState("dirty");
  }

  const flushCurrentDocument = useCallback(async () => {
    const snapshot = latestSnapshotRef.current;
    if (!snapshot || (saveState === "saved" && saveByVersionRef.current.size === 0)) return true;
    return enqueueSave(snapshot);
  }, [enqueueSave, saveState]);

  useEffect(() => {
    onLeaveGuardChange?.(flushCurrentDocument);
    return () => onLeaveGuardChange?.(undefined);
  }, [flushCurrentDocument, onLeaveGuardChange]);

  useEffect(() => {
    if (!initialDocumentId && window.innerWidth <= 760) setMobileListOpen(true);
  }, [initialDocumentId]);

  async function selectDocument(id: string) {
    if (id === selectedIdRef.current) {
      setMobileListOpen(false);
      return;
    }
    if (!(await flushCurrentDocument())) return;
    loadedRef.current = undefined;
    selectedIdRef.current = id;
    setSelectedId(id);
    onSelectedDocumentChange(id);
    setMobileListOpen(false);
  }

  async function addDocument() {
    if (!(await flushCurrentDocument())) return;
    const created = await createDocument({ title: "Untitled", project: project || initialProject });
    revisionByDocumentRef.current.set(created.id, created.revision);
    setDocumentCollection((current) => [created, ...current.filter((document) => document.id !== created.id)]);
    loadedRef.current = undefined;
    selectedIdRef.current = created.id;
    setSelectedId(created.id);
    onSelectedDocumentChange(created.id);
    setMobileListOpen(false);
  }

  async function removeCurrent() {
    if (!selected || !window.confirm(`Delete “${selected.title}”? The original linked materials will not be deleted.`)) return;
    if (!(await flushCurrentDocument())) return;
    await deleteDocument(selected.id);
    revisionByDocumentRef.current.delete(selected.id);
    const remaining = documents.filter((document) => document.id !== selected.id);
    setDocumentCollection(remaining);
    loadedRef.current = undefined;
    selectedIdRef.current = remaining[0]?.id;
    setSelectedId(remaining[0]?.id);
    onSelectedDocumentChange(remaining[0]?.id, true);
    setMenuOpen(false);
  }

  function openGenerator() {
    setGenerationTitle("");
    setGenerationProject(project);
    setGenerationSourceIds(sourceIds.length ? sourceIds : groupIdenticalMaterials(materials).slice(0, 3).map((group) => group.representative.id));
    setGenerationError(undefined);
    setGeneratorOpen(true);
  }

  async function runGeneration() {
    if (!generationSourceIds.length || generating) return;
    setGenerating(true);
    setGenerationError(undefined);
    try {
      if (!(await flushCurrentDocument())) {
        setGenerationError("This document has not been saved. Resolve the save error before generating.");
        return;
      }
      const created = await generateDocument({
        title: generationTitle,
        project: generationProject,
        sourceIds: generationSourceIds,
        instruction: generationInstruction,
      });
      revisionByDocumentRef.current.set(created.id, created.revision);
      setDocumentCollection((current) => [created, ...current.filter((document) => document.id !== created.id)]);
      loadedRef.current = undefined;
      selectedIdRef.current = created.id;
      setSelectedId(created.id);
      onSelectedDocumentChange(created.id);
      setMobileListOpen(false);
      setGeneratorOpen(false);
    } catch (cause) {
      setGenerationError(cause instanceof Error ? cause.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function rememberEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) editorSelectionRef.current = range.cloneRange();
  }

  const refreshDocumentSkillSelection = useCallback(() => {
    const editor = editorRef.current;
    const documentID = selectedIdRef.current;
    if (!editor || !documentID) return;
    const next = captureStableEditableSelection(editor, selectionSnapshotRef.current, editor);
    if (selectionSkillDismissalStillApplies(dismissedSelectionSnapshotRef.current, next)) {
      selectionSnapshotRef.current = undefined;
      selectionDocumentRef.current = undefined;
      setSelectionSnapshot(undefined);
      return;
    }
    if (next) dismissedSelectionSnapshotRef.current = undefined;
    selectionSnapshotRef.current = next;
    selectionDocumentRef.current = next ? { id: documentID } : undefined;
    setSelectionSnapshot(next);
    if (!next || selectionSkillsLoadedRef.current) return;
    selectionSkillsLoadedRef.current = true;
    void getSkills().then(setSelectionSkills).catch(() => {
      selectionSkillsLoadedRef.current = false;
    });
  }, []);

  const scheduleDocumentSkillSelectionRefresh = useCallback(() => {
    if (selectionRefreshFrameRef.current !== undefined) {
      window.cancelAnimationFrame(selectionRefreshFrameRef.current);
    }
    selectionRefreshFrameRef.current = window.requestAnimationFrame(() => {
      selectionRefreshFrameRef.current = undefined;
      refreshDocumentSkillSelection();
    });
  }, [refreshDocumentSkillSelection]);

  const dismissDocumentSelectionSkills = useCallback(() => {
    if (selectionRefreshFrameRef.current !== undefined) {
      window.cancelAnimationFrame(selectionRefreshFrameRef.current);
      selectionRefreshFrameRef.current = undefined;
    }
    if (selectionSnapshotRef.current) {
      dismissedSelectionSnapshotRef.current = selectionSnapshotRef.current;
    }
    selectionSnapshotRef.current = undefined;
    selectionDocumentRef.current = undefined;
    setSelectionSnapshot(undefined);
    setFocusSelectionSkillTrigger(false);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !selectedId) return;
    const onSelectionChange = () => scheduleDocumentSkillSelectionRefresh();
    const onPointerDownOutsideSelection = (event: PointerEvent) => {
      const path = event.composedPath();
      // The skill choices are portalled so they are not descendants of the
      // visible trigger. Treat both surfaces as one selection control: a click
      // on a choice must apply it, not first dismiss the current selection.
      const selectionMenu = path.some((item) => item instanceof HTMLElement && (
        item.getAttribute("aria-label") === "Selection skills" ||
        item.getAttribute("aria-label") === "Choose a skill"
      ));
      if (path.includes(editor) || selectionMenu) return;
      dismissDocumentSelectionSkills();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    editor.addEventListener("select", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDownOutsideSelection, true);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      editor.removeEventListener("select", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDownOutsideSelection, true);
      if (selectionRefreshFrameRef.current !== undefined) {
        window.cancelAnimationFrame(selectionRefreshFrameRef.current);
        selectionRefreshFrameRef.current = undefined;
      }
    };
  }, [dismissDocumentSelectionSkills, scheduleDocumentSkillSelectionRefresh, selectedId]);

  const eligibleSelectionSkills = selectionSkillEligibility(selectionSkills, "web");

  function showSelectionSkillNotice(notice: { message: string; history?: SelectionSkillApplyTransaction }) {
    if (selectionNoticeTimerRef.current) window.clearTimeout(selectionNoticeTimerRef.current);
    setSelectionSkillNotice(notice);
    if (!notice.history) {
      selectionNoticeTimerRef.current = window.setTimeout(() => setSelectionSkillNotice(undefined), 4500);
    }
  }

  async function applyDocumentSelectionSkill(skillId: string) {
    const snapshot = selectionSnapshotRef.current;
    const selectionDocument = selectionDocumentRef.current;
    const editor = editorRef.current;
    const selectedDocument = selectedIdRef.current;
    // Autosave can advance the server revision while this exact DOM selection
    // remains valid. The document identity and range snapshot are the write guard.
    if (!snapshot || !selectionDocument || !editor || !selectedDocument || selectionDocument.id !== selectedDocument) {
      showSelectionSkillNotice({ message: "Selection changed — choose a skill again." });
      return;
    }
    const skill = eligibleSelectionSkills.find((item) => item.id === skillId);
    if (!skill) {
      showSelectionSkillNotice({ message: "That skill is no longer available." });
      return;
    }
    const run = await createSkillRun({
      skill_id: skill.id,
      instruction: "Transform only the selected text. Return only the replacement text.",
      project,
      page_title: title || "Untitled",
      page_url: `logue://document/${selectedDocument}`,
      target_text: editor.innerText,
      selection: snapshot.text,
    });
    const currentSelectionDocument = selectionDocumentRef.current;
    if (!selectionSnapshotRef.current || !currentSelectionDocument) return;
    if (
      selectionSnapshotRef.current !== snapshot ||
      currentSelectionDocument.id !== selectionDocument.id ||
      selectedIdRef.current !== selectedDocument
    ) {
      showSelectionSkillNotice({ message: "Selection changed — choose a skill again." });
      return;
    }
    const replacement = normalizeSelectionSkillReplacement(run.original_output);
    if (!replacement) throw new Error("This skill returned no text.");
    const beforeContent = editor.innerHTML;
    const beforeSourceIds = [...sourceIds];
    if (!replaceSelectionIfUnchanged(snapshot, replacement)) {
      showSelectionSkillNotice({ message: "Selection changed — choose a skill again." });
      return;
    }
    const next = reconcileDocumentCitations(sanitizeEditorHTML(editor.innerHTML), sourceIds);
    const afterContent = next.content;
    setContent(next.content);
    setSourceIds(next.sourceIds);
    markDirty();
    if (selectionUndoTimerRef.current) window.clearTimeout(selectionUndoTimerRef.current);
    setSelectionUndo({ documentId: selectedDocument, beforeContent, afterContent, sourceIds: beforeSourceIds });
    selectionUndoTimerRef.current = window.setTimeout(() => setSelectionUndo(undefined), 8000);
    const history = await saveSelectionSkillHistory({ runId: run.id, replacement }, adoptSkillRun);
    if (history) showSelectionSkillNotice({ message: "Applied", history });
    selectionSnapshotRef.current = undefined;
    selectionDocumentRef.current = undefined;
    setSelectionSnapshot(undefined);
  }

  function undoSelectionSkill() {
    const entry = selectionUndo;
    const editor = editorRef.current;
    if (!entry || !editor || entry.documentId !== selectedIdRef.current || sanitizeEditorHTML(editor.innerHTML) !== entry.afterContent) {
      setSelectionUndo(undefined);
      return;
    }
    editor.innerHTML = entry.beforeContent;
    setContent(entry.beforeContent);
    setSourceIds(entry.sourceIds);
    markDirty();
    if (selectionUndoTimerRef.current) window.clearTimeout(selectionUndoTimerRef.current);
    setSelectionUndo(undefined);
  }

  async function retrySelectionSkillHistory() {
    const history = selectionSkillNotice?.history;
    if (!history) return;
    const retry = await saveSelectionSkillHistory(history, adoptSkillRun);
    if (retry) {
      setSelectionSkillNotice({ message: "Applied", history: retry });
      return;
    }
    setSelectionSkillNotice(undefined);
  }

  function insertSourceCitation(id: string) {
    if (sourceIds.includes(id) || !editorRef.current) return;
    const editor = editorRef.current;
    const nextSourceIds = [...sourceIds, id];
    const sourceNumber = nextSourceIds.length;
    editor.focus();
    const savedRange = editorSelectionRef.current;
    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
      const fragment = document.createDocumentFragment();
      fragment.appendChild(document.createTextNode(" "));
      const citation = document.createElement("mark");
      citation.textContent = `[Source ${sourceNumber}]`;
      fragment.appendChild(citation);
      const trailingSpace = document.createTextNode("\u00a0");
      fragment.appendChild(trailingSpace);
      savedRange.deleteContents();
      savedRange.insertNode(fragment);
      savedRange.setStartAfter(trailingSpace);
      savedRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
    } else {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = `<mark>[Source ${sourceNumber}]</mark>&nbsp;`;
      editor.appendChild(paragraph);
      restoreCaretOffset(editor, editor.textContent?.length ?? 0);
    }
    const nextContent = sanitizeEditorHTML(editor.innerHTML);
    setContent(nextContent);
    setSourceIds(nextSourceIds);
    setActiveSourceId(id);
    setSourceMessage(`Added [Source ${sourceNumber}] to the document`);
    rememberEditorSelection();
    markDirty();
  }

  function removeSource(id: string) {
    const currentHTML = sanitizeEditorHTML(editorRef.current?.innerHTML ?? content);
    const next = removeSourceCitation(currentHTML, sourceIds, id);
    if (editorRef.current) editorRef.current.innerHTML = next.content || "<p><br></p>";
    setContent(next.content);
    setSourceIds(next.sourceIds);
    setActiveSourceId((current) => current === id ? undefined : current);
    setSourceMessage("Removed the citation and its source");
    markDirty();
  }

  function focusSourceCitation(id: string) {
    const sourceNumber = sourceIds.indexOf(id) + 1;
    if (!sourceNumber) return;
    setActiveSourceId(id);
    if (window.innerWidth <= 900) setSourcePanelOpen(false);
    window.setTimeout(() => {
      const mark = Array.from(editorRef.current?.querySelectorAll("mark") ?? [])
        .find((item) => citationNumber(item.textContent) === String(sourceNumber));
      mark?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function openCitation(sourceNumber: number) {
    const id = sourceIds[sourceNumber - 1];
    if (!id) return;
    setActiveSourceId(id);
    setSourcePanelOpen(true);
    window.setTimeout(() => {
      document.getElementById(`linked-source-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  useEffect(() => {
    const activeNumber = activeSourceId ? sourceIds.indexOf(activeSourceId) + 1 : 0;
    editorRef.current?.querySelectorAll("mark").forEach((mark) => {
      const number = Number(citationNumber(mark.textContent));
      if (activeNumber > 0 && number === activeNumber) mark.setAttribute("data-active", "true");
      else mark.removeAttribute("data-active");
    });
  }, [activeSourceId, content, sourceIds]);

  return (
    <div ref={workspaceRef} className="flex h-full min-h-0 w-full overflow-hidden bg-white text-[#242522]">
      {showDocumentSidebar && <>
      <aside style={{ "--document-list-width": `${documentListWidth}px` } as React.CSSProperties} data-testid="document-sidebar" aria-label="Document list" className={`flex w-[var(--document-list-width)] shrink-0 flex-col bg-[#f7f7f5] max-[760px]:fixed max-[760px]:bottom-0 max-[760px]:left-[72px] max-[760px]:right-0 max-[760px]:top-0 max-[760px]:z-30 max-[760px]:w-auto max-[640px]:inset-x-0 max-[640px]:bottom-16 ${mobileListOpen ? "" : "max-[760px]:hidden"}`}>
        <header className="flex h-12 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-1.5 text-[14px]"><button type="button" onClick={onOpenGenerate} className="font-medium text-[#858681] hover:text-[#4e4f4b]">Generate</button><span className="text-[#b0b1ad]">/</span><h1 className="font-semibold text-[#555651]">Documents</h1></div>
          <span className="flex items-center gap-0.5">
            {onManageSkills && <button type="button" onClick={onManageSkills} className="inline-flex size-8 items-center justify-center rounded text-[#777873] hover:bg-[#e8e8e5] hover:text-[#444541] max-[640px]:size-11" aria-label="Manage skills" title="Manage skills"><Sparkles size={14} /></button>}
            <button type="button" onClick={openGenerator} className="inline-flex size-8 items-center justify-center rounded text-[#777873] hover:bg-[#e8e8e5] hover:text-[#444541] max-[640px]:size-11" aria-label="Generate document from materials" title="Generate document from materials"><Sparkles size={14} /></button>
            <button type="button" onClick={() => void addDocument()} className="inline-flex size-8 items-center justify-center rounded text-[#858681] hover:bg-[#e8e8e5] hover:text-[#444541] max-[640px]:size-11" aria-label="New blank document" title="New blank document"><FilePlus2 size={14} /></button>
          </span>
        </header>

        <div className="px-2.5 pb-1">
          <label className="relative block">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999a96]" />
            <input aria-label="Search documents" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" className="h-8 w-full rounded-md border border-transparent bg-[#eeeeeb] pl-8 pr-2 text-[14px] outline-none placeholder:text-[#92938f] focus:border-[#d9d9d5] focus:bg-white max-[640px]:h-11" />
          </label>
        </div>

        <div className="scroll-surface mt-1 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="space-y-1 px-1 py-2">{[0, 1, 2].map((item) => <div key={item} className="h-11 animate-pulse rounded-md bg-[#ecece9]" />)}</div>
          ) : loadError ? (
            <button type="button" onClick={() => window.location.reload()} className="mx-2 mt-3 rounded-md bg-[#f8ece9] px-3 py-3 text-left text-[14px] leading-4 text-[#9f4a42]">Unable to connect<br /><span className="font-medium underline underline-offset-2">Reload</span></button>
          ) : filteredDocuments.length ? (
            filteredDocuments.map((document) => (
              <button key={document.id} type="button" onClick={() => void selectDocument(document.id)} className={`group flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left max-[640px]:min-h-12 max-[640px]:px-3 ${document.id === selectedId ? "bg-[#e7e7e4] text-[#2e2f2b]" : "text-[#686965] hover:bg-[#eeeeeb]"}`}>
                <FileText size={14} className="shrink-0 text-[#898a85]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{document.title || "Untitled"}</span>
                  {documentSearchReason(document) ? <span className="mt-0.5 block truncate text-[12px] text-[#8b8d87]">{documentSearchReason(document)}</span> : document.project && <span className="mt-0.5 block truncate text-[14px] text-[#9a9b96]">{document.project}</span>}
                </span>
              </button>
            ))
          ) : documents.length === 0 ? (
            <div className="mx-2 mt-3 rounded-md border border-dashed border-[#d5d5d1] px-2 py-3 text-center">
              <p className="text-[14px] leading-4 text-[#8d8e89]">Your documents will appear here</p>
              <button type="button" onClick={() => void addDocument()} className="mt-2 w-full rounded-md bg-white px-2 py-2 text-[15px] font-medium text-[#5e605a] shadow-[0_0_0_1px_#deded9] hover:bg-[#fafaf8]">New blank document</button>
              <button type="button" onClick={materials.length > 0 ? openGenerator : onOpenMaterials} className="mt-1 w-full rounded-md px-2 py-2 text-[15px] font-medium text-[#777873] hover:bg-white">{materials.length > 0 ? "Generate from materials" : "Add materials first"}</button>
            </div>
          ) : documentSearch.pending ? (
            <SearchPending label="documents" className="min-h-16" />
          ) : (
            <div className="px-3 py-6 text-center"><p className="text-[14px] text-[#999a95]">No matching documents</p><button type="button" onClick={() => setQuery("")} className="mt-2 text-[14px] font-medium text-[#666762] underline underline-offset-2">Clear search</button></div>
          )}
        </div>
      </aside>
      <PanelResizer
        label="Resize document list"
        value={documentListWidth}
        min={200}
        max={360}
        defaultValue={252}
        onChange={setDocumentListWidth}
        className="max-[760px]:hidden"
      />
      </>}

      {selected ? (
        <main className={`scroll-surface min-w-0 flex-1 overflow-y-auto bg-white ${effectiveMobileListOpen ? "max-[760px]:hidden" : ""}`}>
          <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[#eeeeeb] bg-white/92 px-4 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2 text-[14px] text-[#777873]">
              {showDocumentSidebar && <button type="button" onClick={() => setMobileListOpen(true)} className="hidden h-11 items-center gap-1 rounded-md px-2 text-[15px] font-medium text-[#666762] hover:bg-[#f1f1ee] max-[760px]:inline-flex"><BookOpenText size={14} /> Documents</button>}
              <span className="truncate max-[760px]:hidden">Documents</span><span className="text-[#b0b1ad] max-[760px]:hidden">/</span><span className="truncate text-[#4b4c48] max-[760px]:max-w-32">{title || "Untitled"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {saveState === "error" && <span role="status" className="mr-1 text-[14px] font-medium text-[#b34e45]">Save failed</span>}
              <button type="button" onClick={() => setSourcePanelOpen((value) => !value)} className={`inline-flex size-8 items-center justify-center rounded-md transition max-[900px]:size-11 ${sourcePanelOpen ? "bg-[#eeeefa] text-[#5d63d4]" : "text-[#73746f] hover:bg-[#f1f1ee]"}`} aria-label={sourcePanelOpen ? "Close sources panel" : "Open sources panel"}>{sourcePanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</button>
              <OverlayMenu
                open={menuOpen}
                onOpenChange={setMenuOpen}
                placement="bottom-end"
                ariaLabel="Document actions"
                menuClassName="w-44 rounded-lg border border-[#e1e1de] bg-white p-1.5 shadow-[0_12px_34px_rgba(24,25,22,0.14)]"
                trigger={(props) => (
                  <button {...props} type="button" className="inline-flex size-8 items-center justify-center rounded-md text-[#73746f] hover:bg-[#f1f1ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4] max-[900px]:size-11" aria-label="Document menu">
                    <MoreHorizontal size={16} />
                  </button>
                )}
              >
                <button type="button" role="menuitem" onClick={() => void removeCurrent()} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#a5443b] hover:bg-[#f9ece9] focus-visible:bg-[#f9ece9] focus-visible:outline-none"><Trash2 size={14} /> Delete document</button>
              </OverlayMenu>
            </div>
          </header>

          <article className={`${readingColumnClass} pb-28 pt-14 max-[640px]:pt-9`}>
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(event) => { setTitle(event.target.value.replace(/\n/g, "")); markDirty(); }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                editorRef.current?.focus();
              }}
              placeholder="Untitled"
              aria-label="Document title"
              className="block w-full resize-none overflow-hidden border-0 bg-transparent text-[38px] font-bold leading-[1.12] tracking-[-0.045em] text-[#242522] outline-none placeholder:text-[#d0d0cc] max-[640px]:text-[30px]"
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="inline-flex h-7 items-center gap-1 rounded-md bg-[#f2f2ef] px-2 text-[15px] text-[#676863] max-[900px]:h-11">
                <FolderKanban size={13} />
                <select value={project} onChange={(event) => { setProject(event.target.value); markDirty(); }} className="max-w-44 appearance-none bg-transparent font-medium outline-none">
                  <option value="">Unfiled</option>
                  {projects.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <ChevronDown size={12} />
              </label>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#f2f2ef] px-2 text-[15px] text-[#777873] max-[900px]:h-11"><Link2 size={12} /> {countLabel(sourceIds.length, "source")}</span>
              <span className="text-[14px] text-[#aaa]">Updated {relativeDate(selected.updated_at)}</span>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Document content"
              data-logue-selection-skills="native"
              data-placeholder="Start writing, or add sources from the right…"
              onInput={(event) => {
                const caretOffset = caretOffsetWithin(event.currentTarget);
                const next = reconcileDocumentCitations(sanitizeEditorHTML(event.currentTarget.innerHTML), sourceIds);
                if (next.content !== event.currentTarget.innerHTML) {
                  event.currentTarget.innerHTML = next.content || "<p><br></p>";
                  if (caretOffset !== undefined) restoreCaretOffset(event.currentTarget, caretOffset);
                }
                setContent(next.content);
                setSourceIds(next.sourceIds);
                if (activeSourceId && !next.sourceIds.includes(activeSourceId)) setActiveSourceId(undefined);
                selectionSnapshotRef.current = undefined;
                selectionDocumentRef.current = undefined;
                setSelectionSnapshot(undefined);
                markDirty();
              }}
              onBlur={rememberEditorSelection}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !selectionSnapshotRef.current || !eligibleSelectionSkills.length) return;
                event.preventDefault();
                setFocusSelectionSkillTrigger(true);
              }}
              onKeyUp={() => { rememberEditorSelection(); scheduleDocumentSkillSelectionRefresh(); }}
              onMouseUp={() => { rememberEditorSelection(); scheduleDocumentSkillSelectionRefresh(); }}
              onClick={(event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement) || target.tagName !== "MARK") return;
                const number = citationNumber(target.textContent);
                if (number) openCitation(Number(number));
              }}
              onPaste={(event) => {
                event.preventDefault();
                document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
              }}
              className="logue-view-editor mt-7 min-h-[62vh] w-full text-[15px] leading-[1.75] text-[#373834] outline-none"
              spellCheck
            />
            {selectionSnapshot && eligibleSelectionSkills.length > 0 && <SelectionSkillMenu
              anchor={selectionSnapshot.anchor}
              skills={eligibleSelectionSkills}
              onUseSkill={applyDocumentSelectionSkill}
              focusTrigger={focusSelectionSkillTrigger}
              onFocusTriggerHandled={() => setFocusSelectionSkillTrigger(false)}
              onDismiss={() => {
                dismissDocumentSelectionSkills();
              }}
            />}
            {selectionUndo?.documentId === selectedId && <div role="status" className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md border border-[#ddddda] bg-white px-2.5 py-1.5 text-[13px] text-[#5b5c57] shadow-[0_8px_24px_rgba(20,21,18,0.12)]">
              Applied <button type="button" onClick={undoSelectionSkill} className="ml-1.5 font-medium text-[#4f57cd] underline underline-offset-2">Undo</button>
            </div>}
            {selectionSkillNotice && <div role={selectionSkillNotice.history ? "status" : "alert"} className="fixed bottom-[3.5rem] left-1/2 z-30 -translate-x-1/2 rounded-md border border-[#ddddda] bg-white px-2.5 py-1.5 text-[13px] text-[#5b5c57] shadow-[0_8px_24px_rgba(20,21,18,0.12)]">
              {selectionSkillNotice.message}{selectionSkillNotice.history && <button type="button" onClick={() => void retrySelectionSkillHistory()} className="ml-1.5 font-medium text-[#4f57cd] underline underline-offset-2">Retry saving history</button>}
            </div>}
          </article>
        </main>
      ) : (
        <main className={`flex min-w-0 flex-1 items-center justify-center bg-white px-6 ${effectiveMobileListOpen ? "max-[760px]:hidden" : ""}`}>
          <section className="w-full max-w-lg text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-lg bg-[#f0f0ed] text-[#71736d]"><BookOpenText size={20} /></span>
            <h1 className="mt-4 text-[19px] font-semibold tracking-[-0.025em] text-[#343631]">Create your first document</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-5 text-[#858780]">Write directly in a familiar editor, or let Gemini create an editable draft with source citations.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => void addDocument()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[14px] font-medium text-white hover:bg-[#3a3b37]"><FilePlus2 size={14} /> New blank document</button>
              <button type="button" onClick={materials.length > 0 ? openGenerator : onOpenMaterials} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d9d9d5] px-3.5 text-[14px] font-medium text-[#656761] hover:bg-[#f5f5f2]"><Sparkles size={14} /> {materials.length > 0 ? "Generate from materials" : "Add materials first"}</button>
            </div>
          </section>
        </main>
      )}

      {selected && sourcePanelOpen && (
        <>
        <PanelResizer
          label="Resize sources panel"
          value={sourcePanelWidth}
          min={240}
          max={sourcePanelMaxWidth}
          defaultValue={defaultSourcePanelWidth(workspaceWidth, sourcePanelMaxWidth)}
          edge="left"
          onChange={setSourcePanelWidth}
          className="max-[900px]:hidden"
        />
        <aside style={{ "--source-panel-width": `${sourcePanelWidth}px` } as React.CSSProperties} className="flex w-[var(--source-panel-width)] shrink-0 flex-col bg-[#fcfcfb] max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:top-0 max-[900px]:z-50 max-[900px]:w-full max-[640px]:bottom-16">
          <header className="flex h-12 items-center justify-between border-b border-[#ecece9] px-4"><div><h2 className="text-[14px] font-semibold text-[#454642]">Sources</h2></div><button type="button" onClick={() => setSourcePanelOpen(false)} className="inline-flex size-8 items-center justify-center rounded text-[#888984] hover:bg-[#eeeeeb] max-[900px]:size-11" aria-label="Close sources"><X size={14} /></button></header>
          <div className="px-3 pb-3 pt-2.5">
            <div className="mb-2 flex border-b border-[#e7e7e4]" aria-label="Source scope">
              <button type="button" disabled={!project} onClick={() => setSourceScope("project")} className={`h-7 flex-1 border-b-2 text-[14px] font-medium transition max-[900px]:h-11 ${sourceScope === "project" && project ? "border-[#777dd9] text-[#4f54ad]" : "border-transparent text-[#8a8b86] hover:text-[#555651] disabled:cursor-not-allowed disabled:opacity-45"}`}>This project</button>
              <button type="button" onClick={() => setSourceScope("all")} className={`h-7 flex-1 border-b-2 text-[14px] font-medium transition max-[900px]:h-11 ${sourceScope === "all" || !project ? "border-[#777dd9] text-[#4f54ad]" : "border-transparent text-[#8a8b86] hover:text-[#555651]"}`}>All materials</button>
            </div>
            <label className="relative block"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999a95]" /><input aria-label="Search source materials" value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder={sourceScope === "project" && project ? `Search ${project} materials` : "Search all materials"} className="h-8 w-full rounded-md border border-transparent bg-[#f1f1ee] pl-8 pr-2 text-[15px] outline-none transition focus:border-[#d8d8d3] focus:bg-white" /></label>
            {sourceMessage && <p role="status" className="mt-2 rounded-md bg-[#fff5e9] px-2.5 py-2 text-[14px] leading-4 text-[#8c612c]">{sourceMessage}</p>}
          </div>
          {linkedSources.length > 0 && <section className="px-3 pb-3 pt-1"><div className="mb-1.5 flex items-center justify-between px-1"><p className="text-[14px] font-semibold text-[#7d7e79]">Citations</p><span className="text-[14px] text-[#a0a19c]">{countLabel(linkedSources.length, "item")}</span></div><div>{linkedSources.map((material, index) => { const excerpt = sourceExcerpt(material); const active = material.id === activeSourceId; return <div id={`linked-source-${material.id}`} key={material.id} className={`group relative border-l-2 transition ${active ? "border-[#777dd9] bg-[#f3f3fa]" : "border-transparent hover:bg-[#f4f4f1]"}`}><button type="button" onClick={() => focusSourceCitation(material.id)} title="Find citation in document" className="flex w-full items-start gap-2 px-2 py-2 pr-14 text-left"><span className={`mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[12px] font-semibold ${active ? "bg-[#6d73d7] text-white" : "bg-[#eeeefa] text-[#666dda]"}`}>#{index + 1}</span><span className="min-w-0"><span className="block truncate text-[15px] font-medium text-[#494a46]">{sourceLabel(material)}</span><span className="mt-0.5 block truncate text-[14px] text-[#8b8c87]">{sourceMeta(material)}</span>{excerpt && <span className={`mt-1 text-[14px] leading-4 text-[#777873] ${active ? "line-clamp-2" : "line-clamp-1"}`}>{excerpt}</span>}</span></button><button type="button" onClick={() => removeSource(material.id)} aria-label={`Remove citation ${sourceLabel(material)}`} title="Remove citation and source" className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded text-[#9a9b96] opacity-0 transition hover:bg-[#f7e9e6] hover:text-[#a54b42] focus:opacity-100 group-hover:opacity-100 max-[900px]:opacity-100"><X size={12} /></button>{material.source?.url && <a href={material.source.url} target="_blank" rel="noreferrer" aria-label={`Open original source ${sourceLabel(material)}`} title="Open original source" className="absolute right-7 top-1 inline-flex size-6 items-center justify-center rounded text-[#9a9b96] opacity-0 transition hover:bg-[#ecece8] hover:text-[#5c5d58] focus:opacity-100 group-hover:opacity-100 max-[900px]:opacity-100"><ArrowUpRight size={12} /></a>}</div>; })}</div></section>}
          <section className="scroll-surface flex-1 overflow-y-auto border-t border-[#eeeeeb] px-3 py-3"><div className="mb-1.5 flex items-center justify-between px-1"><p className="text-[14px] font-semibold text-[#7d7e79]">Materials</p><span className="text-[14px] text-[#a0a19c]">{availableSourceGroupCount === availableSources.length ? countLabel(availableSources.length, "item") : `${countLabel(availableSourceGroupCount, "group")} / ${countLabel(availableSources.length, "capture")}`}</span></div>{sourceSearch.pending ? <SearchPending label="materials" className="min-h-16" /> : <MaterialGroupAddList materials={availableSources} onAdd={insertSourceCitation} getLabel={sourceLabel} getDescription={sourceExcerpt} getMeta={sourceMeta} getSearchReason={sourceSearchReason} />}</section>
        </aside>
        </>
      )}

      {generatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20211e]/25 p-4 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.currentTarget === event.target && !generating) setGeneratorOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="generate-document-title" className="flex max-h-[82vh] w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-[#deded9] bg-white shadow-[0_24px_80px_rgba(20,21,18,0.22)]">
            <header className="flex items-center justify-between border-b border-[#e8e8e5] px-5 py-4">
              <div className="flex items-center gap-2.5"><span className="inline-flex size-8 items-center justify-center rounded-md bg-[#eeece8] text-[#5e605a]"><Sparkles size={15} /></span><div><h2 id="generate-document-title" className="text-[14px] font-semibold text-[#30312d]">Generate document</h2><p className="mt-0.5 text-[14px] text-[#8b8c87]">Create an editable draft that preserves source citations.</p></div></div>
              <button type="button" disabled={generating} onClick={() => setGeneratorOpen(false)} className="inline-flex size-8 items-center justify-center rounded-md text-[#888984] hover:bg-[#f0f0ed] max-[640px]:size-11" aria-label="Close"><X size={16} /></button>
            </header>
            <div className="grid min-h-0 flex-1 grid-cols-[1fr_230px] max-[620px]:grid-cols-1">
              <div className="space-y-4 overflow-y-auto p-5">
                <label className="block"><span className="mb-1.5 block text-[15px] font-medium text-[#666762]">Title <span className="font-normal text-[#999a95]">(optional)</span></span><input autoFocus value={generationTitle} onChange={(event) => setGenerationTitle(event.target.value)} placeholder={generationProject ? `${generationProject} document` : "New document"} className="h-9 w-full rounded-md border border-[#dcdcd7] px-3 text-[14px] outline-none focus:border-[#aaa]" /></label>
                <label className="block"><span className="mb-1.5 block text-[15px] font-medium text-[#666762]">Project</span><select value={generationProject} onChange={(event) => setGenerationProject(event.target.value)} className="h-9 w-full rounded-md border border-[#dcdcd7] bg-white px-3 text-[14px] outline-none focus:border-[#aaa]"><option value="">Unfiled</option>{projects.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="block"><span className="mb-1.5 block text-[15px] font-medium text-[#666762]">What should this document accomplish?</span><textarea value={generationInstruction} onChange={(event) => setGenerationInstruction(event.target.value)} className="min-h-28 w-full resize-y rounded-md border border-[#dcdcd7] px-3 py-2.5 text-[14px] leading-5 outline-none focus:border-[#aaa]" /></label>
                {generationError && <p className="rounded-md bg-[#fbefec] px-3 py-2 text-[15px] leading-4 text-[#a34b42]">{generationError}</p>}
              </div>
              <div className="min-h-0 border-l border-[#e8e8e5] bg-[#fafaf8] p-3 max-[620px]:max-h-52 max-[620px]:border-l-0 max-[620px]:border-t">
                <div className="mb-2 flex items-center justify-between px-1"><p className="text-[14px] font-semibold text-[#767772]">Source materials</p><span className="text-[14px] text-[#999a95]">{generationSourceIds.length} selected</span></div>
                <div className="h-full overflow-y-auto pb-6"><MaterialGroupPicker materials={materials} selectedIds={generationSourceIds} onChange={setGenerationSourceIds} getLabel={sourceLabel} getDescription={sourceExcerpt} getMeta={sourceMeta} /></div>
              </div>
            </div>
            <footer className="flex items-center justify-between border-t border-[#e8e8e5] bg-[#fcfcfa] px-5 py-3.5"><p className="text-[14px] text-[#999a95]">Gemini receives only the selected materials and project overview.</p><div className="flex gap-2"><button type="button" disabled={generating} onClick={() => setGeneratorOpen(false)} className="h-8 rounded-md px-3 text-[15px] font-medium text-[#6f706b] hover:bg-[#eeeeeb]">Cancel</button><button type="button" disabled={!generationSourceIds.length || generating} onClick={() => void runGeneration()} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#242522] px-3 text-[15px] font-medium text-white hover:bg-[#393a36] disabled:cursor-not-allowed disabled:bg-[#bdbdb8]">{generating ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}{generating ? "Generating…" : "Generate document"}</button></div></footer>
          </section>
        </div>
      )}
    </div>
  );
}
