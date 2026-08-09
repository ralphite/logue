import { FileText, FolderOpen, Layers, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Spinner, cn } from "@logue/ui";
import { api } from "../api";
import { useHost } from "./useHost";

export type FindTarget =
  | { kind: "source"; id: string }
  | { kind: "document"; id: string }
  | { kind: "project"; id: string }
  | { kind: "skill"; id: string };

interface Hit {
  key: string;
  target: FindTarget;
  title: string;
  detail: string;
  icon: typeof Layers;
}

const PER_KIND = 6;

function condense(text: string, limit = 90): string {
  const line = (text || "").trim().replace(/\s+/g, " ");
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

/**
 * One box for everything.
 *
 * Five destinations is few enough to navigate by hand and too many to search
 * one at a time — the thing you half-remember is a sentence, and you do not
 * remember whether you said it, saved it, or wrote it down.
 */
export function FindDialog({
  open,
  onClose,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  onGo: (target: FindTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  // Loaded when the dialog opens, not on every keystroke: this is a local Host
  // and the whole workspace is a few hundred rows.
  const materials = useHost(() => (open ? api.materials() : Promise.resolve({ materials: [] })), [open]);
  const documents = useHost(() => (open ? api.documents() : Promise.resolve({ documents: [] })), [open]);
  const projects = useHost(() => (open ? api.projects() : Promise.resolve({ projects: [] })), [open]);
  // Skills belong here too. "One Find, and it searches everything" was not
  // true while the one section whose rows are prompts you wrote by hand — the
  // ones hardest to find by scrolling — was the section it skipped.
  const skills = useHost(() => (open ? api.skills() : Promise.resolve({ skills: [] })), [open]);

  const hits = useMemo<Hit[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const found: Hit[] = [];
    for (const project of projects.data?.projects ?? []) {
      if (!`${project.name} ${project.overview}`.toLowerCase().includes(needle)) continue;
      found.push({
        key: `p${project.id}`,
        target: { kind: "project", id: project.id },
        title: project.name,
        detail: condense(project.overview) || "Project",
        icon: FolderOpen,
      });
      if (found.length >= PER_KIND) break;
    }
    let docs = 0;
    for (const document of documents.data?.documents ?? []) {
      if (!`${document.title} ${document.content}`.toLowerCase().includes(needle)) continue;
      found.push({
        key: `d${document.id}`,
        target: { kind: "document", id: document.id },
        title: document.title || "Untitled",
        detail: condense(document.content.replace(/<[^>]+>/g, " ")),
        icon: FileText,
      });
      if (++docs >= PER_KIND) break;
    }
    let found_skills = 0;
    for (const skill of skills.data?.skills ?? []) {
      if (!`${skill.name} ${skill.purpose ?? ""} ${skill.instructions ?? ""}`.toLowerCase().includes(needle)) continue;
      found.push({
        key: `k${skill.id}`,
        target: { kind: "skill", id: skill.id },
        title: skill.name,
        detail: condense(skill.purpose || skill.instructions || "") || "Skill",
        icon: Sparkles,
      });
      if (++found_skills >= PER_KIND) break;
    }
    let sources = 0;
    for (const material of materials.data?.materials ?? []) {
      const haystack = `${material.content} ${material.source?.title ?? ""} ${(material.tags ?? []).join(" ")}`;
      if (!haystack.toLowerCase().includes(needle)) continue;
      found.push({
        key: `s${material.id}`,
        target: { kind: "source", id: material.id },
        title: condense(material.content) || "Empty",
        detail: material.source?.domain || material.source?.title || "This Mac",
        icon: Layers,
      });
      if (++sources >= PER_KIND) break;
    }
    return found;
  }, [query, materials.data, documents.data, projects.data, skills.data]);

  useEffect(() => setAt(0), [query]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Keep the highlighted row on screen when arrowing past the fold.
  useEffect(() => {
    list.current?.querySelector('[data-at="true"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);

  if (!open) return null;
  const loading = materials.loading || documents.loading || projects.loading || skills.loading;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-popover flex items-start justify-center bg-[rgb(15_15_15/24%)] pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Find anything"
        className="w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line bg-panel shadow-[0_18px_48px_rgb(15_15_15/18%)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={14} className="shrink-0 text-faint" />
          <Input
            autoFocus
            value={query}
            aria-label="Find anything"
            placeholder="Find a Source, a Document, a Project"
            bare
            className="h-11 w-full bg-transparent px-0 text-[14px]"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setAt((was) => Math.min(was + 1, hits.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setAt((was) => Math.max(was - 1, 0));
              }
              if (event.key === "Enter" && hits[at]) {
                event.preventDefault();
                onGo(hits[at].target);
                onClose();
              }
            }}
          />
          {loading && <Spinner size={13} />}
        </div>

        <div ref={list} className="logue-scroll max-h-[52vh]">
          {query && hits.length === 0 && !loading && (
            <p className="px-3 py-6 text-center text-xs text-muted">Nothing matches that.</p>
          )}
          {!query && (
            <p className="px-3 py-6 text-center text-xs text-faint">
              Everything you have captured, written, or organised.
            </p>
          )}
          {hits.map((hit, index) => {
            const Icon = hit.icon;
            return (
              <button
                key={hit.key}
                type="button"
                data-at={index === at ? "true" : undefined}
                onMouseEnter={() => setAt(index)}
                onClick={() => {
                  onGo(hit.target);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                  index === at ? "bg-active" : "hover:bg-hover",
                )}
              >
                <Icon size={14} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{hit.title}</span>
                  <span className="block truncate text-[11px] text-muted">{hit.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
