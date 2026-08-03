import { CirclePlus, Trash2 } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../components/ui";

const meta = {
  title: "Components/Actions/Button",
  component: Button,
  args: { children: "Add material", size: "sm", variant: "primary" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "select", options: ["sm", "md"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "Choose" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };
export const Danger: Story = { args: { variant: "danger", children: <><Trash2 size={14} />Delete</> } };
export const WithIcon: Story = { args: { children: <><CirclePlus size={14} />Add material</> } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true, loadingLabel: "Saving" } };
export const KeyboardFocus: Story = { args: { className: "outline-2 outline-offset-2 outline-[#5b64f4]" } };
export const LongLabel: Story = { args: { variant: "secondary", children: "Use this longer action label when context alone is not enough" } };
