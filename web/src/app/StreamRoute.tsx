import { EyeOff, Inbox, Layers, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  Empty,
  ErrorNote,
  IconButton,
  Input,
  Menu,
  MenuItem,
  OriginMark,
  Spinner,
  Tag,
  cn,
  originOf,
} from "@logue/ui";
import { api, type Material, type Project, type Topic } from "../api";
import { Page, Row, RowActions, Rows } from "./AppShell";
import { timeAgo, useAction, useHost } from "./useHost";
import { MaterialPanel } from "./MaterialPanel";

/** Past this the row's own text stops being what you read first. */
const TAGS_ON_A_ROW = 3;

/**
 * What Logue thinks this Source is, and the two ways to answer.
 *
 * The reason is shown, not hidden behind a hover: a suggestion you cannot
 * question is one you either rubber-stamp or ignore, and both of those make
 * the queue worthless.
 */
function Suggestion({
  material,
  onDecide,
  busy,
}: {
  material: Material;
  onDecide: (material: Material, accept: boolean) => void;
  busy: boolean;
}) {
  const found = material.organization;
  if (!found) return null;
  const projects = found.suggested_projects ?? [];
  const tags = found.suggested_tags ?? [];
  const nothing = projects.length === 0 && tags.length === 0 && !found.duplicate_of;

  return (
    // The two answers keep a column of their own, so a long reason never
    // pushes them onto a line of their own and the queue stays one rhythm.
    <span className="mt-1.5 flex items-start gap-3 text-[11px]">
      {found.status === "pending" ? (
        <span className="flex items-center gap-1.5 text-muted">
          <Spinner size={11} /> Looking at this…
        </span>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {projects.map((name) => (
              <span key={name} className="rounded-sm bg-accent-soft px-1 text-accent-ink">
                {name}
              </span>
            ))}
            {tags.map((name) => (
              <Tag key={name} name={name} />
            ))}
            {found.duplicate_of && <span className="text-warning">Looks like one you already kept</span>}
            {found.reason && <span className="min-w-0 text-muted">{found.reason}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              variant="primary"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onDecide(material, true);
              }}
            >
              {nothing ? "Nothing to file" : "File it"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onDecide(material, false);
              }}
            >
              Skip
            </Button>
          </span>
        </>
      )}
    </span>
  );
}

function title(material: Material): string {
  const text = (material.content || "").trim().replace(/\s+/g, " ");
  return text.length > 120 ? `${text.slice(0, 120)}…` : text || "Empty";
}

function where(material: Material): string {
  return material.source?.domain || material.source?.title || "This Mac";
}

