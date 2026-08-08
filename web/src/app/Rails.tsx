import { Inbox, Layers, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton, Input, Menu, MenuItem, Tag, cn } from "@logue/ui";
import { api, type Material, type Topic } from "../api";
import { RailList } from "./RailList";
import { useAction, useHost } from "./useHost";

function condense(text: string, limit = 60): string {
  const line = (text || "").trim().replace(/\s+/g, " ");
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

/** The controls a rail list needs above it, in the rail's own scale. */
function RailHeader({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-1 px-0.5 pt-1 pb-1.5">{children}</div>;
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
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
  const [group, setGroup] = useState<Topic>();
  const materials = useHost(() => api.materials(), []);
  const review = useHost(() => api.review(), []);
  const topics = useHost(() => api.topics(), []);
  const action = useAction();

  const waiting = review.data?.materials;
  const inGroup = group ? new Set(group.source_ids) : undefined;

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
        entries={visible.map((material) => ({
          id: material.id,
          title: condense(material.content) || "Empty",
        }))}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={materials.loading}
        empty={query || tag || group ? "Nothing matches." : "Capture something to see it here."}
      />
    </>
  );
}

export function ProjectsRail({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const projects = useHost(() => api.projects(), []);
  const action = useAction();
  return (
    <>
      <RailHeader>
        <Button
          variant="ghost"
          className="justify-start"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const { project } = await api.createProject("New Project", "");
              await projects.refresh();
              onSelect(project.id);
            })
          }
        >
          <Plus size={13} /> New Project
        </Button>
      </RailHeader>
      <RailList
        entries={(projects.data?.projects ?? []).map((project) => ({
          id: project.id,
          title: project.name,
          mark: <span className="shrink-0 text-[11px] text-faint">{project.count}</span>,
        }))}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={projects.loading}
        empty="No Projects yet."
      />
    </>
  );
}

export function DocumentsRail({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const documents = useHost(() => api.documents(), []);
  const action = useAction();
  return (
    <>
      <RailHeader>
        <Button
          variant="ghost"
          className="justify-start"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const { document } = await api.createDocument({});
              await documents.refresh();
              onSelect(document.id);
            })
          }
        >
          <Plus size={13} /> New Document
        </Button>
      </RailHeader>
      <RailList
        entries={(documents.data?.documents ?? []).map((document) => ({
          id: document.id,
          title: document.title || "Untitled",
        }))}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={documents.loading}
        empty="No Documents yet."
      />
    </>
  );
}

export function SkillsRail({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const skills = useHost(() => api.skills(), []);
  return (
    <RailList
      entries={(skills.data?.skills ?? []).map((skill) => ({
        id: skill.id,
        title: skill.name,
        mark: skill.enabled ? undefined : <span className="shrink-0 text-[11px] text-faint">off</span>,
      }))}
      selectedId={selectedId}
      onSelect={onSelect}
      loading={skills.loading}
      empty="No Skills yet."
    />
  );
}
