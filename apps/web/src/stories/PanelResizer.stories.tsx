import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PanelResizer } from "../ui/PanelResizer";

function PanelResizerPreview({ edge = "right", initialValue = 320 }: { edge?: "left" | "right"; initialValue?: number }) {
  const [value, setValue] = useState(initialValue);
  const leftWidth = edge === "right" ? value : 720 - value;
  const rightWidth = 720 - leftWidth;
  return (
    <section className="w-[720px] overflow-hidden rounded-lg border border-[#deded9] bg-white shadow-sm">
      <div className="flex h-64">
        <div className="flex min-w-0 flex-col bg-[#f7f7f5] p-4" style={{ width: leftWidth }}>
          <span className="text-[14px] font-semibold text-[#555651]">Navigation</span>
          <span className="mt-1 text-[13px] text-[#858680]">{leftWidth}px</span>
        </div>
        <PanelResizer edge={edge} label="Resize preview panel" value={value} min={200} max={520} defaultValue={320} onChange={setValue} />
        <div className="min-w-0 flex-1 p-4" style={{ width: rightWidth }}>
          <span className="text-[14px] font-semibold text-[#555651]">Content stays available</span>
          <p className="mt-2 text-[14px] leading-6 text-[#777873]">Drag, use arrow keys, Home, End, or double-click to reset.</p>
        </div>
      </div>
      <div className="border-t border-[#eeeeeb] px-4 py-2 text-[13px] text-[#858680]">Current panel width: {value}px</div>
    </section>
  );
}

const meta = {
  title: "Components/Layout/Panel Resizer",
  component: PanelResizerPreview,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PanelResizerPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WiderPanel: Story = { args: { initialValue: 440 } };
export const LeftEdge: Story = { args: { edge: "left" } };
