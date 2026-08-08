import type { Meta, StoryObj } from "@storybook/react-vite";
import { OriginLabel } from "./OriginLabel";

/**
 * Where a piece of content came from. Web evidence, what you said, and what a
 * model produced stay visually distinct everywhere they appear together.
 */
const meta = {
  title: "Components/OriginLabel",
  component: OriginLabel,
  args: { origin: "web", detail: "Original evidence" },
  argTypes: { origin: { control: "inline-radio", options: ["web", "you", "ai"] } },
  parameters: { layout: "padded" },
} satisfies Meta<typeof OriginLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Web: Story = {};
export const You: Story = { args: { origin: "you", detail: "Original voice retained" } };
export const AI: Story = { args: { origin: "ai", detail: "Draft reply · complete" } };
export const WithoutDetail: Story = { args: { detail: undefined } };

export const AllThree: Story = {
  render: () => (
    <div className="grid gap-2">
      <OriginLabel origin="web" detail="Original evidence" />
      <OriginLabel origin="you" detail="Saved text" />
      <OriginLabel origin="ai" detail="Built-in · Pinned" />
    </div>
  ),
};
