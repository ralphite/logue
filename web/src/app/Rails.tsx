import { Inbox, Layers, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton, Input, Menu, MenuItem, Tag, cn } from "@logue/ui";
import { api, type Document, type Material, type Project, type Skill, type Topic } from "../api";
import { ConfirmDelete } from "./ConfirmDelete";
import { PromptDialog } from "./PromptDialog";
import { usePins } from "./pins";
import { RailList, type RailAction, type RailEntry } from "./RailList";
import { useAction, useHost, timeAgo } from "./useHost";

function condense(text: string, limit = 60): string {
  const line = (text || "").trim().replace(/\s+/g, " ");
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

/** The controls a rail list needs above it, in the rail's own scale. */
function RailHeader({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-1 px-0.5 pt-1 pb-1.5">{children}</div>;
}

/** A line in a hover card: what it is, then what it says. */
function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-[11px] leading-[1.5]">
      <span className="shrink-0 text-faint">{name}</span>
      <span className="min-w-0 flex-1 text-ink-soft">{children}</span>
    </p>
  );
}

/** Pin or unpin, the first action on every row in every rail. */
function pinAction(pinned: boolean, onRun: () => void): RailAction {
  return { label: pinned ? "Unpin" : "Pin", onRun };
}

/** What the rail is about to delete, held while the dialog asks. */
interface Doomed {
  id: string;
  what: string;
  title: string;
  impact: () => Promise<string[]>;
  kept?: string;
  remove: () => Promise<unknown>;
}

/** What the rail is about to rename, held while the dialog asks. */
interface Renaming {
  id: string;
  title: string;
  name: string;
  save: (name: string) => Promise<unknown>;
}

/**
 * Everything captured, as a list you pick from rather than a page you read.
 *
 * The filters live here too: narrowing the list and choosing from it are the
 * same act, and putting them on opposite sides of the screen made you look in
 * two places to do one thing.
 */
