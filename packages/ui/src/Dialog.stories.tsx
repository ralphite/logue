import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./Button";
import { Dialog, DialogActions } from "./Dialog";
import { Field, Input, Textarea } from "./Field";

const meta = { title: "Overlays/Dialog", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="grid min-h-screen place-items-center">
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Dialog>
    </div>
  );
}

/** Escape and a backdrop press close it; focus stays inside while it is open. */
export const NewProject: Story = {
  render: () => (
    <Demo title="New Project">
      <Field label="Name">
        <Input autoFocus placeholder="Mobile research" />
      </Field>
      <Field label="Context">
        <Textarea placeholder="What this Project is about" />
      </Field>
      <DialogActions>
        <Button>Cancel</Button>
        <Button variant="primary">Create</Button>
      </DialogActions>
    </Demo>
  ),
};

/** A destructive dialog states what survives, in one line. */
export const Destructive: Story = {
  render: () => (
    <Demo title="Delete Mobile research?">
      <p className="text-[13px] leading-[1.5] text-ink-soft">Its 26 Sources stay in your Stream.</p>
      <DialogActions>
        <Button>Keep</Button>
        <Button variant="danger">Delete Project</Button>
      </DialogActions>
    </Demo>
  ),
};
