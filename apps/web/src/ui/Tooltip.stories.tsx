import { Info, MoreHorizontal } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./Button";
import { Tooltip, TooltipProvider } from "./Tooltip";

function TooltipPreview({ side = "right", shortcut, disabled = false }: { side?: "top" | "right" | "bottom" | "left"; shortcut?: string; disabled?: boolean }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-48 items-center justify-center bg-[#f7f7f5] p-10">
        <Tooltip content="More actions" side={side} shortcut={shortcut} disabled={disabled}>
          <IconButton label="More actions"><MoreHorizontal size={17} /></IconButton>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

const meta = {
  title: "Components/Feedback/Tooltip",
  component: TooltipPreview,
  parameters: { layout: "centered" },
} satisfies Meta<typeof TooltipPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithShortcut: Story = { args: { side: "top", shortcut: "⌘ K" } };
export const Disabled: Story = { args: { disabled: true } };
export const Informational: Story = {
  render: () => <TooltipProvider><Tooltip content="This panel follows the browser setting for its side."><span className="inline-flex size-10 items-center justify-center rounded-md bg-[#f0f0ed] text-[#676863]"><Info size={17} /></span></Tooltip></TooltipProvider>,
};