export function StreamRail({
  selectedId,
  onSelect,
  onVisibleOrder,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibleOrder?: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
  const [group, setGroup] = useState<Topic>();
  const [doomed, setDoomed] = useState<Doomed>();
  const materials = useHost(() => api.materials(), []);
  const review = useHost(() => api.review(), []);
  const topics = useHost(() => api.topics(), []);
  const projects = useHost(() => api.projects(), []);
  const action = useAction();
  const pins = usePins("source");

  const waiting = review.data?.materials;
  const inGroup = group ? new Set(group.source_ids) : undefined;
  // Membership is stored as the Project's name, not its id — renaming a
  // Project rewrites it on every member. Kept as a set so a Source filed
  // under a Project that has since been deleted still groups under its name
  // rather than vanishing into the loose rows.
  const known = new Set((projects.data?.projects ?? []).map((one) => one.name));

  const visible = useMemo(() => {
    const list = (reviewing ? waiting : materials.data?.materials) ?? [];
    const needle = query.trim().toLowerCase();
    return list.filter((m: Material) => {
      if (inGroup && !inGroup.has(m.id)) return false;
      if (tag && !(m.tags ?? []).includes(tag)) return false;
      if (!needle) return true;
      return `${m.content} ${m.source?.title ?? ""} ${(m.tags ?? []).join(" ")}`.toLowerCase().includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials.data, waiting, reviewing, query, tag, group]);

  const entries: RailEntry[] = pins.pinnedFirst(visible).map((material) => ({
    id: material.id,
    title: condense(material.content) || "Empty",
    pinned: pins.isPinned(material.id),
    // Grouped by the Project it belongs to; the ones filed nowhere stay a flat
    // list under the groups rather than getting a folder of their own.
    group: material.projects[0],
    waiting: material.organization?.status === "needs_review" && !material.organization.decided,
    preview: () => (
      <>
        <p className="line-clamp-6 text-xs leading-[1.5] text-ink">{condense(material.content, 400) || "Empty"}</p>
        {material.source?.title && <Fact name="From">{material.source.title}</Fact>}
        {material.projects.length > 0 && (
          <Fact name="In">
            {material.projects.map((name) => (known.has(name) ? name : `${name} (gone)`)).join(", ")}
          </Fact>
        )}
        {(material.tags?.length ?? 0) > 0 && <Fact name="Tags">{material.tags?.join(", ")}</Fact>}
        <Fact name="Kept">{timeAgo(material.created_at)}</Fact>
      </>
    ),
    actions: [
      pinAction(pins.isPinned(material.id), () => pins.toggle(material.id)),
      ...(material.source?.url
        ? [{ label: "Open where it came from", onRun: () => window.open(material.source?.url, "_blank", "noopener") }]
        : []),
      { label: "Copy text", onRun: () => void navigator.clipboard.writeText(material.content) },
      {
        label: "Delete",
        tone: "danger" as const,
        onRun: () =>
          setDoomed({
            id: material.id,
            title: "Delete this Source",
            what: condense(material.content, 120) || "This Source",
            impact: async () => {
              const { runs, documents, derived } = await api.dependencies(material.id);
              return [
                runs.length > 0 && `${runs.length} answer${runs.length === 1 ? "" : "s"} that cited it`,
                documents.length > 0 && `${documents.length} document${documents.length === 1 ? "" : "s"} built on it`,
                derived.length > 0 && `${derived.length} thing${derived.length === 1 ? "" : "s"} derived from it`,
              ].filter((line): line is string => Boolean(line));
            },
            remove: async () => {
              await api.deleteMaterial(material.id);
              await materials.refresh();
            },
          }),
      },
    ],
  }));

  return (
    <>
      <RailHeader>
        <span className="relative">
          <Search size={12} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-faint" />
          <Input
            className="h-7 w-full pl-6 text-xs"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search everything you have captured"
          />
        </span>
        <div className="flex items-center gap-1">
          {(waiting?.length ?? 0) > 0 && (
            <button
              type="button"
              aria-pressed={reviewing}
              onClick={() => setReviewing(!reviewing)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]",
                reviewing ? "bg-active font-[560] text-ink" : "text-muted hover:bg-hover hover:text-ink",
              )}
            >
              <Inbox size={11} /> {waiting?.length} to file
            </button>
          )}
          <Menu
            label="Groups"
            trigger={(props) => (
              <IconButton label="Groups" className="ml-auto" {...props}>
                <Layers size={13} />
              </IconButton>
            )}
          >
            {(topics.data?.topics ?? [])
              .toSorted((a, b) => b.source_ids.length - a.source_ids.length)
              .map((topic) => (
                <MenuItem key={topic.id} onClick={() => setGroup(topic)}>
                  <span className="truncate">{topic.name}</span>
                  <span className="ml-auto pl-3 text-faint">{topic.source_ids.length}</span>
                </MenuItem>
              ))}
            <MenuItem onClick={() => void action.run(() => api.regroupTopics()).then(() => topics.refresh())}>
              Look for new groups
            </MenuItem>
          </Menu>
        </div>
        {(tag || group) && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
            {tag && <Tag name={tag} onRemove={() => setTag(undefined)} />}
            {group && (
              <button
                type="button"
                onClick={() => setGroup(undefined)}
                className="rounded-sm bg-surface-muted px-1 text-ink-soft hover:text-ink"
                title="Clear this group"
              >
                {group.name} ×
              </button>
            )}
          </div>
        )}
      </RailHeader>

      <RailList
        storageKey="stream"
        entries={entries}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={materials.loading}
        empty={query || tag || group ? "Nothing matches." : "Capture something to see it here."}
      />

      <DeleteFromRail doomed={doomed} onDone={() => setDoomed(undefined)} />
    </>
  );
}

