import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Tab, Tabs } from "./Tabs";

const meta = {
  title: "Components/Navigation/Tabs",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Strip({ items, size }: { items: string[]; size?: "sm" | "md" }) {
  const [active, setActive] = useState(items[0]);
  return (
    <Tabs label="Example" size={size} className="w-160">
      {items.map((item) => (
        <Tab key={item} size={size} active={item === active} onClick={() => setActive(item)}>
          {item}
        </Tab>
      ))}
    </Tabs>
  );
}

/** The default strip, used for a route's sub-navigation. */
export const Default: Story = {
  render: () => <Strip items={["Workspace", "Context", "History", "Voice & Skills"]} />,
};

/** The tighter strip, used inside a page for a smaller switch. */
export const Small: Story = {
  render: () => <Strip size="sm" items={["Built-in", "My Skills", "Global defaults"]} />,
};

export const TwoItems: Story = {
  render: () => <Strip items={["Saved content", "All activity"]} />,
};

/** A long label must not push the underline out of alignment. */
export const LongLabels: Story = {
  render: () => <Strip items={["Everything you captured", "Only what a Project uses", "Archived"]} />,
};
