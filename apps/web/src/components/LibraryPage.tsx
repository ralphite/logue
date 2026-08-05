import { FileAudio, FileText, Globe2, Mic2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getSources, type Source } from "../api";
import { pageColumnClass } from "./layout";
import { PageHeader } from "./ui";

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
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;
    void getSources()
      .then((nextSources) => {
        if (!current) return;
        setSources(nextSources);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : "Couldn't load Library.");
      });
    return () => { current = false; };
  }, []);

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <PageHeader title="Library" testId="library-header-column" />
      <div className="scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={`${pageColumnClass} pb-16 pt-7`}>
          {error ? <p role="alert" className="mt-8 text-[15px] text-[#a24a42]">{error}</p> : sources.length === 0 ? (
            <section className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
              <FileText size={20} className="text-[#858680]" />
              <p className="mt-4 text-[15px] leading-6 text-[#6d6e69]">Save something from the extension.</p>
            </section>
          ) : <ol className="mt-7 divide-y divide-[#eeeeeb] border-y border-[#e7e7e4]">
            {sources.map((source) => {
              const Icon = sourceIcon(source);
              return <li key={source.id} className="flex min-h-14 items-center gap-3 px-3 py-3"><Icon size={16} className="shrink-0 text-[#777873]" /><span className="min-w-0 flex-1 truncate text-[15px] text-[#393a36]">{source.content}</span><span className="hidden shrink-0 text-[14px] text-[#92938e] sm:inline">{sourceOrigin(source)}</span><span className="shrink-0 text-[14px] text-[#92938e]">{shortDate(source.createdAt)}</span></li>;
            })}
          </ol>}
        </div>
      </div>
    </main>
  );
}
