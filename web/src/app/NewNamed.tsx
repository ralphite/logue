import { useState } from "react";
import { Button, ErrorNote, Input, Spinner } from "@logue/ui";
import { DetailBody, DetailHeader, DetailPane } from "./panes";
import { useAction } from "./useHost";

/**
 * A Project or a Skill that does not exist yet.
 *
 * Pressing `+` used to write "New Project" into the workspace immediately, so
 * pressing it five times left five of them. Nothing goes in until it is meant —
 * and for these two, meaning it is giving the thing a name. A Project called
 * "New Project" was never useful anyway.
 */
export function NewNamed({
  section,
  label,
  placeholder,
  onCancel,
  onCreate,
}: {
  /** "Projects" — the section this will live in. */
  section: string;
  /** "Project" — what one of them is called. */
  label: string;
  placeholder: string;
  onCancel: () => void;
  onCreate: (name: string) => Promise<string>;
}) {
  const [name, setName] = useState("");
  const action = useAction();

  const make = () =>
    void action.run(async () => {
      await onCreate(name.trim());
    });

  return (
    <DetailPane>
      <DetailHeader name={`New ${label}`} sub={section} />
      <DetailBody>
        <label className="grid max-w-96 gap-2">
          <span className="text-[13px] text-muted">What is this {label} called?</span>
          <Input
            autoFocus
            value={name}
            placeholder={placeholder}
            aria-label={`Name for the new ${label}`}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) make();
              if (event.key === "Escape") onCancel();
            }}
            className="text-[15px]"
          />
          {action.error && <ErrorNote>{action.error}</ErrorNote>}
          <span className="flex items-center gap-2 pt-1">
            <Button data-primary variant="primary" disabled={!name.trim() || action.busy} onClick={make}>
              {action.busy ? <Spinner size={13} /> : null} Create
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </span>
          <span className="pt-1 text-xs text-muted">Nothing is saved until you create it.</span>
        </label>
      </DetailBody>
    </DetailPane>
  );
}
