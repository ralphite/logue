import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox, Field, Input, Select, Textarea } from "./Field";

const meta = { title: "Controls/Field", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Labels left, controls right. A group reads as a table, and every choice is
 * the same native `select` — the old picker mixed a datalist in here, which is
 * why one "dropdown" behaved unlike its neighbour.
 */
export const VoiceProfile: Story = {
  render: () => (
    <div className="grid w-[300px] gap-1.5">
      <Field label="Profile">
        <Select defaultValue="">
          <option value="">Default</option>
          <option>Mobile research</option>
          <option>Logue</option>
        </Select>
      </Field>
      <Field label="Language">
        <Select defaultValue="">
          <option value="">Auto</option>
          <option>English</option>
          <option>中文</option>
          <option>日本語</option>
        </Select>
      </Field>
      <Field label="Vocabulary">
        <Select defaultValue="">
          <option value="">None</option>
          <option>Product terms</option>
        </Select>
      </Field>
      <Checkbox label="Use Project profile" defaultChecked />
    </div>
  ),
};

export const Controls: Story = {
  render: () => (
    <div className="grid w-[300px] gap-1.5">
      <Input placeholder="Project name" />
      <Select defaultValue="page">
        <option value="selection">Selection</option>
        <option value="page">Page</option>
        <option value="project">Project</option>
      </Select>
      <Textarea placeholder="What should Logue do?" />
      <Input value="Read only" readOnly disabled />
    </div>
  ),
};

/** An explicit width wins over the default full-width. */
export const ExplicitWidth: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <Input className="w-24" placeholder="w-24" />
      <Select className="w-32">
        <option>w-32</option>
      </Select>
    </div>
  ),
};
