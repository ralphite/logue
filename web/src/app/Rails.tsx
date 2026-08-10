import { FileText, FolderOpen, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Menu, MenuItem, OriginMark, Tag, cn, originOf } from "@logue/ui";
import { api, type Document, type Material, type Project, type Skill, type Topic } from "../api";
import { ConfirmDelete } from "./ConfirmDelete";
import { PromptDialog } from "./PromptDialog";
import { usePins } from "./pins";
import { DRAFT } from "./AppShell";
import { MakeFirst, RailList, type RailAction, type RailEntry } from "./RailList";
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
    <p className="flex gap-2 text-xs leading-[1.5]">
      <span className="shrink-0 text-muted">{name}</span>
      <span className="min-w-0 flex-1 text-ink-soft">{children}</span>
    </p>
  );
}

/** Pin or unpin, the first action on every row in every rail. */
function pinAction(pinned: boolean, onRun: () => void): RailAction {
  return { label: pinned ? "Unpin" : "Pin", onRun, accelerator: "p" };
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
    return list.filter((m: Material) => {
      if (inGroup && !inGroup.has(m.id)) return false;
      if (tag && !(m.tags ?? []).includes(tag)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials.data, waiting, reviewing, tag, group]);

  const entries: RailEntry[] = pins.pinnedFirst(visible).map((material) => ({
    id: material.id,
    title: condense(material.content) || "Empty",
    pinned: pins.isPinned(material.id),
    // A flat list. Grouping by Project was wrong twice over: a Source belongs
    // to several Projects, and taking the first one silently hid it from the
    // rest. What kind of thing it is goes on the left instead — which is also
    // the one fact every row has exactly one of.
    icon: <OriginMark origin={originOf(material.kind)} />,
    preview: () => (
      <>
        <p className="line-clamp-6 text-xs leading-[1.5] text-ink">
          {condense(material.content, 400) || "Empty"}
        </p>
        {material.source?.title && <Fact name="From">{material.source.title}</Fact>}
        {(material.projects?.length ?? 0) > 0 && (
          <Fact name="In">
            {(material.projects ?? []).map((name) => (known.has(name) ? name : `${name} (gone)`)).join(", ")}
          </Fact>
        )}
        {(material.tags?.length ?? 0) > 0 && <Fact name="Tags">{material.tags?.join(", ")}</Fact>}
        <Fact name="Kept">{timeAgo(material.created_at)}</Fact>
      </>
    ),
    actions: [
      pinAction(pins.isPinned(material.id), () => pins.toggle(material.id)),
      ...(material.source?.url
        ? [
            {
              label: "Open where it came from",
              accelerator: "o",
              onRun: () => window.open(material.source?.url, "_blank", "noopener"),
            },
          ]
        : []),
      { label: "Copy text", accelerator: "c", onRun: () => void navigator.clipboard.writeText(material.content) },
      {
        label: "Delete",
        accelerator: "d",
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
                documents.length > 0 &&
                  `${documents.length} document${documents.length === 1 ? "" : "s"} built on it`,
                derived.length > 0 &&
                  `${derived.length} thing${derived.length === 1 ? "" : "s"} derived from it`,
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
      {/* No search box here. Find (⌘K) sits at the top of the rail and covers
          every section; a second box that only filters whichever list happens
          to be open is two controls doing one job, and the narrower of the two
          is the one that looks like the answer. */}
      <RailHeader>
        <div className="flex items-center gap-1">
          {(waiting?.length ?? 0) > 0 && (
            <button
              type="button"
              aria-pressed={reviewing}
              title="Logue has worked out where these probably belong. Nobody has looked yet."
              onClick={() => setReviewing(!reviewing)}
              className={cn(
                "rounded-md px-1.5 py-1 text-xs",
                reviewing ? "bg-active font-[560] text-ink" : "text-muted hover:bg-hover hover:text-ink",
              )}
            >
              {waiting?.length} to look at
            </button>
          )}
          <Menu
            label="Groups"
            align="start"
            trigger={(props) => (
              // A word, not an icon. No icon says "groupings Logue noticed",
              // and one that has to be discovered by hovering is not a control.
              <button
                type="button"
                {...props}
                className="ml-auto rounded-md px-1.5 py-1 text-xs text-muted hover:bg-hover hover:text-ink"
              >
                Groups
              </button>
            )}
          >
            {(topics.data?.topics ?? [])
              .toSorted((a, b) => b.source_ids.length - a.source_ids.length)
              .map((topic) => (
                <MenuItem key={topic.id} onClick={() => setGroup(topic)}>
                  <span className="truncate">{topic.name}</span>
                  <span className="ml-auto pl-3 text-muted">{topic.source_ids.length}</span>
                </MenuItem>
              ))}
            <MenuItem onClick={() => void action.run(() => api.regroupTopics()).then(() => topics.refresh())}>
              Look for new groups
            </MenuItem>
          </Menu>
        </div>
        {(tag || group) && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
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
        entries={entries}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={materials.loading}
        empty={tag || group ? "Nothing matches." : "Capture something to see it here."}
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
  onNew,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibleOrder?: (ids: string[]) => void;
  /** Bumped by the rail's `+`, which lives on the nav row above this list. */
  made?: number;
  onNew?: () => void;
}) {
  const projects = useHost(() => api.projects(), [made]);
  const pins = usePins("project");
  const [doomed, setDoomed] = useState<Doomed>();
  const [renaming, setRenaming] = useState<Renaming>();

  const entries: RailEntry[] = pins.pinnedFirst(projects.data?.projects ?? []).map((project: Project) => ({
    id: project.id,
    title: project.name,
    icon: <FolderOpen size={12} className="text-muted" />,
    pinned: pins.isPinned(project.id),
    mark: <span className="shrink-0 text-xs text-muted">{project.count}</span>,
    preview: () => (
      <>
        <p className="text-xs font-[560] text-ink">{project.name}</p>
        {project.overview && (
          <p className="line-clamp-4 text-xs leading-[1.5] text-ink-soft">{project.overview}</p>
        )}
        <Fact name="Holds">{project.count ?? 0} Sources</Fact>
        {project.updated_at && <Fact name="Touched">{timeAgo(project.updated_at)}</Fact>}
      </>
    ),
    actions: [
      pinAction(pins.isPinned(project.id), () => pins.toggle(project.id)),
      {
        label: "Rename…",
        accelerator: "r",
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
        accelerator: "d",
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

  // The draft belongs in the list too: pressing `+` should put something
  // there, even though nothing has been written yet.
  const shown: RailEntry[] =
    selectedId === DRAFT ? [{ id: DRAFT, title: "New Project", draft: true }, ...entries] : entries;

  return (
    <>
      <RailList
        entries={shown}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={projects.loading}
        empty={
          <>
            No Projects yet.
            {onNew && <MakeFirst label="Start one" onRun={onNew} />}
          </>
        }
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
  onNew,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibleOrder?: (ids: string[]) => void;
  /** Bumped by the rail's `+`, which lives on the nav row above this list. */
  made?: number;
  onNew?: () => void;
}) {
  const documents = useHost(() => api.documents(), [made]);
  const pins = usePins("document");
  const [doomed, setDoomed] = useState<Doomed>();
  const [renaming, setRenaming] = useState<Renaming>();

  const entries: RailEntry[] = pins
    .pinnedFirst(documents.data?.documents ?? [])
    .map((document: Document) => ({
      id: document.id,
      title: document.title || "Untitled",
      icon: <FileText size={12} className="text-muted" />,
      pinned: pins.isPinned(document.id),
      preview: () => (
        <>
          <p className="text-xs font-[560] text-ink">{document.title || "Untitled"}</p>
          <p className="line-clamp-5 text-xs leading-[1.5] text-ink-soft">
            {condense(document.content, 300) || "Nothing written yet."}
          </p>
          <Fact name="Built on">{document.source_ids?.length ?? 0} Sources</Fact>
          <Fact name="Edited">{timeAgo(document.updated_at)}</Fact>
        </>
      ),
      actions: [
        pinAction(pins.isPinned(document.id), () => pins.toggle(document.id)),
        {
          label: "Rename…",
        accelerator: "r",
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
        {
          label: "Export as Markdown",
          onRun: () => window.open(api.documentMarkdownUrl(document.id), "_blank"),
        },
        {
          label: "Delete",
        accelerator: "d",
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

  // The draft belongs in the list too: pressing `+` should put something
  // there, even though nothing has been written yet.
  const shown: RailEntry[] =
    selectedId === DRAFT ? [{ id: DRAFT, title: "New Document", draft: true }, ...entries] : entries;

  return (
    <>
      <RailList
        entries={shown}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={documents.loading}
        empty={
          <>
            No Documents yet.
            {onNew && <MakeFirst label="Start one" onRun={onNew} />}
          </>
        }
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
  made = 0,
  onNew,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibleOrder?: (ids: string[]) => void;
  /** Bumped by the rail's `+`, which lives on the nav row above this list. */
  made?: number;
  onNew?: () => void;
}) {
  const skills = useHost(() => api.skills(), [made]);
  const pins = usePins("skill");
  const [doomed, setDoomed] = useState<Doomed>();
  const [renaming, setRenaming] = useState<Renaming>();

  const entries: RailEntry[] = pins.pinnedFirst(skills.data?.skills ?? []).map((skill: Skill) => ({
    id: skill.id,
    title: skill.name,
    icon: <Sparkles size={12} className="text-muted" />,
    pinned: pins.isPinned(skill.id),
    mark: skill.enabled ? undefined : <span className="shrink-0 text-xs text-muted">off</span>,
    preview: () => (
      <>
        <p className="text-xs font-[560] text-ink">{skill.name}</p>
        {skill.purpose && (
          <p className="line-clamp-4 text-xs leading-[1.5] text-ink-soft">{skill.purpose}</p>
        )}
        <Fact name="Appears in">{skill.surfaces?.join(", ") || "nowhere yet"}</Fact>
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
        accelerator: "r",
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
        accelerator: "d",
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
                      projects.length > 0 &&
                        `${projects.length} Project${projects.length === 1 ? "" : "s"} using it`,
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

  // The draft belongs in the list too: pressing `+` should put something
  // there, even though nothing has been written yet.
  const shown: RailEntry[] =
    selectedId === DRAFT ? [{ id: DRAFT, title: "New Skill", draft: true }, ...entries] : entries;

  return (
    <>
      <RailList
        entries={shown}
        selectedId={selectedId}
        onSelect={onSelect}
        onVisibleOrder={onVisibleOrder}
        loading={skills.loading}
        empty={
          <>
            No Skills yet.
            {onNew && <MakeFirst label="Write one" onRun={onNew} />}
          </>
        }
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
