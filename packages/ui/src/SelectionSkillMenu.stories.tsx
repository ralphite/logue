import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectionSkillMenu } from "./index";

const skills = [
  { id: "improve", name: "Improve writing" },
  { id: "shorten", name: "Shorten" },
  { id: "translate", name: "Translate to English" },
];

const meta: Meta<typeof SelectionSkillMenu> = {
  title: "Components/Selection Skill Menu",
  component: SelectionSkillMenu,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SelectionSkillMenu>;

function Demo({ options = skills }: { options?: typeof skills }) {
  return (
    <div className="min-h-72 bg-white p-14 text-[15px] leading-7 text-[#373834]">
      <p>The selected sentence stays in place while a configured Skill changes only that text.</p>
      <SelectionSkillMenu
        anchor={{ left: 56, top: 114 }}
        skills={options}
        onUseSkill={async () => undefined}
        onDismiss={() => undefined}
      />
    </div>
  );
}

export const MenuOpen: Story = { render: () => <Demo /> };

export const KeyboardFocus: Story = {
  render: () => <div className="min-h-72 bg-white p-14 text-[15px] leading-7 text-[#373834]"><p>The selected sentence stays in place while a configured Skill changes only that text.</p><SelectionSkillMenu anchor={{ left: 56, top: 114 }} skills={skills} onUseSkill={async () => undefined} onDismiss={() => undefined} focusTrigger /></div>,
};

export const NoAvailableSkill: Story = { render: () => <Demo options={[]} /> };

export const LongSkillNames: Story = {
  render: () => <Demo options={[
    { id: "rewrite", name: "Rewrite for a decisive, concise product update" },
    { id: "translate", name: "Translate to English while preserving technical terms" },
    { id: "shorten", name: "Shorten without changing factual meaning" },
  ]} />,
};
