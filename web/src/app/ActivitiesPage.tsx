import { Globe, Mic } from "lucide-react";
import { useState } from "react";
import { ErrorNote, OriginMark, Spinner, cn, originOf } from "@logue/ui";
import { api, type Material, type Topic } from "../api";
import { timeAgo, useHost } from "./useHost";

/**
 * Activities: everything the person did, newest first.
 *
 * Named by the owner — "it's a list of different actions from the user" — a
 * recording made, a passage kept, a page saved. Not an inbox: there was a
 * triage queue at the top of this page for exactly one deploy, 250 cards
 * asking for approval of the auto-filer's suggestions, and the owner's
 * verdict was that he could not name the feature it served. Suggestions stay
 * on each Source's own page, quietly.
 */
export function ActivitiesPage({ onOpen }: { onOpen: (id: string) => void }) {
  const materials = useHost(() => api.materials(), []);
  const topics = useHost(() => api.topics(), []);
  const [kind, setKind] = useState<"" | "voice" | "web">("");
  /** A group Logue noticed, used as a filter. Carried over from the old rail. */
  const [group, setGroup] = useState<Topic>();

  const inGroup = group ? new Set(group.source_ids) : undefined;
  const everything = (materials.data?.materials ?? []).filter((one) => {
    if (inGroup && !inGroup.has(one.id)) return false;
    if (kind === "voice") return Boolean(one.capture_id);
    if (kind === "web") return !one.capture_id;
    return true;
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="logue-scroll min-h-0 flex-1">
        <div className="mx-auto grid max-w-page content-start gap-3 px-8 py-6">
          <h1 className="sr-only">Activities</h1>
          {materials.error && <ErrorNote>{materials.error}</ErrorNote>}

          {/* ---- everything ---- */}
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-[600]">Activities{materials.data ? ` · ${everything.length}` : ""}</h2>
            <div className="ml-3 flex gap-1">
              <FilterChip on={kind === "voice"} onClick={() => setKind(kind === "voice" ? "" : "voice")}>
                <Mic size={11} /> Recorded
              </FilterChip>
              <FilterChip on={kind === "web"} onClick={() => setKind(kind === "web" ? "" : "web")}>
                <Globe size={11} /> From pages
              </FilterChip>
              {(topics.data?.topics ?? [])
                .toSorted((a, b) => b.source_ids.length - a.source_ids.length)
                .slice(0, 3)
                .map((topic) => (
                  <FilterChip
                    key={topic.id}
                    on={group?.id === topic.id}
                    onClick={() => setGroup(group?.id === topic.id ? undefined : topic)}
                  >
                    {topic.name}
                  </FilterChip>
                ))}
            </div>
            <span className="ml-auto text-xs text-muted">newest first</span>
          </div>

          {materials.loading && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Loading
            </div>
          )}
          {!materials.loading && everything.length === 0 && (
            <p className="text-xs text-muted">
              Nothing here yet. Speak into the side panel, or save a passage from any page.
            </p>
          )}
          <div className="divide-y divide-line">
            {everything.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item.id)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 px-1 py-2 text-left hover:bg-hover"
              >
                <OriginMark origin={originOf(item.kind)} />
                <span className="min-w-0">
                  <span className="mr-2 text-xs font-[560] whitespace-nowrap text-ink-soft">{verbOf(item)}</span>
                  <span className="text-[13px] text-ink">{condense(item.content)}</span>
                  {item.source?.domain && (
                    <span className="ml-2 text-xs whitespace-nowrap text-muted">{item.source.domain}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted">
                  {item.projects[0] ? `${item.projects[0]} · ` : ""}
                  {timeAgo(item.created_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs",
        on ? "border-ink bg-ink font-[560] text-white" : "border-control-line text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/**
 * What the person DID, said as a verb.
 *
 * The owner's words: "actions are different with different type and
 * purpose." A row that only shows content makes a recording, a kept quote
 * and a saved page look like the same act; the verb is what tells them
 * apart, and the icon agrees with it.
 */
function verbOf(item: Material): string {
  if (item.kind === "voice") {
    // The owner's examples, verbatim: "input and page translation are very
    // different, also voice comment/dictation". Same audio pipe, four acts.
    if (item.parent_ids?.length) return "Voice comment";
    if (item.source?.kind === "dictation") return "Dictated";
    if (item.source?.kind === "panel") return "Spoke to Logue";
    if (item.source?.url) return "Dictated into";
    return "Recorded";
  }
  if (item.kind === "selection") return "Kept a passage";
  if (item.kind === "page") return "Saved the page";
  if (item.kind === "derived") return "Generated";
  return "Typed";
}

/** The first line, breathable. */
function condense(content: string, limit = 140): string {
  const line = content.split("\n").find((one) => one.trim()) ?? "";
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}
