import { Check, ExternalLink, FileText, Sparkles, X } from "lucide-react";
import { Fragment, useState } from "react";
import {
  Button,
  ErrorNote,
  IconButton,
  Input,
  OriginMark,
  Recording,
  SourceLink,
  Spinner,
  Tag,
  cn,
  originOf,
} from "@logue/ui";
import { api, type Material, type Project } from "../api";
import { timeAgo, useAction, useHost } from "./useHost";

/**
 * One Source, and the chain it belongs to. This panel is where the product's
 * promise is inspectable: what the page said, what you added, and what came out.
 */
/** The first breathable phrase of the content: the Source's own name. */
function firstWords(content: string): string {
  const line = content.split("\n").find((one) => one.trim()) ?? "";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line || "Source";
}

export function MaterialPanel({
  materialId,
  onClose,
  onChanged,
  projects,
  onOpenDocument,
  onOpenMaterial,
}: {
  materialId: string;
  onClose: () => void;
  onChanged: () => void;
  projects: Project[];
  onOpenDocument?: (id: string) => void;
  /** Follow a replacement, in either direction. */
  onOpenMaterial?: (id: string) => void;
}) {
  const lineage = useHost(() => api.lineage(materialId), [materialId]);
  const action = useAction();
  const material = lineage.data?.material;

  return (
    // Not a drawer any more: the list lives in the rail, so this is simply
    // what the main area is for.
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        {/*
          The words, not the type. This bar used to read "voice" — the one
          fact shared by half the workspace, standing where the identity goes,
          while the words that make this Source itself sat two sections down.
          The kind, the age and the origin are one muted phrase beside it:
          together they are the identity line of a Source anywhere.
        */}
        <h1 className="min-w-0 flex-1 truncate text-[13px] font-[560] text-ink">
          {material ? firstWords(material.content) : "Source"}
        </h1>
        {material && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted">
            <OriginMark origin={originOf(material.kind)} detail={timeAgo(material.created_at)} />
            {material.source?.domain && <span>· {material.source.domain}</span>}
          </span>
        )}
        <IconButton label="Close this Source" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>

      <div className="logue-scroll min-h-0 flex-1">
        <div className="mx-auto grid max-w-page gap-3 px-8 py-6">
          {lineage.error && <ErrorNote>{lineage.error}</ErrorNote>}
          {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}
          {!material ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Loading
            </div>
          ) : (
            <>
              {/*
                What cannot change comes first, and the two kinds of it are
                kept apart: the recording is what you said, the passage is
                what the page gave. Everything below them is derived from
                them — the transcript most of all — and the order used to say
                the opposite, with the transcript on top and the passage last.
              */}
              <section className="grid gap-2 rounded-lg border border-line bg-surface-muted p-2.5">
                <h2 className="text-xs font-[560] text-muted">What this came from</h2>

                {material.capture_id && (
                  <div className="grid gap-1">
                    <span className="text-xs text-muted">The recording</span>
                    <Recording src={api.audioUrl(material.capture_id)} seconds={material.capture_seconds} />
                  </div>
                )}

                {(material.source?.url || material.context) && (
                  <div className="grid gap-1">
                    <span className="text-xs text-muted">
                      {material.kind === "page" ? "The page" : "The passage on the page"}
                    </span>
                    {material.context && material.context !== material.content && (
                      <p className="line-clamp-6 text-[13px] leading-normal whitespace-pre-wrap text-ink-soft">
                        {material.context}
                      </p>
                    )}
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
                  </div>
                )}

                <Lineage title="Made from" items={lineage.data?.parents ?? []} />

                {!material.capture_id && !material.source?.url && !material.context && (
                  <p className="text-xs text-muted">Typed here. There is nothing behind it but you.</p>
                )}
              </section>

              {/* Derived from the above: for a recording this is the
                  transcript, and it is the part a model may have got wrong. */}
              {material.superseded_by && (
                /*
                 * R13, the reading end. This Source was true when it was
                 * written and is not deleted, edited or unfiled — a record of
                 * what was believed then is worth keeping. What it must not do
                 * is go on looking current, because nobody remembers what a
                 * Source from three months ago said, and it stays quotable.
                 */
                <div className="grid gap-1 rounded-lg border border-line bg-surface-muted px-2.5 py-2">
                  <span className="text-xs text-muted">
                    Out of date{material.superseded_by.why ? ` — ${material.superseded_by.why}` : ""}
                  </span>
                  <button
                    type="button"
                    className="justify-self-start text-xs text-accent-ink underline-offset-2 hover:underline"
                    onClick={() => onOpenMaterial?.(material.superseded_by!.id)}
                  >
                    Open the one that replaced it
                  </button>
                </div>
              )}

              {/*
                The words themselves — the reason this page exists — set a
                step larger than everything around them. They used to render
                at the same 13px as the metadata labels, so the eye had no
                landing place: a page about one paragraph gave that paragraph
                no more weight than the word "Tags".
              */}
              <div className="grid gap-1.5">
                {material.capture_id ? (
                  <Transcript
                    material={material}
                    busy={action.busy}
                    onChanged={() => {
                      void lineage.refresh();
                      onChanged();
                    }}
                    run={action.run}
                  />
                ) : null}
                <p
                  className={cn(
                    "max-w-prose text-[15px] leading-relaxed whitespace-pre-wrap",
                    // Dimmed, not hidden: still readable, no longer current.
                    material.superseded_by ? "text-muted" : "text-ink",
                  )}
                >
                  {material.content}
                </p>
              </div>

              <HowItWasHeard applied={material.applied_context} />

              <UsedIn materialId={material.id} onOpenDocument={onOpenDocument} />

              {material.organization?.status === "needs_review" && (
                <div className="grid gap-1.5 rounded-lg border border-accent-line bg-accent-soft px-2.5 py-2">
                  <span className="text-xs text-accent-ink">Logue suggests</span>
                  <span className="flex flex-wrap items-center gap-1 text-xs">
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
                    <span className="text-xs leading-normal text-muted">
                      {material.organization.reason}
                    </span>
                  )}
                  {material.organization.supersedes && (
                    /*
                     * Its own question and its own button. Filing and "an
                     * older Source is now wrong" are different decisions, and
                     * someone may well want the tags without agreeing to the
                     * second — so they are never one click.
                     */
                    <span className="grid gap-1 rounded-md bg-panel px-2 py-1.5">
                      <span className="text-xs leading-normal text-ink-soft">
                        This looks like it replaces an earlier Source
                        {material.organization.supersedes.why
                          ? ` — ${material.organization.supersedes.why}`
                          : ""}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          disabled={action.busy}
                          onClick={() => onOpenMaterial?.(material.organization!.supersedes!.id)}
                        >
                          Read the older one
                        </Button>
                        <Button
                          variant="primary"
                          disabled={action.busy}
                          onClick={() =>
                            void action
                              .run(() => api.resolveOrganization(material.id, { accept: true, supersede: true }))
                              .then((ok) => ok && (lineage.refresh(), onChanged()))
                          }
                        >
                          Mark the older one out of date
                        </Button>
                      </span>
                    </span>
                  )}
                  <span className="flex justify-end gap-1">
                    <Button
                      variant="primary"
                      disabled={action.busy}
                      onClick={() =>
                        void action
                          .run(() =>
                            // Filing is not agreeing. The contradiction has
                            // its own button above; this one answers only the
                            // question it asks.
                            api.resolveOrganization(material.id, { accept: true, supersede: false }),
                          )
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
                      // Membership is a checkmark, not a colour. The member
                      // chip used to be a solid accent button — the exact
                      // dress of the page's one primary action, on a toggle,
                      // with the state carried by fill alone.
                      <Button
                        key={project.id}
                        aria-pressed={member}
                        className={member ? "border-ink/25 bg-surface-muted text-ink" : "text-muted"}
                        disabled={action.busy}
                        onClick={() =>
                          void action
                            .run(() => api.setMembership(material.id, project.name, !member))
                            .then((ok) => ok && (lineage.refresh(), onChanged()))
                        }
                      >
                        {member && <Check size={12} className="text-success" />}
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
    // The heading, before the words it names — it used to follow them, so
    // the text explained itself only after it had been read. The actions sit
    // on the heading, and each says what it does to the transcript rather
    // than what the person might be feeling: "Hear it again" read as
    // playback, while what it does is ask the model to listen once more.
    <div className="grid gap-1.5">
      <span className="flex items-center gap-2 text-xs font-[560] text-muted">
        Transcript
        {revisions.length > 0 && <span className="font-normal">{revisions.length} earlier</span>}
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" disabled={busy} onClick={() => setFixing(!fixing)}>
            Fix a word
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => again()} title="Ask the model to transcribe the recording again">
            {busy ? <Spinner size={12} /> : null} Transcribe again
          </Button>
        </span>
      </span>

      {fixing && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <Input
            autoFocus
            value={spoken}
            placeholder="It wrote…"
            aria-label="What it wrote"
            className="h-6 w-28 px-1.5 text-xs"
            onChange={(event) => setSpoken(event.target.value)}
          />
          <span className="text-muted">→</span>
          <Input
            value={preferred}
            placeholder="…should be"
            aria-label="What it should be"
            className="h-6 w-28 px-1.5 text-xs"
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
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none">What it said before</summary>
          <div className="mt-1 grid gap-1">
            {revisions
              .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
              .map((revision) => (
                <div
                  key={revision.id}
                  className="flex items-start gap-2 rounded-md bg-surface-muted px-2 py-1.5"
                >
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
      [
        "From the page",
        applied.page_context_characters ? `${applied.page_context_characters} characters` : "",
      ],
    ] as [string, string | undefined][]
  ).filter((line): line is [string, string] => Boolean(line[1]));
  if (lines.length === 0 && !applied.instructions) return null;
  return (
    <details className="border-t border-line pt-3 text-xs text-muted">
      <summary className="cursor-pointer select-none">How this was heard</summary>
      <dl className="mt-1.5 grid grid-cols-[84px_minmax(0,1fr)] gap-x-2 gap-y-1">
        {lines.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted">{label}</dt>
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
      <div className="flex flex-wrap items-center gap-1 text-xs">
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
          className="h-6 w-24 px-1.5 text-xs"
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
        Used in {total === 0 ? <span className="text-muted">nothing yet</span> : total}
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
          <span className="flex items-center gap-2 text-xs text-muted">
            <OriginMark origin={originOf(item.kind)} />
            <SourceLink url={item.source?.url} label={item.source?.domain || "This Mac"} />
          </span>
          <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-ink-soft">{item.content}</p>
        </div>
      ))}
    </div>
  );
}
