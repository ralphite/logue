import { Fragment, useState } from "react";
import {
  ACTS,
  ActBadge,
  Button,
  ErrorNote,
  Glyph,
  Input,
  Menu,
  MenuItem,
  OriginMark,
  Recording,
  SourceLink,
  Spinner,
  Tooltip,
  cn,
  originOf,
} from "@logue/ui";
import { api, type Material, type Project } from "../api";
import { kindOf } from "./ActivitiesPage";
import { DetailBody, DetailHeader, DetailPane, Section } from "./panes";
import { useAction, useHost } from "./useHost";

/**
 * One capture, in full: the words at reading size, and everything that
 * proves or uses them down a quiet right-hand column.
 *
 * This is the detail pane of the three-pane screen — never a page of its
 * own, never an overlay. The receipt for automatic filing sits directly
 * under the audio, because "where did this go" is the first question after
 * "what did I say".
 */
export function MaterialPanel({
  materialId,
  onChanged,
  projects,
  onOpenDocument,
  onOpenMaterial,
}: {
  materialId: string;
  onChanged: () => void;
  projects: Project[];
  onOpenDocument?: (id: string) => void;
  /** Follow a replacement, in either direction. */
  onOpenMaterial?: (id: string) => void;
}) {
  const lineage = useHost(() => api.lineage(materialId), [materialId]);
  const action = useAction();
  const material = lineage.data?.material;
  const kind = material ? kindOf(material) : undefined;

  const refreshed = () => {
    void lineage.refresh();
    onChanged();
  };

  return (
    <DetailPane>
      {material && kind ? (
        <DetailHeader
          badge={<ActBadge kind={kind} />}
          name={ACTS[kind].label}
          sub={[
            whenOf(material.created_at),
            material.capture_seconds ? duration(material.capture_seconds) : "",
            material.source?.domain ?? "",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : (
        <DetailHeader name={<span className="font-[500] text-muted">Source</span>} />
      )}

      <DetailBody>
          {lineage.error && <ErrorNote>{lineage.error}</ErrorNote>}
          {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}
          {!material || !kind ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Loading
            </div>
          ) : (
            <>
              {material.superseded_by && (
                /*
                 * R13, the reading end. This Source was true when it was
                 * written and is not deleted, edited or unfiled — a record of
                 * what was believed then is worth keeping. What it must not do
                 * is go on looking current.
                 */
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2">
                  <span className="text-xs text-muted">
                    Out of date{material.superseded_by.why ? ` — ${material.superseded_by.why}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-accent-ink underline-offset-2 hover:underline"
                    onClick={() => onOpenMaterial?.(material.superseded_by!.id)}
                  >
                    Open the one that replaced it
                  </button>
                </div>
              )}

              {material.capture_id && (
                /* His N4 ruling, kept: one widget, one time — small. */
                <div className="flex h-8 max-w-[440px] items-center gap-2 rounded-lg border border-line bg-panel px-2">
                  <Recording
                    src={api.audioUrl(material.capture_id)}
                    seconds={material.capture_seconds}
                    shape={material.capture_id}
                    className="min-w-0 flex-1"
                  />
                </div>
              )}

              {/*
                Filing already happened, quietly, the moment this arrived.
                This line is the receipt, not a question: where it went, why,
                and the one control that takes exactly that back.
              */}
              {material.organization?.decided === "auto" &&
                ((material.organization.accepted_projects?.length ?? 0) > 0 ||
                  (material.organization.accepted_tags?.length ?? 0) > 0) && (
                  <div className="mt-5 flex min-h-[38px] min-w-0 items-start gap-2 border-y border-line py-[7px] text-[11.5px] text-ink-soft">
                    {/* line-clamp: reasons written before the length rule
                        existed run to 280 characters, and they are data now. */}
                    <span className="line-clamp-2 min-w-0 flex-1 leading-[1.5]" title={material.organization.reason}>
                      Filed to{" "}
                      <strong className="font-[650] text-ink-soft">
                        {(material.organization.accepted_projects ?? []).join(", ") || "its tags"}
                      </strong>
                      {material.organization.reason
                        ? ` — ${lowerFirst(material.organization.reason)}`
                        : ""}
                    </span>
                    <span className="inline-flex h-[22px] flex-none items-center gap-1 rounded-full bg-accent-soft/70 px-[7px] text-[9.8px] font-[650] text-ink-soft">
                      <Glyph name="auto" className="h-[10px] w-[10px]" />
                      Automatic
                    </span>
                    <button
                      type="button"
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(() => api.undoOrganization(material.id)).then((ok) => ok && refreshed())
                      }
                      className="inline-flex h-[26px] flex-none items-center gap-1 rounded-md px-1.5 text-[10.8px] font-[650] text-accent-ink hover:bg-accent-hover-soft disabled:opacity-50"
                    >
                      <Glyph name="undo" className="h-[12px] w-[12px]" />
                      Undo
                    </button>
                  </div>
                )}

              {/*
                The one thing filing never decides. "An older Source is now
                wrong" changes how other material reads, so it stays a
                question until a person answers it.
              */}
              {material.organization?.supersedes && !material.organization.accepted_supersedes && (
                <div className="mt-5 grid gap-1.5 rounded-lg border border-line bg-panel px-3 py-2.5">
                  <span className="text-xs leading-normal text-ink-soft">
                    This looks like it replaces an earlier Source
                    {material.organization.supersedes.why ? ` — ${material.organization.supersedes.why}` : ""}
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
                          .then((ok) => ok && refreshed())
                      }
                    >
                      Mark the older one out of date
                    </Button>
                  </span>
                </div>
              )}

              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_216px] items-start gap-5">
                {/* The words themselves — the reason this pane exists — at the
                    one reading size in the product. */}
                <div className="min-w-0">
                  {material.capture_id ? (
                    <Transcript material={material} busy={action.busy} onChanged={refreshed} run={action.run} />
                  ) : (
                    <h2 className="border-b border-line pb-3 text-[12px] font-[700] tracking-[-0.01em] text-ink">
                      {material.kind === "selection" ? "Passage" : material.kind === "page" ? "Page" : "Text"}
                    </h2>
                  )}
                  <p
                    className={cn(
                      "mt-4 max-w-[44rem] text-[16px] font-[430] leading-[1.6] tracking-[-0.011em] whitespace-pre-wrap",
                      material.superseded_by ? "text-muted" : "text-ink",
                    )}
                  >
                    {material.content}
                  </p>
                </div>

                {/* The evidence column: origin, destination, membership. */}
                <aside className="grid min-w-0 content-start">
                  <Section cap="Where it came from" first>
                    <div className="mt-3 grid gap-[7px]">
                      {material.capture_id && (
                        <SourceCard
                          icon={<Glyph name="mic" className="h-[12px] w-[12px]" />}
                          tinted
                          name="Microphone recording"
                          detail={`${material.source?.kind === "panel" ? "Chrome side panel" : "This Mac"}${material.capture_seconds ? ` · ${duration(material.capture_seconds)}` : ""}`}
                        />
                      )}
                      {material.source?.url ? (
                        <a
                          href={material.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group block min-w-0"
                        >
                          <SourceCard
                            icon={<Glyph name="globe" className="h-[12px] w-[12px]" />}
                            name={material.source.title || "Untitled webpage"}
                            detail={material.source.domain || material.source.url}
                            external
                          />
                        </a>
                      ) : null}
                      {!material.capture_id && !material.source?.url && !material.context && (
                        <p className="text-xs leading-normal text-muted">
                          Typed here. There is nothing behind it but you.
                        </p>
                      )}
                      {material.context && material.context !== material.content && (
                        <p className="line-clamp-5 rounded-lg border border-line bg-surface p-2.5 text-xs leading-normal whitespace-pre-wrap text-ink-soft">
                          {material.context}
                        </p>
                      )}
                    </div>
                    <Lineage title="Made from" items={lineage.data?.parents ?? []} />
                  </Section>

                  <Section cap="Where it went">
                    <div className="mt-3">
                      <UsedIn materialId={material.id} onOpenDocument={onOpenDocument} />
                    </div>
                  </Section>

                  <Section cap="Projects">
                    <Membership
                      material={material}
                      projects={projects}
                      busy={action.busy}
                      onToggle={(name, member) =>
                        void action
                          .run(() => api.setMembership(material.id, name, member))
                          .then((ok) => ok && refreshed())
                      }
                    />
                  </Section>

                  <Section cap="Tags">
                    <Tags
                      material={material}
                      busy={action.busy}
                      onSave={(tags) =>
                        void action
                          .run(() => api.updateMaterial(material.id, { tags }))
                          .then((ok) => ok && refreshed())
                      }
                    />
                  </Section>

                  <HowItWasHeard applied={material.applied_context} />
                </aside>
              </div>
            </>
          )}
      </DetailBody>
    </DetailPane>
  );
}

/** One origin, as a small card: an icon square, a name, a quiet detail line. */
function SourceCard({
  icon,
  name,
  detail,
  tinted = false,
  external = false,
}: {
  icon: React.ReactNode;
  name: string;
  detail?: string;
  /** Accent-tinted icon square — the microphone, never the webpage. */
  tinted?: boolean;
  external?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 py-1">
      <span
        className={cn(
          "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px]",
          tinted ? "bg-accent-soft text-accent" : "bg-surface-muted text-ink-soft",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] font-[620] leading-[1.25] text-ink group-hover:text-accent-ink">
          {name}
        </span>
        {detail && (
          <span className="mt-[3px] flex min-w-0 items-center gap-1 text-[10.5px] leading-[1.2] text-muted">
            <span className="truncate">{detail}</span>
            {external && <Glyph name="external" className="h-[10px] w-[10px] flex-none" />}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Which Projects hold this — membership as chips, addition as a quiet
 * control. The wall of every-project-as-a-button is gone: what it belongs
 * to is worn, what it could join waits behind "Add project".
 */
function Membership({
  material,
  projects,
  busy,
  onToggle,
}: {
  material: Material;
  projects: Project[];
  busy: boolean;
  onToggle: (name: string, member: boolean) => void;
}) {
  const members = material.projects;
  const others = projects.filter((one) => !members.includes(one.name));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {members.map((name) => (
        <span
          key={name}
          className="inline-flex h-7 items-center gap-[5px] rounded-full border border-accent-line bg-accent-soft pr-[7px] pl-[9px] text-[11px] font-[650] text-accent-ink"
        >
          <span className="max-w-[150px] truncate">{name}</span>
          <button
            type="button"
            aria-label={`Remove from ${name}`}
            disabled={busy}
            onClick={() => onToggle(name, false)}
            className="flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:bg-ink/5 hover:opacity-100"
          >
            <Glyph name="x" className="h-[10px] w-[10px]" />
          </button>
        </span>
      ))}
      {members.length === 0 && <span className="text-xs text-muted">Not in any project.</span>}
      {others.length > 0 && (
        <Menu
          label="Add to a project"
          align="start"
          trigger={(props) => (
            <button
              type="button"
              disabled={busy}
              {...props}
              className="inline-flex h-7 items-center gap-[5px] rounded-md border border-dashed border-control-line bg-surface px-[9px] text-[10.8px] font-[550] text-ink-soft hover:border-muted hover:bg-panel hover:text-ink-soft"
            >
              <Glyph name="plus" className="h-[12px] w-[12px]" />
              Add project
            </button>
          )}
        >
          {others.map((one) => (
            <MenuItem key={one.id} onClick={() => onToggle(one.name, true)}>
              {one.name}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
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
    <div>
      <div className="flex min-w-0 items-center border-b border-line pb-3">
        <h2 className="text-[12px] font-[700] tracking-[-0.01em] text-ink">Transcript</h2>
        {revisions.length > 0 && (
          <span className="ml-2 text-[10.5px] text-muted">{revisions.length} earlier</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <TextAction disabled={busy} onClick={() => setFixing(!fixing)} glyph="edit">
            Fix a word
          </TextAction>
          <Tooltip label="Hear the recording again, with today's corrections">
            <TextAction disabled={busy} onClick={() => again()} glyph="retry">
              {busy ? <Spinner size={12} /> : null} Transcribe again
            </TextAction>
          </Tooltip>
        </span>
      </div>

      {fixing && (
        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
          <Input
            autoFocus
            value={spoken}
            placeholder="It wrote…"
            aria-label="What it wrote"
            className="h-7 w-32 px-1.5 text-xs"
            onChange={(event) => setSpoken(event.target.value)}
          />
          <span className="text-muted">→</span>
          <Input
            value={preferred}
            placeholder="…should be"
            aria-label="What it should be"
            className="h-7 w-32 px-1.5 text-xs"
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
        <details className="mt-3 text-xs text-muted">
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

/** A quiet heading-row action: a small glyph, a few words, no border. */
function TextAction({
  onClick,
  disabled,
  glyph,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  glyph: "edit" | "retry";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-[5px] rounded-md px-1.5 py-1 text-[11.5px] font-[550] text-ink-soft hover:bg-hover hover:text-ink disabled:opacity-50"
    >
      <Glyph name={glyph} className="h-[13px] w-[13px]" />
      {children}
    </button>
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
    <details className="mt-5 border-t border-line pt-4 text-xs text-muted">
      <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-[550] text-muted select-none [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        How it was heard
        <Glyph name="chevron" className="h-[10px] w-[10px] text-faint" />
      </summary>
      <dl className="mt-3 grid grid-cols-[84px_minmax(0,1fr)] gap-x-2 gap-y-1">
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
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {tags.map((name) => (
        <span
          key={name}
          className="inline-flex h-[27px] items-center gap-1 rounded-full border border-line bg-surface-muted pr-[7px] pl-[9px] text-[10.8px] font-[550] text-ink-soft"
        >
          <span className="max-w-[150px] truncate">{name}</span>
          <button
            type="button"
            aria-label={`Remove tag ${name}`}
            disabled={busy}
            onClick={() => onSave(tags.filter((t) => t !== name))}
            className="flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:bg-ink/5 hover:opacity-100"
          >
            <Glyph name="x" className="h-[10px] w-[10px]" />
          </button>
        </span>
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
        className="h-[27px] w-24 rounded-md border-dashed px-2 text-[10.8px]"
      />
    </div>
  );
}

/**
 * What has been built on this Source.
 *
 * The question worth asking of a Source is which answers cited it and which
 * documents are standing on it — that is what makes deleting it
 * consequential, and what makes keeping it worthwhile.
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
    <div className="grid gap-1">
      {total === 0 && <span className="text-xs text-muted">Nothing yet.</span>}

      {documents.map((document) => (
        <button
          key={document.id}
          type="button"
          disabled={!onOpenDocument}
          onClick={() => onOpenDocument?.(document.id)}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-ink-soft enabled:hover:bg-hover enabled:hover:text-ink"
        >
          <Glyph name="document" className="h-[12px] w-[12px] shrink-0 text-muted" />
          <span className="truncate">{document.title || "Untitled"}</span>
        </button>
      ))}

      {runs.map((run) => (
        <span key={run.id} className="flex items-center gap-1.5 px-1.5 py-1 text-xs text-ink-soft">
          <Glyph name="auto" className="h-[12px] w-[12px] shrink-0 text-muted" />
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
    <div className="mt-3 grid gap-1">
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

/** Midnight of the date, for whole-day arithmetic. */
function floorDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today · 10:18" — the day in words, the list's own 24-hour clock. */
function whenOf(iso: string): string {
  const then = new Date(iso);
  const days = Math.round((floorDay(new Date()) - floorDay(then)) / 86_400_000);
  const day =
    days <= 0
      ? "Today"
      : days === 1
        ? "Yesterday"
        : days < 7
          ? then.toLocaleDateString("en-US", { weekday: "long" })
          : then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} · ${then.getHours()}:${String(then.getMinutes()).padStart(2, "0")}`;
}

function duration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function lowerFirst(text: string): string {
  return text.length > 0 ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}
