import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { NavRail, type Section } from "../components/NavRail";

function NavigationPreview({ initialSection = "stream", initiallyCollapsed = false, connected = true }: { initialSection?: Section; initiallyCollapsed?: boolean; connected?: boolean }) {
  const [active, setActive] = useState<Section>(initialSection);
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [width, setWidth] = useState(252);
  return (
    <div className="flex h-[520px] overflow-hidden rounded-lg border border-[#deded9] bg-white shadow-sm">
      <NavRail active={active} onChange={setActive} connected={connected} collapsed={collapsed} onCollapsedChange={setCollapsed} width={width} onWidthChange={setWidth} />
      <main className="min-w-0 flex-1 p-8"><p className="text-[20px] font-semibold tracking-[-0.035em] text-[#20211e]">{active[0].toUpperCase() + active.slice(1)}</p><p className="mt-2 text-[14px] text-[#858680]">Use the exact navigation component, its compact tooltips, and its keyboard-operable resizer.</p></main>
    </div>
  );
}

const meta = {
  title: "Features/Navigation/Primary Navigation",
  component: NavigationPreview,
  parameters: { layout: "centered" },
} satisfies Meta<typeof NavigationPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};
export const CollapsedWithTooltips: Story = { args: { initiallyCollapsed: true, initialSection: "documents" } };
export const ServiceDisconnected: Story = { args: { connected: false, initialSection: "projects" } };
