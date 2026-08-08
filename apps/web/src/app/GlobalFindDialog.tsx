import { useFocusBoundary } from "@logue/ui";
import { FileText, FolderKanban, Library, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDocuments,
  getMaterials,
  getProjects,
  searchDocuments,
  searchMaterials,
  searchProjects,
  type DocumentSearchMatch,
  type LogueDocument,
  type MaterialSearchMatch,
  type ProjectSummary,
} from "../lib/api";
import type { Material } from "@logue/ui";
import { groupLibraryMaterials } from "../lib/commentBundles";
import { contentSummary } from "./contentPresentation";

type FindResult =
  | { kind: "source"; id: string; title: string; detail: string }
  | { kind: "document"; id: string; title: string; detail: string; project?: string }
  | { kind: "project"; id: string; title: string; detail: string };

type ProjectSearchMatch = {
  id: string;
  match: "title" | "content" | "project" | "related";
  reason?: string;
};

function sourceTitle(source: Material) {
  return source.source?.title?.trim() || contentSummary(source.content, "Saved Source");
}

function navigateTo(result: FindResult) {
  const url = new URL(window.location.href);
  for (const key of ["project", "doc", "source", "q", "find"]) url.searchParams.delete(key);
  if (result.kind === "source") {
    url.searchParams.set("view", "library");
    url.searchParams.set("source", result.id);
  } else if (result.kind === "document") {
    url.searchParams.set("view", "documents");
    url.searchParams.set("doc", result.id);
    if (result.project) url.searchParams.set("project", result.project);
  } else {
    url.searchParams.set("view", "projects");
    url.searchParams.set("project", result.title);
  }
  window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function GlobalFindDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [documents, setDocuments] = useState<LogueDocument[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [sourceMatches, setSourceMatches] = useState<MaterialSearchMatch[]>([]);
  const [documentMatches, setDocumentMatches] = useState<DocumentSearchMatch[]>([]);
  const [projectMatches, setProjectMatches] = useState<ProjectSearchMatch[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusBoundary<HTMLElement>({ open, onClose: () => onOpenChange(false), trap: true });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSourceMatches([]);
    setDocumentMatches([]);
    setProjectMatches([]);
    setActiveIndex(-1);
    setError("");
    setWarning("");
    setCatalogLoading(true);
    void Promise.all([getMaterials(), getDocuments(), getProjects()])
      .then(([nextMaterials, nextDocuments, nextProjects]) => {
        setMaterials(nextMaterials);
        setDocuments(nextDocuments);
        setProjects(nextProjects);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Search is unavailable."))
      .finally(() => setCatalogLoading(false));
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSourceMatches([]);
      setDocumentMatches([]);
      setProjectMatches([]);
      setSearching(false);
      setError("");
      setWarning("");
      return;
    }
    const controller = new AbortController();
    let active = true;
    let requestTimeout = 0;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError("");
      setWarning("");
      requestTimeout = window.setTimeout(() => controller.abort(), 14_000);
      void Promise.allSettled([
        searchMaterials(normalized, controller.signal),
        searchDocuments(normalized, controller.signal),
        searchProjects(normalized, controller.signal),
      ])
        .then(([sourceResult, documentResult, projectResult]) => {
          if (!active) return;
          if (sourceResult.status === "fulfilled") setSourceMatches(sourceResult.value.matches);
          else setSourceMatches([]);
          if (documentResult.status === "fulfilled") setDocumentMatches(documentResult.value.matches);
          else setDocumentMatches([]);
          if (projectResult.status === "fulfilled") setProjectMatches(projectResult.value.matches);
          else setProjectMatches([]);
          const failed = [sourceResult, documentResult, projectResult].filter((result) => result.status === "rejected").length;
          if (failed === 3) setError("Search is unavailable. Try again.");
          else if (failed) setWarning("Some results are temporarily unavailable.");
        })
        .finally(() => {
          window.clearTimeout(requestTimeout);
          if (active) setSearching(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [open, query, searchAttempt]);

  const results = useMemo<FindResult[]>(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length < 2) return [];
    const savedMaterials = materials.filter((item) => !item.activityType && !item.tombstone);
    const sourceGroups = groupLibraryMaterials(savedMaterials, savedMaterials);
    const byDocument = new Map(documents.map((item) => [item.id, item]));
    const sourceMatchById = new Map(sourceMatches.map((match) => [match.id, match]));
    const documentMatchById = new Map(documentMatches.map((match) => [match.id, match]));
    const projectMatchById = new Map(projectMatches.map((match) => [match.id, match]));
    const localDocumentIds = documents
      .filter((item) => `${item.title} ${contentSummary(item.content)} ${item.project || ""}`.toLocaleLowerCase().includes(normalized))
      .map((item) => item.id);
    const sourceResults = sourceGroups.flatMap((group) => {
      const primary = group.bundle?.primaryComment ?? group.representative;
      const match = group.items.map((item) => sourceMatchById.get(item.id)).find(Boolean);
      const localMatch = `${sourceTitle(group.representative)} ${contentSummary(primary.content)} ${group.projects.join(" ")} ${group.items.flatMap((item) => item.tags || []).join(" ")}`.toLocaleLowerCase().includes(normalized);
      if (!match && !localMatch) return [];
      return [{
        kind: "source" as const,
        id: group.representative.id,
        title: contentSummary(primary.content, sourceTitle(group.representative)),
        detail: match?.reason || sourceTitle(group.representative),
      }];
    });
    const documentIds = [...new Set([...documentMatches.map((match) => match.id), ...localDocumentIds])];
    const documentResults = documentIds.flatMap((id) => {
      const item = byDocument.get(id);
      const match = documentMatchById.get(id);
      return item ? [{ kind: "document" as const, id, title: item.title, detail: match?.reason || contentSummary(item.content, item.project || "Document"), project: item.project }] : [];
    });
    const byProject = new Map(projects.map((item) => [item.id || item.name, item]));
    const localProjectIds = projects
      .filter((item) => `${item.name} ${item.overview || ""}`.toLocaleLowerCase().includes(normalized))
      .map((item) => item.id || item.name);
    const projectIds = [...new Set([...projectMatches.map((match) => match.id), ...localProjectIds])];
    const projectResults = projectIds.flatMap((id) => {
      const item = byProject.get(id);
      const match = projectMatchById.get(id);
      return item ? [{ kind: "project" as const, id, title: item.name, detail: match?.reason || item.overview || "Project" }] : [];
    });
    return [
      ...projectResults.slice(0, 6),
      ...documentResults.slice(0, 10),
      ...sourceResults.slice(0, 14),
    ];
  }, [documentMatches, documents, materials, projectMatches, projects, query, sourceMatches]);

  useEffect(() => {
    setActiveIndex(results.length ? 0 : -1);
  }, [query, results.length]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`global-find-result-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function openResult(result: FindResult) {
    navigateTo(result);
    onOpenChange(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-80 flex items-start justify-center bg-[rgb(26_27_24/18%)] px-6 pt-[12vh] pb-6 backdrop-blur-[2px]" role="presentation" onPointerDown={(event) => {
      if (event.currentTarget === event.target) onOpenChange(false);
    }}>
      <section ref={dialogRef} className="w-full max-w-[680px] overflow-hidden rounded-[14px] border border-[#d9d9d5] bg-white shadow-[0_24px_70px_rgb(24_26_22/22%)]" role="dialog" aria-modal="true" aria-labelledby="global-find-title" tabIndex={-1}>
        <div className="flex h-[58px] items-center gap-[11px] border-b border-line pr-3.5 pl-4.5 text-muted">
          <Search size={19} aria-hidden="true" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[18px] text-ink outline-0"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (!results.length) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % results.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                openResult(results[Math.max(0, activeIndex)]);
              }
            }}
            placeholder="Find anything in Logue"
            aria-label="Find anything in Logue"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="global-find-results"
            aria-activedescendant={activeIndex >= 0 ? `global-find-result-${activeIndex}` : undefined}
          />
          {catalogLoading || searching ? <span className="text-xs text-faint">Searching…</span> : null}
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-sm text-muted hover:bg-surface-muted hover:text-ink" aria-label="Close search" onClick={() => onOpenChange(false)}><X size={17} /></button>
        </div>
        <h2 id="global-find-title" className="sr-only">Global search</h2>
        <div id="global-find-results" className="max-h-[min(58vh,560px)] overflow-y-auto p-[7px]" role="listbox" aria-label="Search results">
          {error ? <div className="px-4.5 py-7 text-center text-muted" role="alert">{error}</div> : null}
          {error ? <button type="button" className="mx-auto mt-[-18px] mb-4.5 block rounded-sm bg-surface-muted px-[11px] py-[7px] text-ink-soft" onClick={() => setSearchAttempt((value) => value + 1)}>Try again</button> : null}
          {warning ? <div className="px-3 py-1.5 text-xs text-warning" role="status">{warning}</div> : null}
          {!query.trim() ? <div className="px-4.5 py-7 text-center text-muted">Search Sources, Documents, and Projects.</div> : null}
          {query.trim().length === 1 ? <div className="px-4.5 py-7 text-center text-muted">Type one more character to search.</div> : null}
          {query.trim().length >= 2 && !searching && !catalogLoading && !error && !results.length ? <div className="px-4.5 py-7 text-center text-muted">No results</div> : null}
          {results.map((result, index) => {
            const Icon = result.kind === "source" ? Library : result.kind === "document" ? FileText : FolderKanban;
            return <button
              type="button"
              id={`global-find-result-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={index === activeIndex}
              key={`${result.kind}:${result.id}`}
              className={`grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-md p-2 text-left text-ink-soft outline-0 hover:bg-surface-muted focus-visible:bg-surface-muted ${index === activeIndex ? "bg-surface-muted" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => openResult(result)}
            >
              <span className="inline-flex size-8 items-center justify-center rounded-[7px] bg-[#f0f0ed] text-[#686b65]"><Icon size={17} /></span>
              <span className="min-w-0"><strong className="block truncate text-sm font-[620]">{result.title}</strong><small className="mt-0.5 block truncate text-xs text-muted">{result.detail}</small></span>
              <em className="pr-1.5 text-xs not-italic text-muted">{result.kind === "source" ? "Source" : result.kind === "document" ? "Document" : "Project"}</em>
            </button>;
          })}
        </div>
        <footer className="flex gap-3.5 border-t border-line bg-[#fafaf9] px-3.5 py-2 text-[11px] text-faint">{results.length ? <><span>↑↓ Navigate</span><span>↵ Open</span></> : null}<span>Esc Close</span></footer>
      </section>
    </div>
  );
}
