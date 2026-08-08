import { Check, Mic, MoreHorizontal, Trash2 } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, IconButton } from "./Button";

const meta = {
  title: "Controls/Button",
  component: Button,
  args: { children: "Insert" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One accented action per surface. Everything beside it stays quiet. */
export const OnePrimary: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <Button variant="ghost">Cancel</Button>
      <Button>Save draft</Button>
      <Button variant="primary">
        Insert <kbd>⌘↵</kbd>
      </Button>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-1">
      <Button>Default</Button>
      <Button variant="primary">Primary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Delete</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

/** Low-frequency actions lose their words but keep them in the tooltip. */
export const Icons: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <IconButton label="Start voice input">
        <Mic size={15} />
      </IconButton>
      <IconButton label="Accept" variant="primary">
        <Check size={15} />
      </IconButton>
      <IconButton label="More actions">
        <MoreHorizontal size={15} />
      </IconButton>
      <IconButton label="Delete Source" variant="danger">
        <Trash2 size={14} />
      </IconButton>
    </div>
  ),
};
