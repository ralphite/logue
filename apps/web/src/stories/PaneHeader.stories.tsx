import { MoreHorizontal, X } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton, PaneHeader } from "../components/ui";

function PaneHeaderFrame({ title = "Sources", withActions = false }: { title?: string; withActions?: boolean }) {
  return (
    <main className="w-[360px] bg-white">
      <PaneHeader
        title={title}
        actions={withActions ? <><IconButton label="More actions" variant="ghost"><MoreHorizontal size={16} /></IconButton><IconButton label="Close" variant="ghost"><X size={16} /></IconButton></> : undefined}
      />
      <div className="h-24 px-4 py-5 text-[14px] text-[#999a95]">Panel content</div>
    </main>
  );
}

const meta = { title: "Components/Headers/Pane Header", component: PaneHeader } satisfies Meta<typeof PaneHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <PaneHeaderFrame /> };
export const WithActions: Story = { render: () => <PaneHeaderFrame withActions /> };
export const LongTitle: Story = { render: () => <PaneHeaderFrame title="A very long panel title that must remain quiet and truncated" withActions /> };
