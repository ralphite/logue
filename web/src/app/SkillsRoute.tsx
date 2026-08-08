import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, ErrorNote, Field, Input, Select, Spinner, Textarea } from "@logue/ui";
import { api, type Skill } from "../api";
import { Nothing, Page } from "./AppShell";
import { ConfirmDelete } from "./ConfirmDelete";
import { useAction, useHost } from "./useHost";

/**
 * One Skill, full width. The list of them is in the rail.
 *
 * A prompt is a piece of writing, so it gets a page rather than a dialog with
 * a scroll bar — which is what it had, and why nobody edited one twice.
 */
export function SkillsRoute({
  openId,
  onOpen,
}: {
  openId?: string;
  onOpen: (id: string | undefined) => void;
}) {
  const skills = useHost(() => api.skills(), []);
  const [draft, setDraft] = useState<Partial<Skill>>();
  const [deleting, setDeleting] = useState<Skill>();
  const action = useAction();

  const skill = (skills.data?.skills ?? []).find((item) => item.id === openId);
  const editing = draft?.id === openId ? draft : skill;

  if (!openId || !skill || !editing) {
    return <Nothing section="Skills" hint="Pick a Skill from the list to read or change its prompt." />;
  }

  const save = () =>
    void action
      .run(() =>
        api.updateSkill(skill.id, {
          name: editing.name,
          purpose: editing.purpose,
          instructions: editing.instructions,
          output: editing.output,
          enabled: editing.enabled,
        }),
      )
      .then((ok) => {
        if (!ok) return;
        setDraft(undefined);
        void skills.refresh();
      });

  const dirty = draft?.id === openId;

  return (
    <Page
      title="Skills"
      onBack={() => onOpen(undefined)}
      here={skill.name}
      axis="reading"
      actions={
        <>
          {!skill.system && (
            <Button variant="ghost" onClick={() => setDeleting(skill)}>
              <Trash2 size={13} /> Delete
            </Button>
          )}
          <Button variant="primary" disabled={!dirty || action.busy} onClick={save}>
            {action.busy ? <Spinner size={13} /> : null} Save
          </Button>
        </>
      }
    >
      {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}

      <div className="grid gap-3">
        <Field label="Name">
          <Input
            value={editing.name ?? ""}
            onChange={(event) => setDraft({ ...editing, id: skill.id, name: event.target.value })}
          />
        </Field>
        <Field label="Result">
          <Select
            value={editing.output ?? "insert"}
            onChange={(event) => setDraft({ ...editing, id: skill.id, output: event.target.value })}
          >
            <option value="insert">Text to insert</option>
            <option value="document">Document</option>
            <option value="qa">An answer</option>
          </Select>
        </Field>
        <Field label="Used where">
          <span className="flex flex-wrap gap-1 text-[11px] text-muted">
            {skill.contexts.length === 0 ? "Anywhere" : skill.contexts.join(" · ")}
          </span>
        </Field>
        <Textarea
          className="min-h-64 font-mono text-xs"
          value={editing.instructions ?? ""}
          onChange={(event) => setDraft({ ...editing, id: skill.id, instructions: event.target.value })}
          placeholder="Tell the model exactly what to produce."
          aria-label="Instructions"
        />
        <p className="text-meta text-faint">Revision {skill.revision}. Runs keep the revision they used.</p>
      </div>

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
          void action.run(() => api.deleteSkill(deleting.id)).then((ok) => {
            if (!ok) return;
            setDeleting(undefined);
            onOpen(undefined);
            void skills.refresh();
          })
        }
      />
    </Page>
  );
}
