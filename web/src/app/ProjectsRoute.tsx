import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Empty, ErrorNote, OriginMark, SourceLink, Spinner, Textarea, originOf } from "@logue/ui";
import { api, type Run } from "../api";
import { DRAFT, Nothing, Page, Row, RowActions, Rows } from "./AppShell";
import { NewNamed } from "./NewNamed";
import { ConfirmDelete } from "./ConfirmDelete";
import { timeAgo, useAction, useHost } from "./useHost";
import { GenerateBox } from "./GenerateBox";

export function ProjectsRoute({
  openId,
  onOpen,
  onOpenDocument,
  onOpenSource,
  onCreated,
}: {
  openId?: string;
  onOpen: (id: string | undefined) => void;
  onOpenDocument: (id: string) => void;
  /** Go to this Source where it lives — in the Stream. */
  onOpenSource: (id: string) => void;
  /** A draft became real. */
  onCreated: (id: string) => void;
}) {
  if (openId === DRAFT) {
    return (
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
    );
  }
  return openId ? (
    <ProjectDetail
      id={openId}
      onBack={() => onOpen(undefined)}
      onOpenDocument={onOpenDocument}
      onOpenSource={onOpenSource}
    />
  ) : (
    <Nothing section="Projects" hint="Pick one from the list, or start a new Project." />
  );
}

/**
 * What became of an answer.
 *
 * "Used" and "read and closed" are different verdicts on a Skill, and a Skill
 * whose answers are always taken back is worse than one nobody runs.
 */
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
    <span className="text-faint">{verb}, then undone</span>
  ) : (
    <span className="text-success">{verb}</span>
  );
}

function ProjectDetail({
  id,
  onBack,
  onOpenDocument,
  onOpenSource,
}: {
  id: string;
  onBack: () => void;
  onOpenDocument: (documentId: string) => void;
  onOpenSource: (sourceId: string) => void;
}) {
  const detail = useHost(() => api.project(id), [id]);
  const skills = useHost(() => api.skills(), []);
  const runs = useHost(() => api.runs(), []);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string }>();
  const [overview, setOverview] = useState("");
  const action = useAction();
  const project = detail.data?.project;

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
    <Page
      title="Projects"
      onBack={onBack}
      here={project?.name ?? ""}
      actions={
        project && (
          <Button variant="ghost" onClick={() => setDeleting(project)}>
            <Trash2 size={13} /> Delete
          </Button>
        )
      }
    >
      {/* A spinner that never stops is what a deleted Project used to look
          like. Say what happened instead. */}
      {detail.error && <ErrorNote className="mb-2">{detail.error}</ErrorNote>}
      {!project ? (
        detail.error ? null : (
          <div className="flex items-center gap-2 py-8 text-xs text-muted">
            <Spinner /> Loading
          </div>
        )
      ) : (
        <div className="grid gap-5">
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
              <button
                type="button"
                onClick={() => {
                  setOverview(project.overview);
                  setEditing(true);
                }}
                className="w-full rounded-md px-1.5 py-1 text-left text-[13px] leading-[1.55] text-ink-soft hover:bg-hover"
              >
                {project.overview || <span className="text-faint">Add context for this Project…</span>}
              </button>
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
            <section className="grid gap-1.5">
              <h2 className="text-xs text-muted">Recent answers</h2>
              <Rows>
                {projectRuns.slice(0, 6).map((run) => (
                  <Row key={run.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{run.instruction}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <Sparkles size={11} />
                        {run.skill_name}
                        <span>{run.sources.length} Sources</span>
                        <span>{timeAgo(run.created_at)}</span>
                        {run.status === "failed" && <span className="text-danger">failed</span>}
                        <Used run={run} />
                      </span>
                    </span>
                    {run.adoption && !run.adoption_undone && (
                      <RowActions>
                        <Button
                          variant="ghost"
                          disabled={action.busy}
                          onClick={() =>
                            void action.run(() => api.undoRun(run.id)).then(() => runs.refresh())
                          }
                        >
                          Undo
                        </Button>
                      </RowActions>
                    )}
                  </Row>
                ))}
              </Rows>
            </section>
          )}

          <ConfirmDelete
            open={Boolean(deleting)}
            title="Delete this Project"
            what={deleting?.name ?? ""}
            busy={action.busy}
            error={action.error}
            kept="Every Source stays in the Stream. Only the grouping goes."
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
                  onBack();
                })
            }
          />

          <section className="grid gap-1.5">
            <h2 className="text-xs text-muted">{detail.data?.materials.length} Sources</h2>
            {detail.data?.materials.length === 0 ? (
              <Empty>Add Sources from the Stream, or capture with the Extension.</Empty>
            ) : (
              <Rows>
                {detail.data?.materials.map((material) => (
                  // Every Source has a home in the Stream. Listing one without
                  // a way to reach it makes you go and find it by hand.
                  <Row key={material.id} onClick={() => onOpenSource(material.id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{material.content}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <OriginMark origin={originOf(material.kind)} />
                        <SourceLink
                          url={material.source?.url}
                          label={material.source?.domain || "This Mac"}
                        />
                        <span>{timeAgo(material.created_at)}</span>
                      </span>
                    </span>
                  </Row>
                ))}
              </Rows>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
