import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectionActions } from "../../v2-mock/extension/SelectionActions";

const meta = {
  title: "V2 Product/Extension Actions",
  component: SelectionActions,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SelectionActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaticPageSelection: Story = { args: { scope: "selection" } };
export const EditableSelectionReplaceAndUndo: Story = { args: { scope: "editable-selection" } };
export const WholePageSummary: Story = { args: { scope: "page" } };