export function ProjectsRail({
  selectedId,
  onSelect,
  onVisibleOrder,
  made = 0,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibleOrder?: (ids: string[]) => void;
  /** Bumped by the rail's `+`, which lives on the nav row above this list. */
  made?: number;
}) {
  const projects = useHost(() => api.projects(), [made]);
  const pins = usePins("project");
  const [doomed, setDoomed] = useState<Doomed>();
  const [renaming, setRenaming] = useState<Renaming>();

  const entries: RailEntry[] = pins.pinnedFirst(projects.data?.projects ?? []).map((project: Project) => ({
    id: project.id,
    title: project.name,
    pinned: pins.isPinned(project.id),
    mark: <span className="shrink-0 text-[11px] text-faint">{project.count}</span>,
    preview: () => (
      <>
        <p className="text-xs font-[560] text-ink">{project.name}</p>
        {project.overview && <p className="line-clamp-4 text-[11px] leading-[1.5] text-ink-soft">{project.overview}</p>}
        <Fact name="Holds">{project.count ?? 0} Sources</Fact>
        {project.updated_at && <Fact name="Touched">{timeAgo(project.updated_at)}</Fact>}
      </>
    ),
    actions: [
      pinAction(pins.isPinned(project.id), () => pins.toggle(project.id)),
      {
        label: "Rename…",
        onRun: () =>
          setRenaming({
            id: project.id,
            title: "Rename this Project",
            name: project.name,
            save: async (name) => {
              await api.updateProject(project.id, { name });
              await projects.refresh();
            },
          }),
      },
      {
        label: "Delete",
        tone: "danger" as const,
        onRun: () =>
          setDoomed({
            id: project.id,
            title: "Delete this Project",
            what: project.name,
            // Deleting a Project destroys nothing: it un-files its Sources.
            // The panel that lists losses has nothing to list, and the line
            // below says where the work went.
            impact: async () => [],
            kept: `Everything filed under it stays — all ${project.count ?? 0} of it. Only the Project goes.`,
            remove: async () => {
              await api.deleteProject(project.id);
              await projects.refresh();
            },
          }),
      },
    ],
  }));

  return (
    <>
      <RailList
        storageKey="projects"
        entries={entries}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={projects.loading}
        empty="No Projects yet."
      />
      <DeleteFromRail doomed={doomed} onDone={() => setDoomed(undefined)} />
      <RenameFromRail renaming={renaming} onDone={() => setRenaming(undefined)} />
    </>
  );
}

export function DocumentsRail({
  selectedId,
  onSelect,
  onVisibleOrder,
  made = 0,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibleOrder?: (ids: string[]) => void;
  /** Bumped by the rail's `+`, which lives on the nav row above this list. */
  made?: number;
}) {
  const documents = useHost(() => api.documents(), [made]);
  const pins = usePins("document");
  const [doomed, setDoomed] = useState<Doomed>();
  const [renaming, setRenaming] = useState<Renaming>();

  const entries: RailEntry[] = pins.pinnedFirst(documents.data?.documents ?? []).map((document: Document) => ({
    id: document.id,
    title: document.title || "Untitled",
    pinned: pins.isPinned(document.id),
    preview: () => (
      <>
        <p className="text-xs font-[560] text-ink">{document.title || "Untitled"}</p>
        <p className="line-clamp-5 text-[11px] leading-[1.5] text-ink-soft">
          {condense(document.content, 300) || "Nothing written yet."}
        </p>
        <Fact name="Built on">{document.source_ids.length} Sources</Fact>
        <Fact name="Edited">{timeAgo(document.updated_at)}</Fact>
      </>
    ),
    actions: [
      pinAction(pins.isPinned(document.id), () => pins.toggle(document.id)),
      {
        label: "Rename…",
        onRun: () =>
          setRenaming({
            id: document.id,
            title: "Rename this Document",
            name: document.title,
            save: async (title) => {
              await api.updateDocument(document.id, { title, expected_revision: document.revision });
              await documents.refresh();
            },
          }),
      },
      { label: "Export as Markdown", onRun: () => window.open(api.documentMarkdownUrl(document.id), "_blank") },
      {
        label: "Delete",
        tone: "danger" as const,
        onRun: () =>
          setDoomed({
            id: document.id,
            title: "Delete this Document",
            what: document.title || "Untitled",
            impact: async () => [],
            kept: "The Sources it was built on stay.",
            remove: async () => {
              await api.deleteDocument(document.id);
              await documents.refresh();
            },
          }),
      },
    ],
  }));

  return (
    <>
      <RailList
        storageKey="documents"
        entries={entries}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={documents.loading}
        empty="No Documents yet."
      />
      <DeleteFromRail doomed={doomed} onDone={() => setDoomed(undefined)} />
      <RenameFromRail renaming={renaming} onDone={() => setRenaming(undefined)} />
    </>
  );
}

