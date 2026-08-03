import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { OverlayMenu } from "@logue/ui";

function Demo({ placement = "bottom-end", edge = false }: { placement?: "bottom-start" | "bottom-end"; edge?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`min-h-80 bg-white p-10 ${edge ? "flex items-end justify-end" : ""}`}>
      <OverlayMenu
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Document actions"
        placement={placement}
        trigger={(props) => (
          <button {...props} type="button" aria-label="Document menu" className="inline-flex size-8 items-center justify-center rounded-md text-[#73746f] hover:bg-[#f1f1ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4]">
            <MoreHorizontal size={16} />
          </button>
        )}
      >
        <button type="button" role="menuitem" className="flex h-8 w-full items-center rounded-md px-2 text-left text-[14px] text-[#4f504c] hover:bg-[#f2f2ef] focus-visible:bg-[#f2f2ef] focus-visible:outline-none">Rename</button>
        <button type="button" role="menuitem" className="flex h-8 w-full items-center rounded-md px-2 text-left text-[14px] text-[#4f504c] hover:bg-[#f2f2ef] focus-visible:bg-[#f2f2ef] focus-visible:outline-none">Duplicate</button>
        <button type="button" role="menuitem" className="flex h-8 w-full items-center rounded-md px-2 text-left text-[14px] text-[#a5443b] hover:bg-[#f9ece9] focus-visible:bg-[#f9ece9] focus-visible:outline-none">Delete</button>
      </OverlayMenu>
    </div>
  );
}

const meta: Meta<typeof OverlayMenu> = {
  title: "Components/Overlay Menu",
  component: OverlayMenu,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof OverlayMenu>;

export const DocumentActions: Story = { render: () => <Demo /> };
export const BottomEdgeCollision: Story = { render: () => <Demo edge /> };
export const StartAligned: Story = { render: () => <Demo placement="bottom-start" /> };