/** Everything captured, newest first. The one page you can start from. */
export function StreamRoute() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
  const [group, setGroup] = useState<Topic>();
  const [renaming, setRenaming] = useState("");
  const [openId, setOpenId] = useState<string>();
  const materials = useHost(() => api.materials(), []);
  const review = useHost(() => api.review(), []);
  const topics = useHost(() => api.topics(), []);
  const projects = useHost(() => api.projects(), []);
  const action = useAction();

  const waiting = review.data?.materials;
  const inGroup = group ? new Set(group.source_ids) : undefined;

  const visible = useMemo(() => {
    const list = (reviewing ? waiting : materials.data?.materials) ?? [];
    const needle = query.trim().toLowerCase();
    return list.filter((m) => {
      if (inGroup && !inGroup.has(m.id)) return false;
      if (tag && !(m.tags ?? []).includes(tag)) return false;
      if (!needle) return true;
      return `${m.content} ${m.transcript ?? ""} ${m.source?.title ?? ""} ${m.source?.url ?? ""} ${(m.tags ?? []).join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials.data, waiting, reviewing, query, tag, group]);

  const refresh = () => {
    void materials.refresh();
    void review.refresh();
  };

  const decide = (material: Material, accept: boolean) =>
    void action.run(() => api.resolveOrganization(material.id, { accept })).then(refresh);

  return (
    <Page
      title="Stream"
      actions={
        <>
          <Menu
            label="Groups"
            trigger={(props) => (
              <Button variant="ghost" {...props}>
                <Layers size={13} /> Groups
              </Button>
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
            <MenuItem
              onClick={() => void action.run(() => api.regroupTopics()).then(() => topics.refresh())}
            >
              Look for new groups
            </MenuItem>
          </Menu>
          <span className="relative">
            <Search size={13} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-faint" />
            <Input
              className="w-56 pl-6.5"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search everything you have captured"
            />
          </span>
        </>
      }
    >
      {materials.error && <ErrorNote className="mb-2">{materials.error}</ErrorNote>}
      {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}

      {tag && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
          Only <Tag name={tag} onRemove={() => setTag(undefined)} />
        </p>
      )}

      {group && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
          <span>Group</span>
          {renaming ? (
            <Input
              autoFocus
              value={renaming}
              className="h-6 w-40 px-1.5 text-[11px]"
              aria-label="Rename this group"
              onChange={(event) => setRenaming(event.target.value)}
              onBlur={() => setRenaming("")}
              onKeyDown={(event) => {
                if (event.key === "Escape") setRenaming("");
                if (event.key !== "Enter") return;
                const name = renaming.trim();
                setRenaming("");
                if (!name) return;
                void action.run(() => api.renameTopic(group.id, name)).then(() => {
                  setGroup({ ...group, name });
                  void topics.refresh();
                });
              }}
            />
          ) : (
            <button
              type="button"
              title="Rename"
              onClick={() => setRenaming(group.name)}
              className="rounded-sm bg-surface-muted px-1 text-ink-soft hover:text-ink"
            >
              {group.name}
            </button>
          )}
          <Button variant="ghost" onClick={() => setGroup(undefined)}>
            Clear
          </Button>
          <Button
            variant="ghost"
            title="Stop suggesting this grouping"
            onClick={() =>
              void action.run(() => api.hideTopic(group.id)).then(() => {
                setGroup(undefined);
                void topics.refresh();
              })
            }
          >
            Hide
          </Button>
        </div>
      )}

      {((waiting?.length ?? 0) > 0 || reviewing) && (
        <div className="mb-2 flex items-center gap-2 text-[11px]">
          <button
            type="button"
            aria-pressed={reviewing}
            onClick={() => setReviewing(!reviewing)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1",
              reviewing ? "bg-active font-[560] text-ink" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Inbox size={12} />
            {waiting?.length ? `${waiting.length} to file` : "Nothing left to file"}
          </button>
          {reviewing && <span className="text-faint">Logue suggested these. Nothing is filed until you say so.</span>}
        </div>
      )}

      {materials.loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-muted">
          <Spinner /> Loading
        </div>
      ) : visible.length === 0 ? (
        <Empty>{query ? "Nothing matches that." : "Capture something from a page to see it here."}</Empty>
      ) : (
        <Rows>
          {visible.map((material) => (
            <Row key={material.id} onClick={() => setOpenId(material.id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{title(material)}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <OriginMark origin={originOf(material.kind)} />
                  <span className="truncate">{where(material)}</span>
                  <span>{timeAgo(material.created_at)}</span>
                  {material.projects.map((name) => (
                    <span key={name} className="rounded-sm bg-surface-muted px-1 text-ink-soft">
                      {name}
                    </span>
                  ))}
                  {(material.tags ?? []).slice(0, TAGS_ON_A_ROW).map((name) => (
                    <Tag
                      key={name}
                      name={name}
                      onClick={(event) => {
                        event.stopPropagation();
                        setTag(name);
                        setOpenId(undefined);
                      }}
                    />
                  ))}
                  {(material.tags?.length ?? 0) > TAGS_ON_A_ROW && (
                    <span className="text-faint">+{(material.tags?.length ?? 0) - TAGS_ON_A_ROW}</span>
                  )}
                  {material.excluded && <span className="text-warning">excluded</span>}
                </span>
                {reviewing && <Suggestion material={material} onDecide={decide} busy={action.busy} />}
              </span>
              <RowActions>
                <Menu
                  label={`Actions for this ${material.kind}`}
                  trigger={(props) => (
                    <IconButton
                      label="More actions"
                      {...props}
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onClick();
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </IconButton>
                  )}
                >
                  {(projects.data?.projects ?? []).map((project: Project) => {
                    const member = material.projects.includes(project.name);
                    return (
                      <MenuItem
                        key={project.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void action.run(() => api.setMembership(material.id, project.name, !member)).then(refresh);
                        }}
                      >
                        {member ? `Remove from ${project.name}` : `Add to ${project.name}`}
                      </MenuItem>
                    );
                  })}
                  <MenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      void action
                        .run(() => api.updateMaterial(material.id, { excluded: !material.excluded }))
                        .then(refresh);
                    }}
                  >
                    <EyeOff size={13} />
                    {material.excluded ? "Include in context" : "Exclude from context"}
                  </MenuItem>
                  <MenuItem
                    tone="danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      void action.run(() => api.deleteMaterial(material.id)).then(refresh);
                    }}
                  >
                    <Trash2 size={13} />
                    Delete
                  </MenuItem>
                </Menu>
              </RowActions>
            </Row>
          ))}
        </Rows>
      )}

      {visible.length > 0 && (
        <p className="mt-3 text-[11px] text-faint">
          {visible.length} of {materials.data?.materials.length ?? 0}
        </p>
      )}

      {openId && (
        <MaterialPanel
          materialId={openId}
          onClose={() => setOpenId(undefined)}
          onChanged={refresh}
          projects={projects.data?.projects ?? []}
        />
      )}
    </Page>
  );
}

