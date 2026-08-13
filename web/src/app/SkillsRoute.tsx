import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Dropdown, ErrorNote, Field, Input, Spinner, Textarea, Tooltip, cn } from "@logue/ui";
import { api, type Skill } from "../api";
import { DRAFT } from "./AppShell";
import { History, SKILL } from "./History";
import { NewNamed } from "./NewNamed";
import { ConfirmDelete } from "./ConfirmDelete";
import { DetailBody, DetailHeader, DetailPane, IconBadge, ListPane, ListSearch, RowMeta, RowName, RowShell } from "./panes";
import { useAction, useHost } from "./useHost";

/** The four places a Skill can be reached from, in the words each one uses. */
const WHERE: { key: string; label: string; hint: string }[] = [
  { key: "project", label: "A Project", hint: "Offered when generating from a Project's Sources." },
  { key: "page", label: "A page", hint: "Offered on the right-click menu of a web page." },
  { key: "selection", label: "A selection", hint: "Offered on the toolbar over selected text." },
  { key: "dictation", label: "Dictation", hint: "Offered on anything spoken into the panel." },
];

/** Where this Skill shows up, as one quiet line for the list. */
function offeredAt(skill: Skill): string {
  if (skill.system) return "built-in";
  const places = (skill.contexts ?? [])
    .map((key) => WHERE.find((where) => where.key === key)?.label.toLowerCase())
    .filter(Boolean);
  if (places.length === 0) return skill.instructions?.trim() ? "offered nowhere" : "no prompt yet";
  return places.join(" · ");
}

/**
 * Skills, as three panes: every prompt on the left, the one being read or
 * rewritten on the right. A prompt is a piece of writing, so the editor keeps
 * the whole remaining width.
 */
export function SkillsRoute({
  openId,
  onOpen,
  onCreated,
  made = 0,
  onVisibleOrder,
}: {
  openId?: string;
  onOpen: (id: string | undefined) => void;
  /** A draft became real. */
  onCreated: (id: string) => void;
  /** Bumped when something new was made outside this list. */
  made?: number;
  /** The rows on screen, for ⌥⌘↑/↓ to step through. */
  onVisibleOrder?: (ids: string[]) => void;
}) {
  const skills = useHost(() => api.skills(), [made]);
  const [query, setQuery] = useState("");

  const all = useMemo(() => skills.data?.skills ?? [], [skills.data]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((one) => `${one.name} ${one.instructions ?? ""}`.toLowerCase().includes(needle));
  }, [all, query]);

  useEffect(() => {
    onVisibleOrder?.(shown.map((one) => one.id));
  }, [shown, onVisibleOrder]);

  const selectedId = openId && openId !== DRAFT ? openId : openId === DRAFT ? undefined : all[0]?.id;

  return (
    <div className="flex min-h-0 flex-1">
      <ListPane
        title="Skills"
        count={all.length}
        controls={<ListSearch value={query} onChange={setQuery} />}
      >
        {skills.error && (
          <div className="p-4">
            <ErrorNote>{skills.error}</ErrorNote>
          </div>
        )}
        {skills.loading && (
          <div className="flex items-center gap-2 p-4 text-xs text-muted">
            <Spinner /> Loading
          </div>
        )}
        {shown.map((one) => (
          <RowShell
            key={one.id}
            badge={<IconBadge name="skills" tinted={one.id === selectedId} />}
            selected={one.id === selectedId}
            onSelect={() => onOpen(one.id)}
          >
            <RowName>{one.name || "Untitled Skill"}</RowName>
            <RowMeta>
              <span className="truncate">{offeredAt(one)}</span>
            </RowMeta>
          </RowShell>
        ))}
      </ListPane>

      {openId === DRAFT ? (
        <NewNamed
          section="Skills"
          label="Skill"
          placeholder="Draft a reply"
          onCancel={() => onOpen(undefined)}
          onCreate={async (name) => {
            const { skill: born } = await api.createSkill({ name });
            onCreated(born.id);
            return born.id;
          }}
        />
      ) : selectedId ? (
        <SkillDetail
          key={selectedId}
          id={selectedId}
          skills={all}
          onGone={() => onOpen(undefined)}
          onSaved={() => void skills.refresh()}
        />
      ) : (
        <DetailPane>
          <DetailHeader name={<span className="font-[500] text-muted">Skills</span>} />
          <DetailBody>
            {!skills.loading && <p className="text-[12.5px] text-muted">No Skills yet — press + to write one.</p>}
          </DetailBody>
        </DetailPane>
      )}
    </div>
  );
}

