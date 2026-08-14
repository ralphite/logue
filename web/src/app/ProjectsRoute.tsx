import { Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ACTS, ActBadge, Button, Empty, ErrorNote, Spinner, Textarea, Tooltip } from "@logue/ui";
import { api, type Run } from "../api";
import { kindOf } from "./ActivitiesPage";
import { DRAFT } from "./AppShell";
import { NewNamed } from "./NewNamed";
import { ConfirmDelete } from "./ConfirmDelete";
import {
  DetailBody,
  DetailHeader,
  DetailPane,
  IconBadge,
  ListPane,
  ListSearch,
  RowMeta,
  RowName,
  RowShell,
  Section,
} from "./panes";
import { timeAgo, useAction, useHost } from "./useHost";
import { GenerateBox } from "./GenerateBox";
import { RunDialog } from "./RunDialog";

/**
 * Projects, as three panes: every grouping on the left, the one being worked
 * in on the right — its overview, the place to ask, what was asked, and the
 * Sources it holds.
 */
export function ProjectsRoute({
  openId,
  onOpen,
  onOpenDocument,
  onOpenSource,
  onCreated,
  made = 0,
  onVisibleOrder,
}: {
  openId?: string;
  onOpen: (id: string | undefined) => void;
  onOpenDocument: (id: string) => void;
  /** Go to this Source where it lives — in the Stream. */
  onOpenSource: (id: string) => void;
  /** A draft became real. */
  onCreated: (id: string) => void;
  made?: number;
  /** The rows on screen, for ⌥⌘↑/↓ to step through. */
  onVisibleOrder?: (ids: string[]) => void;
}) {
  const projects = useHost(() => api.projects(), [made]);
  const [query, setQuery] = useState("");

  const all = useMemo(() => projects.data?.projects ?? [], [projects.data]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((one) => `${one.name} ${one.overview}`.toLowerCase().includes(needle));
  }, [all, query]);

  useEffect(() => {
    onVisibleOrder?.(shown.map((one) => one.id));
  }, [shown, onVisibleOrder]);

  const selectedId = openId && openId !== DRAFT ? openId : openId === DRAFT ? undefined : all[0]?.id;

  return (
    <div className="flex min-h-0 flex-1">
      <ListPane
        title="Projects"
        onNew={() => onOpen(DRAFT)}
        newLabel="New Project"
        count={all.length}
        controls={<ListSearch value={query} onChange={setQuery} />}
      >
        {projects.error && (
          <div className="p-4">
            <ErrorNote>{projects.error}</ErrorNote>
          </div>
        )}
        {projects.loading && (
          <div className="flex items-center gap-2 p-4 text-xs text-muted">
            <Spinner /> Loading
          </div>
        )}
        {shown.map((one) => (
          <RowShell
            key={one.id}
            badge={<IconBadge name="folder" tinted={one.id === selectedId} />}
            selected={one.id === selectedId}
            onSelect={() => onOpen(one.id)}
          >
            <RowName edge={one.updated_at ? timeAgo(one.updated_at) : undefined}>{one.name}</RowName>
            <RowMeta>
              <span className="flex-none tabular-nums">
                {one.count ?? 0} {one.count === 1 ? "source" : "sources"}
              </span>
              {one.overview && <span className="truncate">· {one.overview}</span>}
            </RowMeta>
          </RowShell>
        ))}
      </ListPane>

      {openId === DRAFT ? (
        <NewNamed
          section="Projects"
          label="Project"
          placeholder="Mobile research"
          onCancel={() => onOpen(undefined)}
          onCreate={async (name) => {
            const { project } = await api.createProject(name, "");
            onCreated(project.id);
            return project.id;
          }}
        />
      ) : selectedId ? (
        <ProjectDetail
          key={selectedId}
          id={selectedId}
          onGone={() => onOpen(undefined)}
          onOpenDocument={onOpenDocument}
          onOpenSource={onOpenSource}
        />
      ) : (
        <DetailPane>
          <DetailHeader name={<span className="font-[500] text-muted">Projects</span>} />
          <DetailBody>
            {!projects.loading && (
              <p className="text-[12.5px] text-muted">No Projects yet — press + to start one.</p>
            )}
          </DetailBody>
        </DetailPane>
      )}
    </div>
  );
}

/** What became of an answer: "used" and "read and closed" are different verdicts. */
function Used({ run }: { run: Run }) {
  if (!run.adoption && !run.adopted_output) return null;
  const verbs: Record<NonNullable<Run["adoption"]>, string> = {
    keep: "kept",
    insert: "inserted",
    copy: "copied",
    document: "made a Document",
  };
  const verb = verbs[run.adoption ?? "keep"];
  return run.adoption_undone ? (
    <span className="text-muted">{verb}, then undone</span>
  ) : (
    <span className="text-success">{verb}</span>
  );
}

