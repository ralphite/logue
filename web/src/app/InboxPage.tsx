import { Check, Globe, Mic } from "lucide-react";
import { useState } from "react";
import { Button, ErrorNote, OriginMark, Spinner, Tag, cn, originOf } from "@logue/ui";
import { api, type Material, type Topic } from "../api";
import { timeAgo, useAction, useHost } from "./useHost";

/**
 * The Inbox: what just arrived, then everything.
 *
 * The product's loop is capture → file → use, and the filing step had no
 * page: the queue lived behind a chip in a rail while organize's suggestions
 * sat at the bottom of each detail view, three clicks from yes. Now new
 * captures wait at the top with their suggestion on the card — accepting is
 * one press — and the whole stream reads below, newest first. When the queue
 * is empty the section is one quiet line, which is the goal state, not a
 * failure.
 */
export function InboxPage({ onOpen }: { onOpen: (id: string) => void }) {
  const materials = useHost(() => api.materials(), []);
  const review = useHost(() => api.review(), []);
  const topics = useHost(() => api.topics(), []);
  const action = useAction();
  const [kind, setKind] = useState<"" | "voice" | "web">("");
  /** A group Logue noticed, used as a filter. Carried over from the old rail. */
  const [group, setGroup] = useState<Topic>();

  const waiting = review.data?.materials ?? [];
  const inGroup = group ? new Set(group.source_ids) : undefined;
  const everything = (materials.data?.materials ?? []).filter((one) => {
    if (inGroup && !inGroup.has(one.id)) return false;
    if (kind === "voice") return Boolean(one.capture_id);
    if (kind === "web") return !one.capture_id;
    return true;
  });

  const refresh = () => {
    void materials.refresh();
    void review.refresh();
  };

  const resolve = (id: string, accept: boolean) =>
    void action.run(() => api.resolveOrganization(id, { accept, supersede: false })).then((ok) => ok && refresh());

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="logue-scroll min-h-0 flex-1">
        <div className="mx-auto grid max-w-page content-start gap-3 px-8 py-6">
          <h1 className="sr-only">Inbox</h1>
          {(materials.error || review.error) && <ErrorNote>{materials.error || review.error}</ErrorNote>}
          {action.error && <ErrorNote>{action.error}</ErrorNote>}

          {/* ---- to file ---- */}
          {waiting.length > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-[600]">To file · {waiting.length}</h2>
                <span className="ml-auto text-xs text-muted">accept the suggestion, adjust it, or skip</span>
              </div>
              {waiting.map((item) => (
                <TriageCard
                  key={item.id}
                  material={item}
                  busy={action.busy}
                  onOpen={() => onOpen(item.id)}
                  onFile={() => resolve(item.id, true)}
                  onSkip={() => resolve(item.id, false)}
                />
              ))}
            </>
          ) : (
            !review.loading && (
              <p className="text-xs text-muted">Nothing to file. New captures land here first.</p>
            )
          )}

          {/* ---- everything ---- */}
          <div className="mt-2 flex items-center gap-2 border-t border-line pt-3">
            <h2 className="text-[15px] font-[600]">Everything{materials.data ? ` · ${everything.length}` : ""}</h2>
            <div className="ml-3 flex gap-1">
              <FilterChip on={kind === "voice"} onClick={() => setKind(kind === "voice" ? "" : "voice")}>
                <Mic size={11} /> Voice
              </FilterChip>
              <FilterChip on={kind === "web"} onClick={() => setKind(kind === "web" ? "" : "web")}>
                <Globe size={11} /> Pages
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
                className="flex w-full items-center gap-2.5 px-1 py-2 text-left hover:bg-hover"
              >
                <OriginMark origin={originOf(item.kind)} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{condense(item.content)}</span>
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

/** One new capture: the words, the origin, the suggestion, and one yes. */
function TriageCard({
  material,
  busy,
  onOpen,
  onFile,
  onSkip,
}: {
  material: Material;
  busy: boolean;
  onOpen: () => void;
  onFile: () => void;
  onSkip: () => void;
}) {
  const suggested = material.organization?.suggested_projects ?? [];
  const tags = material.organization?.suggested_tags ?? [];
  return (
    <div className="grid gap-2 rounded-lg border border-accent-line bg-surface p-3.5">
      <button type="button" onClick={onOpen} className="text-left">
        <p className="line-clamp-2 text-[14px] leading-normal text-ink">{material.content}</p>
      </button>
      <div className="flex flex-wrap items-center gap-1.5">
        <OriginMark origin={originOf(material.kind)} detail={timeAgo(material.created_at)} />
        {material.source?.domain && <span className="text-xs text-muted">· {material.source.domain}</span>}
        <span className="flex-1" />
        {(suggested.length > 0 || tags.length > 0) && <span className="text-xs text-muted">Suggested:</span>}
        {suggested.map((name) => (
          <span key={name} className="inline-flex h-control items-center gap-1 rounded-md bg-ink px-2 text-xs font-[560] text-white">
            <Check size={11} /> {name}
          </span>
        ))}
        {tags.map((name) => (
          <Tag key={name} name={name} />
        ))}
        <Button variant="primary" disabled={busy} onClick={onFile}>
          File <kbd>↵</kbd>
        </Button>
        <Button disabled={busy} onClick={onOpen}>
          Edit
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onSkip}>
          Skip
        </Button>
      </div>
      {material.organization?.reason && (
        <p className="text-xs leading-normal text-muted">{material.organization.reason}</p>
      )}
    </div>
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

/** The first line, breathable. */
function condense(content: string, limit = 140): string {
  const line = content.split("\n").find((one) => one.trim()) ?? "";
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}
