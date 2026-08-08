import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, DialogActions, Empty, ErrorNote, Field, Input, OriginMark, Spinner, Textarea, originOf } from "@logue/ui";
import { api, type Run } from "../api";
import { Page, Row, RowActions, Rows } from "./AppShell";
import { timeAgo, useAction, useHost } from "./useHost";
import { GenerateBox } from "./GenerateBox";

export function ProjectsRoute({
  openId,
  onOpen,
  onOpenDocument,
}: {
  openId?: string;
  onOpen: (id: string | undefined) => void;
  onOpenDocument: (id: string) => void;
}) {
  return openId ? (
    <ProjectDetail id={openId} onBack={() => onOpen(undefined)} onOpenDocument={onOpenDocument} />
  ) : (
    <ProjectList onOpen={onOpen} />
  );
}

function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const projects = useHost(() => api.projects(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [overview, setOverview] = useState("");
  const action = useAction();

  const create = async () => {
    const ok = await action.run(() => api.createProject(name, overview));
    if (!ok) return;
    setCreating(false);
    setName("");
    setOverview("");
    void projects.refresh();
  };

  return (
    <Page
      title="Projects"
      actions={
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={13} /> New
        </Button>
      }
    >
      {projects.error && <ErrorNote className="mb-2">{projects.error}</ErrorNote>}
      {projects.loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-muted">
          <Spinner /> Loading
        </div>
      ) : (projects.data?.projects.length ?? 0) === 0 ? (
        <Empty action={<Button variant="primary" onClick={() => setCreating(true)}>New Project</Button>}>
          A Project gives Logue the background to sound like your work.
        </Empty>
      ) : (
        <Rows>
          {projects.data?.projects.map((project) => (
            <Row key={project.id} onClick={() => onOpen(project.id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-[560] text-ink">{project.name}</span>
                {project.overview && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted">{project.overview}</span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-faint">{project.count} Sources</span>
            </Row>
          ))}
        </Rows>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title="New Project">
        <Field label="Name">
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Mobile research" />
        </Field>
        <Field label="Context">
          <Textarea
            value={overview}
            onChange={(event) => setOverview(event.target.value)}
            placeholder="What this Project is about"
          />
        </Field>
        {action.error && <ErrorNote>{action.error}</ErrorNote>}
        <DialogActions>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || action.busy} onClick={() => void create()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
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
}: {
  id: string;
  onBack: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const detail = useHost(() => api.project(id), [id]);
  const skills = useHost(() => api.skills(), []);
  const runs = useHost(() => api.runs(), []);
  const [editing, setEditing] = useState(false);
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
    >
      {detail.error && <ErrorNote className="mb-2">{detail.error}</ErrorNote>}
      {!project ? (
        <div className="flex items-center gap-2 py-8 text-xs text-muted">
          <Spinner /> Loading
        </div>
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
                          onClick={() => void action.run(() => api.undoRun(run.id)).then(() => runs.refresh())}
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

          <section className="grid gap-1.5">
            <h2 className="text-xs text-muted">{detail.data?.materials.length} Sources</h2>
            {detail.data?.materials.length === 0 ? (
              <Empty>Add Sources from the Stream, or capture with the Extension.</Empty>
            ) : (
              <Rows>
                {detail.data?.materials.map((material) => (
                  <Row key={material.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{material.content}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <OriginMark origin={originOf(material.kind)} />
                        <span className="truncate">{material.source?.domain || "This Mac"}</span>
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

