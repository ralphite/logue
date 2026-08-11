import { MoreHorizontal } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, IconButton } from "./Button";
import { Menu, MenuItem } from "./Menu";

const meta = { title: "Component/Menu", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The disclosure that keeps a row calm: one visible action, the rest folded. */
export const RowActions: Story = {
  render: () => (
    <div className="flex w-[420px] items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
      <span className="truncate text-[13px]">Offline access matters more than sync</span>
      <span className="flex items-center gap-1">
        <Button>Open</Button>
        <Menu
          label="More actions for this Source"
          trigger={(props) => (
            <IconButton label="More actions" {...props}>
              <MoreHorizontal size={15} />
            </IconButton>
          )}
        >
          <MenuItem>Add to Project</MenuItem>
          <MenuItem>Exclude from context</MenuItem>
          <MenuItem tone="danger">Delete Source</MenuItem>
        </Menu>
      </span>
    </div>
  ),
};
