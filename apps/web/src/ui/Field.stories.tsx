import { Search } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckboxField, Field, FieldGrid, Input, SearchField, Select, Textarea, ToolbarSelect } from "./Field";

const meta = {
  title: "Components/Forms/Field",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Controls: Story = {
  render: () => (
    <div className="grid w-100 gap-4">
      <Field>
        Project name
        <Input defaultValue="Mobile research" />
      </Field>
      <Field>
        Provider
        <Select defaultValue="gemini">
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI-compatible provider</option>
        </Select>
      </Field>
      <Field>
        Known phrases
        <Textarea placeholder="One phrase per line" />
      </Field>
      <CheckboxField>
        <input type="checkbox" defaultChecked />
        Use the Project voice profile
      </CheckboxField>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="grid w-100 gap-4">
      <Field>
        Endpoint
        <Input disabled defaultValue="https://generativelanguage.googleapis.com/v1beta" />
      </Field>
      <Field>
        Transcription Skill
        <Select disabled defaultValue="system">
          <option value="system">System default</option>
        </Select>
      </Field>
    </div>
  ),
};

/** Focus draws the accent ring the whole app shares. */
export const Focused: Story = {
  render: () => (
    <Field className="w-100">
      Project name
      <Input autoFocus defaultValue="Mobile research" />
    </Field>
  ),
};

/** Two columns on desktop, one below 640px. */
export const Grid: Story = {
  render: () => (
    <FieldGrid className="w-160">
      <Field>
        Provider
        <Select defaultValue="gemini">
          <option value="gemini">Gemini</option>
        </Select>
      </Field>
      <Field>
        API key
        <Input type="password" placeholder="Stored only on this Host" />
      </Field>
      <Field span>
        Endpoint
        <Input defaultValue="https://generativelanguage.googleapis.com/v1beta" />
      </Field>
    </FieldGrid>
  ),
};

/** A toolbar select sizes to its content so it cannot crowd its neighbours. */
export const InAToolbar: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <ToolbarSelect defaultValue="logue">
        <option value="logue">Logue</option>
        <option value="none">No Project</option>
      </ToolbarSelect>
      <ToolbarSelect defaultValue="reply">
        <option value="reply">Draft reply</option>
        <option value="document">Draft document</option>
      </ToolbarSelect>
    </div>
  ),
};

export const Search_: Story = {
  name: "Search field",
  render: () => (
    <SearchField className="w-125">
      <Search size={17} aria-hidden="true" />
      <input placeholder="Find by words, project, site, or topic" aria-label="Find saved content" />
    </SearchField>
  ),
};
