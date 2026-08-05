import { FileAudio, FileText, Globe2, Mic2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getPages, getSources, type LogueDocument, type Source } from "../api";
import { pageColumnClass } from "./layout";
import { Button, PageHeader } from "./ui";

type LibraryFilter = "all" | "sources" | "pages";

function sourceIcon(source: Source) {
  return source.type === "voice" ? Mic2 : source.type === "selection" ? FileText : Globe2;
}

function sourceOrigin(source: Source) {
  return source.origin?.domain || source.origin?.title || "Saved from Logue";
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LibraryPage() {
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<LogueDocument[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;
    void Promise.all([getSources(), getPages()])
      .then(([nextSources, nextPages]) => {
        if (!current) return;
        setSources(nextSources);
        setPages(nextPages);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : "Couldn't load Library.");
      });
    return () => { current = false; };
  }, []);

  const rows = useMemo(() => [
    ...(filter === "pages" ? [] : sources.map((source) => ({ type: "source" as const, value: source, timestamp: source.createdAt }))),
    ...(filter === "sources" ? [] : pages.map((page) => ({ type: "page" as const, value: page, timestamp: page.updated_at }))),
  ].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)), [filter, pages, sources]);

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <PageHeader title="Library" testId="library-header-column" />
      <div className="scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={`${pageColumnClass} pb-16 pt-7`}>
          <div className="inline-flex rounded-lg bg-[#f3f3f0] p-1" aria-label="Library filter">
            {(["all", "sources", "pages"] as const).map((value) => (
              <Button key={value} variant={filter === value ? "secondary" : "ghost"} size="sm" onClick={() => setFilter(value)}>
                {value[0].toUpperCase() + value.slice(1)}
              </Button>
            ))}
          </div>
          {error ? <p role="alert" className="mt-8 text-[15px] text-[#a24a42]">{error}</p> : rows.length === 0 ? (
            <section className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
              <FileText size={20} className="text-[#858680]" />
              <p className="mt-4 text-[15px] leading-6 text-[#6d6e69]">Save something from the extension, or create a page.</p>
            </section>
          ) : <ol className="mt-7 divide-y divide-[#eeeeeb] border-y border-[#e7e7e4]">
            {rows.map((row) => {
              if (row.type === "page") {
                const page = row.value;
                return <li key={page.id} className="flex min-h-14 items-center gap-3 px-3 py-3"><FileText size={16} className="shrink-0 text-[#777873]" /><span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[#393a36]">{page.title}</span><span className="shrink-0 text-[14px] text-[#92938e]">{shortDate(page.updated_at)}</span></li>;
              }
              const source = row.value;
              const Icon = sourceIcon(source);
              return <li key={source.id} className="flex min-h-14 items-center gap-3 px-3 py-3"><Icon size={16} className="shrink-0 text-[#777873]" /><span className="min-w-0 flex-1 truncate text-[15px] text-[#393a36]">{source.content}</span><span className="hidden shrink-0 text-[14px] text-[#92938e] sm:inline">{sourceOrigin(source)}</span><span className="shrink-0 text-[14px] text-[#92938e]">{shortDate(source.createdAt)}</span></li>;
            })}
          </ol>}
        </div>
      </div>
    </main>
  );
}
