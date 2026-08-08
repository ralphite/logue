import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { Input } from "./Field";
import { RowActions } from "./RowActions";

const meta = {
  title: "Components/Actions/RowActions",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The one action a row is for stays visible; the rest fold behind the menu. */
export const Default: Story = {
  render: () => (
    <div className="flex w-125 justify-end">
      <RowActions label="More actions for this Source" primary={<Button size="sm">Open</Button>}>
        <Button size="sm" variant="ghost">Add to Project</Button>
        <Button size="sm" variant="ghost">Exclude from Context</Button>
        <Button size="sm" variant="danger">Delete Source</Button>
      </RowActions>
    </div>
  ),
};

/** With nothing to fold away, the trigger does not appear at all. */
export const PrimaryOnly: Story = {
  render: () => (
    <div className="flex w-125 justify-end">
      <RowActions label="More actions" primary={<Button size="sm">Open</Button>} />
    </div>
  ),
};

/** The menu can hold an input, so a rename never needs its own dialog. */
export const WithInput: Story = {
  render: () => (
    <div className="flex w-125 justify-end">
      <RowActions label="Rename this Topic" primary={<Button size="sm">Open</Button>}>
        <Input defaultValue="Offline access" aria-label="Topic name" />
        <Button size="sm" variant="primary">Save name</Button>
      </RowActions>
    </div>
  ),
};
