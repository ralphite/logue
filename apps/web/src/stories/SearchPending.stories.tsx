import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchPending } from "../components/SearchPending";

const meta = {
  title: "Components/Feedback/Search Pending",
  component: SearchPending,
  args: { label: "materials" },
  decorators: [(Story) => <div className="w-[560px] rounded-lg border border-[#eeeeeb] bg-white"><Story /></div>],
} satisfies Meta<typeof SearchPending>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Materials: Story = {};
export const Documents: Story = { args: { label: "documents" } };
