import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  ErrorNote,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Select,
  Spinner,
  Textarea,
} from "@logue/ui";
import { api, type Skill } from "../api";
import { Page, Row, RowActions, Rows } from "./AppShell";
import { useAction, useHost } from "./useHost";

const BLANK = {
  name: "",
  purpose: "",
  instructions: "",
  task: "generate",
  output: "insert",
  contexts: ["selection"],
};

/**
 * Prompts you can edit. Built-ins are ordinary Skills — editing one is how you
 * make Logue write the way you write.
 */
export function SkillsRoute() {
  const skills = useHost(() => api.skills(), []);
  const [editing, setEditing] = useState<Partial<Skill>>();
  const action = useAction();

  const save = async () => {
    if (!editing) return;
    const ok = await action.run(() =>
      editing.id
        ? api.updateSkill(editing.id, {
            name: editing.name,
            purpose: editing.purpose,
            instructions: editing.instructions,
            output: editing.output,
          })
        : api.createSkill(editing),
    );
    if (ok) {
      setEditing(undefined);
      void skills.refresh();
    }
  };

  return (
    <Page
      title="Skills"
      actions={
        <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
          <Plus size={13} /> New
        </Button>
      }
    >
      {skills.error && <ErrorNote className="mb-2">{skills.error}</ErrorNote>}
      {skills.loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-muted">
          <Spinner /> Loading
        </div>
      ) : (
        <Rows>
          {skills.data?.skills.map((skill) => (
            <Row key={skill.id} onClick={() => setEditing(skill)}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] text-ink">{skill.name}</span>
                  {skill.system && <span className="text-[11px] text-faint">built-in</span>}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {skill.purpose || skill.instructions}
                </span>
              </span>
              <RowActions>
                <Menu
                  label="Skill actions"
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
                  <MenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditing({ ...skill, id: undefined, name: `${skill.name} copy`, system: false });
                    }}
                  >
                    Duplicate
                  </MenuItem>
                  {!skill.system && (
                    <MenuItem
                      tone="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        void action.run(() => api.deleteSkill(skill.id)).then(() => skills.refresh());
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </MenuItem>
                  )}
                </Menu>
              </RowActions>
            </Row>
          ))}
        </Rows>
      )}

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(undefined)}
        title={editing?.id ? editing.name || "Skill" : "New Skill"}
        width="w-[min(520px,calc(100vw-32px))]"
      >
        {editing && (
          <>
            <Field label="Name">
              <Input
                autoFocus
                value={editing.name ?? ""}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </Field>
            <Field label="Result">
              <Select
                value={editing.output ?? "insert"}
                onChange={(event) => setEditing({ ...editing, output: event.target.value })}
              >
                <option value="insert">Text to insert</option>
                <option value="document">Document</option>
              </Select>
            </Field>
            <Textarea
              className="min-h-40 font-mono text-xs"
              value={editing.instructions ?? ""}
              onChange={(event) => setEditing({ ...editing, instructions: event.target.value })}
              placeholder="Tell the model exactly what to produce."
              aria-label="Instructions"
            />
            {action.error && <ErrorNote>{action.error}</ErrorNote>}
            <DialogActions>
              <Button onClick={() => setEditing(undefined)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!editing.name?.trim() || !editing.instructions?.trim() || action.busy}
                onClick={() => void save()}
              >
                Save
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Page>
  );
}
