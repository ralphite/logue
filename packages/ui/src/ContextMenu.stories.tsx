import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ContextMenu, MenuHeading, MenuSeparator } from "./ContextMenu";
import { MenuItem } from "./Menu";

/**
 * Component · ContextMenu.
 *
 * The right-click menu: opens where the pointer is, closes on anything that
 * is not it. In the product it carries a page's own Skills.
 */
const meta = { title: "Component/ContextMenu", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: function Open() {
    const [at, setAt] = useState<{ x: number; y: number } | undefined>({ x: 80, y: 40 });
    return (
      <div
        className="relative h-[320px] w-[520px] rounded-lg border border-line bg-surface p-4 text-[13px] text-ink-soft"
        onContextMenu={(event) => {
          event.preventDefault();
          setAt({ x: event.clientX, y: event.clientY });
        }}
      >
        Right-click anywhere in this box to move the menu there.
        <ContextMenu at={at} onClose={() => setAt(undefined)} label="Logue">
          <MenuHeading>On this page</MenuHeading>
          <MenuItem onClick={() => setAt(undefined)}>Save this page</MenuItem>
          <MenuItem onClick={() => setAt(undefined)}>What is this page?</MenuItem>
          <MenuSeparator />
          <MenuHeading>Skills</MenuHeading>
          <MenuItem onClick={() => setAt(undefined)}>Simplify</MenuItem>
          <MenuItem onClick={() => setAt(undefined)}>中文翻译</MenuItem>
        </ContextMenu>
      </div>
    );
  },
};
