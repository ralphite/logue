import { MoreHorizontal, Trash2 } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./Button";

const meta = {
  title: "Components/Actions/Icon Button",
  component: IconButton,
  args: { label: "More actions", variant: "ghost", children: <MoreHorizontal size={16} /> },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Destructive: Story = { args: { label: "Delete", children: <Trash2 size={15} />, className: "text-[#a84d44]" } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true, loadingLabel: "Loading" } };
export const KeyboardFocus: Story = { args: { className: "outline-2 outline-offset-2 outline-[#5b64f4]" } };
