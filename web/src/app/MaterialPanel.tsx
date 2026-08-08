import { ExternalLink, FileText, Sparkles, X } from "lucide-react";
import { Fragment, useState } from "react";
import { Button, ErrorNote, IconButton, Input, OriginMark, SourceLink, Spinner, Tag, originOf } from "@logue/ui";
import { api, type Material, type Project } from "../api";
import { timeAgo, useAction, useHost } from "./useHost";

/**
 * One Source, and the chain it belongs to. This panel is where the product's
 * promise is inspectable: what the page said, what you added, and what came out.
 */
export function MaterialPanel({
  materialId,
  onClose,
  onChanged,
  projects,
  onOpenDocument,
}: {
  materialId: string;
  onClose: () => void;
  onChanged: () => void;
  projects: Project[];
  onOpenDocument?: (id: string) => void;
}) {
  const lineage = useHost(() => api.lineage(materialId), [materialId]);
  const action = useAction();
  const material = lineage.data?.material;

  return (
    // Not a drawer any more: the list lives in the rail, so this is simply
    // what the main area is for.
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <span className="truncate text-[13px] font-[560] text-ink">{material ? material.kind : "Source"}</span>
        <IconButton label="Close" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>

      <div className="logue-scroll min-h-0 flex-1">
        <div className="mx-auto grid max-w-reading gap-3 px-8 py-6">
        {lineage.error && <ErrorNote>{lineage.error}</ErrorNote>}
        {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}
        {!material ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner /> Loading
          </div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <OriginMark origin={originOf(material.kind)} detail={timeAgo(material.created_at)} />
              <p className="text-[13px] leading-normal whitespace-pre-wrap text-ink">{material.content}</p>
              {material.context && material.context !== material.content && (
                <details className="text-meta text-muted">
                  <summary className="cursor-pointer select-none">In context</summary>
                  <p className="mt-1 leading-normal text-ink-soft">{material.context}</p>
                </details>
              )}
            </div>

            {material.source?.url && (
              <a
                href={material.source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <ExternalLink size={12} />
                <span className="truncate">{material.source.title || material.source.url}</span>
              </a>
            )}

            {material.capture_id && (
              <audio controls src={api.audioUrl(material.capture_id)} className="h-8 w-full" />
            )}

            {material.capture_id && (
              <Transcript
                material={material}
                busy={action.busy}
                onChanged={() => {
                  void lineage.refresh();
                  onChanged();
                }}
                run={action.run}
              />
            )}

            <HowItWasHeard applied={material.applied_context} />

            <Lineage title="Came from" items={lineage.data?.parents ?? []} />
            <UsedIn materialId={material.id} onOpenDocument={onOpenDocument} />

            {material.organization?.status === "needs_review" && (
              <div className="grid gap-1.5 rounded-lg border border-accent-line bg-accent-soft px-2.5 py-2">
                <span className="text-[11px] text-accent-ink">Logue suggests</span>
                <span className="flex flex-wrap items-center gap-1 text-[11px]">
                  {(material.organization.suggested_projects ?? []).map((name) => (
                    <span key={name} className="rounded-sm bg-panel px-1 text-ink-soft">
                      {name}
                    </span>
                  ))}
                  {(material.organization.suggested_tags ?? []).map((name) => (
                    <Tag key={name} name={name} className="bg-panel" />
                  ))}
                </span>
                {material.organization.reason && (
                  <span className="text-[11px] leading-normal text-muted">{material.organization.reason}</span>
                )}
                <span className="flex justify-end gap-1">
                  <Button
                    variant="primary"
                    disabled={action.busy}
                    onClick={() =>
                      void action
                        .run(() => api.resolveOrganization(material.id, { accept: true }))
                        .then((ok) => ok && (lineage.refresh(), onChanged()))
                    }
                  >
                    File it
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={action.busy}
                    onClick={() =>
                      void action
                        .run(() => api.resolveOrganization(material.id, { accept: false }))
                        .then((ok) => ok && (lineage.refresh(), onChanged()))
                    }
                  >
                    Skip
                  </Button>
                </span>
              </div>
            )}

            <Tags
              material={material}
              busy={action.busy}
              onSave={(tags) =>
                void action
                  .run(() => api.updateMaterial(material.id, { tags }))
                  .then((ok) => ok && (lineage.refresh(), onChanged()))
              }
            />

            <div className="grid gap-1.5 border-t border-line pt-3">
              <span className="text-xs text-muted">Projects</span>
              <div className="flex flex-wrap gap-1">
                {projects.map((project) => {
                  const member = material.projects.includes(project.name);
                  return (
                    <Button
                      key={project.id}
                      variant={member ? "primary" : "default"}
                      disabled={action.busy}
                      onClick={() =>
                        void action
                          .run(() => api.setMembership(material.id, project.name, !member))
                          .then((ok) => ok && (lineage.refresh(), onChanged()))
                      }
                    >
                      {project.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </section>
  );
}

/**
 * Hearing it again, and telling Logue what it got wrong.
 *
 * The audio is kept, so a mishearing is fixable rather than something to
 * retype — and a correction made here is remembered, because correcting the
 * same name every week is the clearest sign the product is not listening.
 */
function Transcript({
  material,
  busy,
  onChanged,
  run,
}: {
  material: Material;
  busy: boolean;
  onChanged: () => void;
  run: (work: () => Promise<unknown>) => Promise<boolean>;
}) {
  const history = useHost(() => api.transcriptRevisions(material.id), [material.id]);
  const [fixing, setFixing] = useState(false);
  const [spoken, setSpoken] = useState("");
  const [preferred, setPreferred] = useState("");
  const revisions = history.data?.revisions ?? [];

  const again = (correction?: { spoken: string; preferred: string }) =>
    void run(() => api.retranscribe(material.id, correction)).then((ok) => {
      if (!ok) return;
      setFixing(false);
      setSpoken("");
      setPreferred("");
      void history.refresh();
      onChanged();
    });

  return (
    <div className="grid gap-1.5 border-t border-line pt-3">
      <span className="flex items-center gap-2 text-xs text-muted">
        Transcript
        {revisions.length > 0 && <span className="text-faint">{revisions.length} earlier</span>}
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" disabled={busy} onClick={() => setFixing(!fixing)}>
            Fix a word
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => again()}>
            {busy ? <Spinner size={12} /> : null} Hear it again
          </Button>
        </span>
      </span>

      {fixing && (
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <Input
            autoFocus
            value={spoken}
            placeholder="It wrote…"
            aria-label="What it wrote"
            className="h-6 w-28 px-1.5 text-[11px]"
            onChange={(event) => setSpoken(event.target.value)}
          />
          <span className="text-faint">→</span>
          <Input
            value={preferred}
            placeholder="…should be"
            aria-label="What it should be"
            className="h-6 w-28 px-1.5 text-[11px]"
            onChange={(event) => setPreferred(event.target.value)}
          />
          <Button
            variant="primary"
            disabled={busy || !spoken.trim() || !preferred.trim()}
            onClick={() => again({ spoken: spoken.trim(), preferred: preferred.trim() })}
          >
            Fix and remember
          </Button>
        </div>
      )}

      {revisions.length > 0 && (
        <details className="text-meta text-muted">
          <summary className="cursor-pointer select-none">What it said before</summary>
          <div className="mt-1 grid gap-1">
            {revisions
              .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
              .map((revision) => (
                <div key={revision.id} className="flex items-start gap-2 rounded-md bg-surface-muted px-2 py-1.5">
                  <span className="min-w-0 flex-1 leading-normal text-ink-soft">
                    {revision.transcript ?? revision.text}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(() => api.useRevision(material.id, revision.id)).then((ok) => {
                        if (!ok) return;
                        void history.refresh();
                        onChanged();
                      })
                    }
                  >
                    Use this
                  </Button>
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Why the transcript came out the way it did.
 *
 * Folded away because it is only ever wanted when something is wrong — and
 * when it is wanted, nothing else will do. The profile, the Skill and the term
 * list have all moved on by then, so this is the record as it was, not a
 * lookup of how things are now.
 */
function HowItWasHeard({ applied }: { applied?: Material["applied_context"] }) {
  if (!applied) return null;
  // Only what was actually recorded. Filling a blank with "Default voice"
  // would claim a setting that may simply not have been captured — and the
  // 80 recordings from before this was tracked keep a different set of keys.
  const lines = (
    [
      ["Voice", applied.profile],
      ["Project", applied.project ?? applied.reference_project],
      ["Language", applied.language],
      ["Skill", applied.skill ? `${applied.skill.name} · revision ${applied.skill.revision}` : ""],
      ["Terms", (applied.terms ?? applied.glossary ?? []).join(", ")],
      ["Vocabulary", applied.vocabulary],
      ["From the page", applied.page_context_characters ? `${applied.page_context_characters} characters` : ""],
    ] as [string, string | undefined][]
  ).filter((line): line is [string, string] => Boolean(line[1]));
  if (lines.length === 0 && !applied.instructions) return null;
  return (
    <details className="border-t border-line pt-3 text-meta text-muted">
      <summary className="cursor-pointer select-none">How this was heard</summary>
      <dl className="mt-1.5 grid grid-cols-[84px_minmax(0,1fr)] gap-x-2 gap-y-1">
        {lines.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-faint">{label}</dt>
            <dd className="break-words text-ink-soft">{value}</dd>
          </Fragment>
        ))}
      </dl>
      {applied.instructions && (
        <p className="mt-2 rounded-md bg-surface-muted px-2 py-1.5 leading-normal whitespace-pre-wrap text-ink-soft">
          {applied.instructions}
        </p>
      )}
    </details>
  );
}

/**
 * What this Source is about, in the person's own words.
 *
 * Tags were recorded from the start and never shown anywhere, so a third of
 * this workspace carries labels nobody could read back.
 */
function Tags({
  material,
  busy,
  onSave,
}: {
  material: Material;
  busy: boolean;
  onSave: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState("");
  const tags = material.tags ?? [];

  const add = () => {
    const name = adding.trim().replace(/^#/, "");
    setAdding("");
    if (name && !tags.includes(name)) onSave([...tags, name]);
  };

  return (
    <div className="grid gap-1.5 border-t border-line pt-3">
      <span className="text-xs text-muted">Tags</span>
      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        {tags.map((name) => (
          <Tag key={name} name={name} onRemove={() => onSave(tags.filter((t) => t !== name))} />
        ))}
        <Input
          value={adding}
          disabled={busy}
          onChange={(event) => setAdding(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
            if (event.key === "Escape") setAdding("");
          }}
          placeholder={tags.length ? "Add" : "Add a tag"}
          aria-label="Add a tag"
          className="h-6 w-24 px-1.5 text-[11px]"
        />
      </div>
    </div>
  );
}

/**
 * What has been built on this Source.
 *
 * "Led to" used to list only the comments made on it, which is the smallest
 * part of the answer. The question worth asking of a Source is which answers
 * cited it and which documents are standing on it — that is what makes
 * deleting it consequential, and what makes keeping it worthwhile.
 */
function UsedIn({
  materialId,
  onOpenDocument,
}: {
  materialId: string;
  onOpenDocument?: (id: string) => void;
}) {
  const used = useHost(() => api.dependencies(materialId), [materialId]);
  const runs = used.data?.runs ?? [];
  const documents = used.data?.documents ?? [];
  const derived = used.data?.derived ?? [];
  const total = runs.length + documents.length + derived.length;

  return (
    <div className="grid gap-1 border-t border-line pt-3">
      <span className="text-xs text-muted">
        Used in {total === 0 ? <span className="text-faint">nothing yet</span> : total}
      </span>

      {documents.map((document) => (
        <button
          key={document.id}
          type="button"
          disabled={!onOpenDocument}
          onClick={() => onOpenDocument?.(document.id)}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-ink-soft enabled:hover:bg-hover enabled:hover:text-ink"
        >
          <FileText size={12} className="shrink-0 text-muted" />
          <span className="truncate">{document.title || "Untitled"}</span>
        </button>
      ))}

      {runs.map((run) => (
        <span key={run.id} className="flex items-center gap-1.5 px-1.5 py-1 text-xs text-ink-soft">
          <Sparkles size={12} className="shrink-0 text-muted" />
          <span className="truncate">{run.instruction}</span>
        </span>
      ))}

      {derived.map((item) => (
        <span key={item.id} className="rounded-md bg-surface-muted px-2 py-1.5">
          <OriginMark origin="ai" />
          <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-ink-soft">{item.content}</p>
        </span>
      ))}
    </div>
  );
}

function Lineage({ title, items }: { title: string; items: Material[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-1 border-t border-line pt-3">
      <span className="text-xs text-muted">{title}</span>
      {items.map((item) => (
        <div key={item.id} className="rounded-md bg-surface-muted px-2 py-1.5">
          <span className="flex items-center gap-2 text-[11px] text-muted">
            <OriginMark origin={originOf(item.kind)} />
            <SourceLink url={item.source?.url} label={item.source?.domain || "This Mac"} />
          </span>
          <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-ink-soft">{item.content}</p>
        </div>
      ))}
    </div>
  );
}
