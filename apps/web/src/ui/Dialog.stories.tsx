import { X } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button, IconButton } from "./Button";
import { Dialog } from "./Dialog";
import { Field, Input } from "./Field";
import { InlineActions } from "./Surface";
import { OriginLabel } from "./OriginLabel";

const meta = {
  title: "Components/Overlays/Dialog",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ children, label }: { children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} label={label}>
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <OriginLabel origin="you" detail="Local Project boundary" />
              <h2>{label}</h2>
            </div>
            <IconButton label="Close" variant="ghost" onClick={() => setOpen(false)}>
              <X size={16} />
            </IconButton>
          </div>
          {children}
        </>
      </Dialog>
    </div>
  );
}

/** Escape and a backdrop press both close it; focus stays inside while open. */
export const NewProject: Story = {
  render: () => (
    <Demo label="New Project">
      <Field>
        Name
        <Input autoFocus placeholder="Mobile research" />
      </Field>
      <Field>
        Goal
        <Input placeholder="What this Project is for" />
      </Field>
      <InlineActions className="justify-end">
        <Button>Cancel</Button>
        <Button variant="primary">Create Project</Button>
      </InlineActions>
    </Demo>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Demo label="Delete Mobile research?">
      <p className="text-[13px] leading-[1.55] text-ink-soft">
        The Project and its Context membership are removed. Every Source stays in your Library.
      </p>
      <InlineActions className="justify-end">
        <Button>Keep Project</Button>
        <Button variant="danger">Delete Project</Button>
      </InlineActions>
    </Demo>
  ),
};