export function SkillsRail({
  selectedId,
  onSelect,
  onVisibleOrder,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibleOrder?: (ids: string[]) => void;
}) {
  const skills = useHost(() => api.skills(), []);
  const pins = usePins("skill");
  const [doomed, setDoomed] = useState<Doomed>();
  const [renaming, setRenaming] = useState<Renaming>();

  const entries: RailEntry[] = pins.pinnedFirst(skills.data?.skills ?? []).map((skill: Skill) => ({
    id: skill.id,
    title: skill.name,
    pinned: pins.isPinned(skill.id),
    mark: skill.enabled ? undefined : <span className="shrink-0 text-[11px] text-faint">off</span>,
    preview: () => (
      <>
        <p className="text-xs font-[560] text-ink">{skill.name}</p>
        {skill.purpose && <p className="line-clamp-4 text-[11px] leading-[1.5] text-ink-soft">{skill.purpose}</p>}
        <Fact name="Appears in">{skill.surfaces.join(", ") || "nowhere yet"}</Fact>
        <Fact name="Version">{skill.revision}</Fact>
        {!skill.enabled && <Fact name="State">Turned off</Fact>}
      </>
    ),
    actions: [
      pinAction(pins.isPinned(skill.id), () => pins.toggle(skill.id)),
      {
        label: skill.enabled ? "Turn off" : "Turn on",
        onRun: () => void api.updateSkill(skill.id, { enabled: !skill.enabled }).then(() => skills.refresh()),
      },
      {
        label: "Rename…",
        onRun: () =>
          setRenaming({
            id: skill.id,
            title: "Rename this Skill",
            name: skill.name,
            save: async (name) => {
              await api.updateSkill(skill.id, { name });
              await skills.refresh();
            },
          }),
      },
      ...(skill.system
        ? []
        : [
            {
              label: "Delete",
              tone: "danger" as const,
              onRun: () =>
                setDoomed({
                  id: skill.id,
                  title: "Delete this Skill",
                  what: skill.name,
                  impact: async () => {
                    const { runs, projects } = await api.skillImpact(skill.id);
                    return [
                      runs > 0 && `${runs} answer${runs === 1 ? "" : "s"} it produced`,
                      projects.length > 0 && `${projects.length} Project${projects.length === 1 ? "" : "s"} using it`,
                    ].filter((line): line is string => Boolean(line));
                  },
                  remove: async () => {
                    await api.deleteSkill(skill.id);
                    await skills.refresh();
                  },
                }),
            },
          ]),
    ],
  }));

  return (
    <>
      <RailList
        storageKey="skills"
        entries={entries}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={skills.loading}
        empty="No Skills yet."
      />
      <DeleteFromRail doomed={doomed} onDone={() => setDoomed(undefined)} />
      <RenameFromRail renaming={renaming} onDone={() => setRenaming(undefined)} />
    </>
  );
}

/** One dialog per rail, reused by every row — the rail holds what it is about. */
function DeleteFromRail({ doomed, onDone }: { doomed?: Doomed; onDone: () => void }) {
  const action = useAction();
  return (
    <ConfirmDelete
      open={Boolean(doomed)}
      title={doomed?.title ?? ""}
      what={doomed?.what ?? ""}
      kept={doomed?.kept}
      impact={doomed?.impact ?? (async () => [])}
      busy={action.busy}
      error={action.error}
      onCancel={onDone}
      onConfirm={() =>
        void action.run(async () => {
          await doomed?.remove();
          onDone();
        })
      }
    />
  );
}

function RenameFromRail({ renaming, onDone }: { renaming?: Renaming; onDone: () => void }) {
  const action = useAction();
  return (
    <PromptDialog
      open={Boolean(renaming)}
      title={renaming?.title ?? ""}
      label="Name"
      initial={renaming?.name ?? ""}
      onCancel={onDone}
      onConfirm={(name) =>
        void action.run(async () => {
          await renaming?.save(name);
          onDone();
        })
      }
    />
  );
}