function SkillDetail({
  id,
  skills,
  onGone,
  onSaved,
}: {
  id: string;
  skills: Skill[];
  onGone: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Skill>>();
  const [deleting, setDeleting] = useState<Skill>();
  const [looking, setLooking] = useState(false);
  const action = useAction();

  const skill = skills.find((item) => item.id === id);
  const editing = draft?.id === id ? draft : skill;
  if (!skill || !editing) {
    return (
      <DetailPane>
        <DetailHeader name={<span className="font-[500] text-muted">Skills</span>} />
        <DetailBody>
          <p className="text-[12.5px] text-muted">This Skill is gone.</p>
        </DetailBody>
      </DetailPane>
    );
  }

  const save = () =>
    void action
      .run(() =>
        api.updateSkill(skill.id, {
          name: editing.name,
          purpose: editing.purpose,
          instructions: editing.instructions,
          output: editing.output,
          contexts: editing.contexts,
          enabled: editing.enabled,
        }),
      )
      .then((ok) => {
        if (!ok) return;
        setDraft(undefined);
        onSaved();
      });

  const dirty = draft?.id === id;

  return (
    <DetailPane>
      <DetailHeader
        badge={<IconBadge name="skills" tinted />}
        name={skill.name || "Untitled Skill"}
        sub={`${skill.system ? "Built-in · " : ""}revision ${skill.revision}`}
        actions={
          <>
            {!skill.system && (
              <Tooltip label="Delete this Skill">
                <Button variant="ghost" onClick={() => setDeleting(skill)}>
                  <Trash2 size={13} /> Delete
                </Button>
              </Tooltip>
            )}
            <Button variant="primary" disabled={!dirty || action.busy} onClick={save}>
              {action.busy ? <Spinner size={13} /> : null} Save
            </Button>
          </>
        }
      />
      <DetailBody>
        {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}

        <div className="grid max-w-[44rem] gap-3">
          <Field label="Name">
            <Input
              value={editing.name ?? ""}
              onChange={(event) => setDraft({ ...editing, id: skill.id, name: event.target.value })}
            />
          </Field>
          <Field label="Result">
            <Dropdown
              label="What this Skill produces"
              value={editing.output ?? "insert"}
              onChange={(output) => setDraft({ ...editing, id: skill.id, output })}
              options={[
                { value: "insert", label: "Text to insert" },
                { value: "document", label: "Document" },
                { value: "qa", label: "An answer" },
              ]}
            />
          </Field>
          <Field label="Used where">
            <div className="flex flex-wrap gap-1.5">
              {WHERE.map((where) => {
                const on = (editing.contexts ?? []).includes(where.key);
                return (
                  <Tooltip key={where.key} label={where.hint}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDraft({
                          ...editing,
                          id: skill.id,
                          contexts: on
                            ? (editing.contexts ?? []).filter((name) => name !== where.key)
                            : [...(editing.contexts ?? []), where.key],
                        })
                      }
                      className={cn(
                        "h-control rounded-md border px-2 text-xs font-[560]",
                        on
                          ? "border-accent-line bg-accent-soft text-accent-ink"
                          : "border-line-strong bg-surface text-muted hover:text-ink",
                      )}
                    >
                      {where.label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </Field>
          <Textarea
            className="min-h-64 font-mono text-xs"
            value={editing.instructions ?? ""}
            onChange={(event) => setDraft({ ...editing, id: skill.id, instructions: event.target.value })}
            placeholder="Tell the model exactly what to produce."
            aria-label="Instructions"
            autoFocus={!skill.instructions}
          />
          {!skill.instructions?.trim() && (
            <p className="text-xs text-warning">No prompt yet, so it is offered nowhere.</p>
          )}
          <p className="text-xs text-muted">
            <Tooltip label="Runs keep the exact revision they used">
              <button
                type="button"
                onClick={() => setLooking(true)}
                className="-my-1 inline-flex min-h-6 items-center rounded-md py-1 underline decoration-line underline-offset-2 hover:text-ink"
              >
                Revision {skill.revision}
              </button>
            </Tooltip>
          </p>
        </div>

        <History
          kind={SKILL}
          id={skill.id}
          open={looking}
          onClose={() => setLooking(false)}
          onRestored={() => {
            setDraft(undefined);
            onSaved();
          }}
        />

        <ConfirmDelete
          open={Boolean(deleting)}
          title="Delete this Skill"
          what={deleting?.name ?? ""}
          busy={action.busy}
          error={action.error}
          kept="Runs that used it keep the exact prompt they ran with."
          impact={async () => {
            if (!deleting) return [];
            const found = await api.skillImpact(deleting.id);
            return [
              ...(found.runs > 0 ? [`${found.runs} answers were generated with it`] : []),
              ...found.projects.map((name) => `Project · ${name} reaches for it`),
            ];
          }}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() =>
            deleting &&
            void action
              .run(() => api.deleteSkill(deleting.id))
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