function ProjectDetail({
  id,
  onGone,
  onOpenDocument,
  onOpenSource,
}: {
  id: string;
  onGone: () => void;
  onOpenDocument: (documentId: string) => void;
  onOpenSource: (sourceId: string) => void;
}) {
  const detail = useHost(() => api.project(id), [id]);
  const skills = useHost(() => api.skills(), []);
  const runs = useHost(() => api.runs(), []);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string }>();
  const [overview, setOverview] = useState("");
  const [reading, setReading] = useState<string>();
  const action = useAction();
  const project = detail.data?.project;
  const materials = detail.data?.materials ?? [];

  const save = async () => {
    if (!project) return;
    const ok = await action.run(() => api.updateProject(project.id, { overview }));
    if (ok) {
      setEditing(false);
      void detail.refresh();
    }
  };

  const projectRuns = (runs.data?.runs ?? []).filter((run) => run.project === project?.name);

  return (
    <DetailPane>
      <DetailHeader
        badge={<IconBadge name="folder" tinted />}
        name={project?.name ?? ""}
        sub={project ? `${materials.length} ${materials.length === 1 ? "source" : "sources"}` : undefined}
        actions={
          project && (
            <Tooltip label="Delete this Project — its Sources stay">
              <Button variant="ghost" onClick={() => setDeleting(project)}>
                <Trash2 size={13} /> Delete
              </Button>
            </Tooltip>
          )
        }
      />
      <DetailBody>
        {detail.error && <ErrorNote className="mb-2">{detail.error}</ErrorNote>}
        {!project ? (
          detail.error ? null : (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Loading
            </div>
          )
        ) : (
          <div className="grid max-w-[52rem] gap-5">
            <section>
              {editing ? (
                <div className="grid gap-1.5">
                  <Textarea
                    autoFocus
                    value={overview}
                    onChange={(event) => setOverview(event.target.value)}
                    placeholder="What this Project is about"
                  />
                  <span className="flex justify-end gap-1">
                    <Button onClick={() => setEditing(false)}>Cancel</Button>
                    <Button variant="primary" disabled={action.busy} onClick={() => void save()}>
                      Save
                    </Button>
                  </span>
                </div>
              ) : (
                <Tooltip label="Read by the filer and by every answer — click to edit">
                  <button
                    type="button"
                    onClick={() => {
                      setOverview(project.overview);
                      setEditing(true);
                    }}
                    className="w-full rounded-md px-1.5 py-1 text-left text-[13px] leading-[1.55] text-ink-soft hover:bg-hover"
                  >
                    {project.overview || <span className="text-muted">Add context for this Project…</span>}
                  </button>
                </Tooltip>
              )}
            </section>

            <GenerateBox
              project={project.name}
              skills={skills.data?.skills ?? []}
              onDone={() => {
                void runs.refresh();
              }}
              onStale={() => void skills.refresh()}
              onOpenDocument={onOpenDocument}
            />

            {projectRuns.length > 0 && (
              <Section cap="Answers" count={projectRuns.length}>
                <div className="mt-2 grid">
                  {projectRuns.slice(0, 6).map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center gap-2 border-b border-line py-[7px] last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => setReading(run.id)}
                        className="min-w-0 flex-1 rounded-md text-left"
                      >
                        <span className="block truncate text-[12.5px] text-ink">{run.instruction}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted">
                          <Sparkles size={11} />
                          {run.skill_name}
                          <span className="underline decoration-line underline-offset-2">
                            {run.sources.length} sources
                          </span>
                          <span>{timeAgo(run.created_at)}</span>
                          {run.status === "failed" && <span className="text-danger">failed</span>}
                          <Used run={run} />
                        </span>
                      </button>
                      {run.adoption && !run.adoption_undone && (
                        <Button
                          variant="ghost"
                          disabled={action.busy}
                          onClick={() => void action.run(() => api.undoRun(run.id)).then(() => runs.refresh())}
                        >
                          Undo
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section cap="Sources" count={materials.length} corner="newest first">
              {materials.length === 0 ? (
                <Empty>Nothing here yet — capture with the extension.</Empty>
              ) : (
                <div className="mt-2 -mx-4">
                  {materials.map((material) => (
                    <RowShell
                      key={material.id}
                      badge={<ActBadge kind={kindOf(material)} className="mt-px" />}
                      onSelect={() => onOpenSource(material.id)}
                    >
                      <RowName edge={timeAgo(material.created_at)}>{ACTS[kindOf(material)].label}</RowName>
                      <span className="mt-[2px] block truncate text-[12.5px] font-[430] leading-[1.35] text-ink/85">
                        {material.content || "Empty"}
                      </span>
                      <RowMeta>
                        <span className="truncate">{material.source?.domain || "this Mac"}</span>
                      </RowMeta>
                    </RowShell>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {reading && (
          <RunDialog
            id={reading}
            open={Boolean(reading)}
            onClose={() => setReading(undefined)}
            onOpenSource={onOpenSource}
          />
        )}

        <ConfirmDelete
          open={Boolean(deleting)}
          title="Delete this Project"
          what={deleting?.name ?? ""}
          busy={action.busy}
          error={action.error}
          kept="Every Source stays in Activities. Only the grouping goes."
          impact={async () => {
            if (!deleting) return [];
            const preview = await api.projectDeletionPreview(deleting.id);
            return preview.materials_kept > 0
              ? [`${preview.materials_kept} Sources stop being grouped by it`]
              : [];
          }}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() =>
            deleting &&
            void action
              .run(() => api.deleteProject(deleting.id))
              .then((ok) => {
                if (!ok) return;
                setDeleting(undefined);
                onGone();
              })
          }
        />
      </DetailBody>
    </DetailPane>
  );
}
