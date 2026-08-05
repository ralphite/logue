import type { Material } from "@logue/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { MaterialGroupAddList, MaterialGroupPicker } from "../components/MaterialGroupPicker";

const materials: Material[] = [
  { id: "mat_decision_a", kind: "voice", status: "organized", content: "Keep the original source attached to every decision.", projects: ["Research"], tags: ["source"], createdAt: "2026-08-03T03:00:00Z" },
  { id: "mat_decision_b", kind: "voice", status: "organized", content: "Keep the original source attached to every decision.", projects: ["Research"], tags: ["source"], createdAt: "2026-08-03T03:01:00Z" },
  { id: "mat_note", kind: "text", status: "unfiled", content: "Write the next step before changing the document.", projects: [], tags: [], createdAt: "2026-08-03T03:02:00Z" },
];

function PickerStage({ reasons = false }: { reasons?: boolean }) {
  const [selectedIds, setSelectedIds] = useState(["mat_decision_a"]);
  return <MaterialGroupPicker
    materials={materials}
    selectedIds={selectedIds}
    onChange={setSelectedIds}
    getSearchReason={reasons ? () => "Related to the current knowledge request." : undefined}
  />;
}

const meta = {
  title: "Components/Materials/Material Group Picker",
  component: PickerStage,
  decorators: [(Story) => <div className="w-[560px] rounded-lg border border-[#eeeeeb] bg-white p-3"><Story /></div>],
} satisfies Meta<typeof PickerStage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedAndSelected: Story = { render: () => <PickerStage /> };
export const SearchReasons: Story = { render: () => <PickerStage reasons /> };
export const Empty: Story = { render: () => <MaterialGroupPicker materials={[]} selectedIds={[]} onChange={() => undefined} /> };
export const AddList: Story = { render: () => <MaterialGroupAddList materials={materials} onAdd={() => undefined} /> };
