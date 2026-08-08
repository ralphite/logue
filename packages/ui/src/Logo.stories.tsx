import type { Meta, StoryObj } from "@storybook/react-vite";
import { LogueLogo, LogueMark } from "./Logo";

const meta = { title: "Shell/Logo", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The one place the product says its own name. */
export const InTheRail: Story = {
  render: () => (
    <div className="w-52 rounded-lg bg-nav p-1.5">
      <div className="flex h-control items-center pl-1.5">
        <LogueLogo />
      </div>
    </div>
  ),
};

/** Narrowed to icons, the mark is all that is left — and the way back. */
export const Collapsed: Story = {
  render: () => (
    <div className="w-12 rounded-lg bg-nav p-1.5">
      <div className="flex h-control items-center justify-center">
        <LogueMark />
      </div>
    </div>
  ),
};
