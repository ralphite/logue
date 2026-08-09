import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Resizer } from "./Resizer";

const meta = { title: "Shell/Resizer", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function TwoPanels() {
  const [width, setWidth] = useState(208);
  return (
    <div className="flex h-64 overflow-hidden rounded-lg border border-line">
      <div style={{ width }} className="shrink-0 bg-nav p-2 text-xs text-muted">
        {width}px
      </div>
      <Resizer
        label="Resize the sidebar"
        value={width}
        min={180}
        max={320}
        defaultValue={208}
        onChange={setWidth}
      />
      <div className="flex-1 p-2 text-xs text-muted">Drag the hairline. Double-click resets it.</div>
    </div>
  );
}

/**
 * One pixel wide, because a visible gutter would be furniture on every screen.
 * The grab area is wider than the line, and the arrow keys move it too.
 */
export const BetweenPanels: Story = { render: () => <TwoPanels /> };
