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
  type LogueDocument,
  type ProjectSummary,
} from "../api";
import type { Material } from "@logue/ui";
import { contentSummary } from "../v2-real/contentPresentation";

type FindResult =
  | { kind: "source"; id: string; title: string; detail: string }
  | { kind: "document"; id: string; title: string; detail: string; project?: string }
  | { kind: "project"; id: string; title: string; detail: string };

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
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusBoundary<HTMLElement>({ open, onClose: () => onOpenChange(false) });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSourceIds([]);
    setDocumentIds([]);
    setProjectIds([]);
    setActiveIndex(-1);
    setError("");
    setLoading(true);
    void Promise.all([getMaterials(), getDocuments(), getProjects()])
      .then(([nextMaterials, nextDocuments, nextProjects]) => {
        setMaterials(nextMaterials);
        setDocuments(nextDocuments);
        setProjects(nextProjects);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Search is unavailable."))
      .finally(() => setLoading(false));
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSourceIds([]);
      setDocumentIds([]);
      setProjectIds([]);
      return;
    }
    const controller = new AbortController();
    let active = true;
    let requestTimeout = 0;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      requestTimeout = window.setTimeout(() => controller.abort(), 2500);
      void Promise.all([
        searchMaterials(normalized, controller.signal),
        searchDocuments(normalized, controller.signal),
        searchProjects(normalized, controller.signal),
      ])
        .then(([sourceMatches, documentMatches, projectMatches]) => {
          setSourceIds(sourceMatches.matches.map((match) => match.id));
          setDocumentIds(documentMatches.matches.map((match) => match.id));
          setProjectIds(projectMatches.matches.map((match) => match.id));
        })
        .catch((cause) => {
          if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Search is unavailable.");
        })
        .finally(() => {
          window.clearTimeout(requestTimeout);
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [open, query]);

  const results = useMemo<FindResult[]>(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length < 2) return [];
    const byMaterial = new Map(materials.map((item) => [item.id, item]));
    const byDocument = new Map(documents.map((item) => [item.id, item]));
    const localSourceIds = materials
      .filter((item) => `${sourceTitle(item)} ${contentSummary(item.content)} ${(item.projects || []).join(" ")} ${(item.tags || []).join(" ")}`.toLocaleLowerCase().includes(normalized))
      .map((item) => item.id);
    const localDocumentIds = documents
      .filter((item) => `${item.title} ${contentSummary(item.content)} ${item.project || ""}`.toLocaleLowerCase().includes(normalized))
      .map((item) => item.id);
    const sourceResults = [...new Set([...sourceIds, ...localSourceIds])].flatMap((id) => {
      const item = byMaterial.get(id);
      return item ? [{ kind: "source" as const, id, title: sourceTitle(item), detail: contentSummary(item.content, item.source?.domain || "Saved Source") }] : [];
    });
    const documentResults = [...new Set([...documentIds, ...localDocumentIds])].flatMap((id) => {
      const item = byDocument.get(id);
      return item ? [{ kind: "document" as const, id, title: item.title, detail: contentSummary(item.content, item.project || "Document"), project: item.project }] : [];
    });
    const byProject = new Map(projects.map((item) => [item.id || item.name, item]));
    const localProjectIds = projects
      .filter((item) => `${item.name} ${item.overview || ""}`.toLocaleLowerCase().includes(normalized))
      .map((item) => item.id || item.name);
    const projectResults = [...new Set([...projectIds, ...localProjectIds])].flatMap((id) => {
      const item = byProject.get(id);
      return item ? [{ kind: "project" as const, id, title: item.name, detail: item.overview || "Project" }] : [];
    });
    return [
      ...projectResults.slice(0, 6),
      ...documentResults.slice(0, 10),
      ...sourceResults.slice(0, 14),
    ];
  }, [documentIds, documents, materials, projectIds, projects, query, sourceIds]);

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
    <div className="v2-global-find-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.currentTarget === event.target) onOpenChange(false);
    }}>
      <section ref={dialogRef} className="v2-global-find-dialog" role="dialog" aria-modal="true" aria-labelledby="global-find-title" tabIndex={-1}>
        <div className="v2-global-find-input">
          <Search size={19} aria-hidden="true" />
          <input
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
          {loading ? <span className="v2-global-find-loading">Searching…</span> : null}
          <button type="button" aria-label="Close search" onClick={() => onOpenChange(false)}><X size={17} /></button>
        </div>
        <h2 id="global-find-title" className="sr-only">Global search</h2>
        <div id="global-find-results" className="v2-global-find-results" role="listbox" aria-label="Search results">
          {error ? <div className="v2-global-find-message" role="alert">{error}</div> : null}
          {!query.trim() ? <div className="v2-global-find-message">Search Sources, Documents, and Projects.</div> : null}
          {query.trim().length === 1 ? <div className="v2-global-find-message">Type one more character to search.</div> : null}
          {query.trim().length >= 2 && !loading && !error && !results.length ? <div className="v2-global-find-message">No results</div> : null}
          {results.map((result, index) => {
            const Icon = result.kind === "source" ? Library : result.kind === "document" ? FileText : FolderKanban;
            return <button
              type="button"
              id={`global-find-result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              key={`${result.kind}:${result.id}`}
              className={`v2-global-find-result${index === activeIndex ? " is-active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => openResult(result)}
            >
              <span className="v2-global-find-icon"><Icon size={17} /></span>
              <span><strong>{result.title}</strong><small>{result.detail}</small></span>
              <em>{result.kind === "source" ? "Source" : result.kind === "document" ? "Document" : "Project"}</em>
            </button>;
          })}
        </div>
        <footer><span>↑↓ Navigate</span><span>↵ Open</span><span>Esc Close</span></footer>
      </section>
    </div>
  );
}
