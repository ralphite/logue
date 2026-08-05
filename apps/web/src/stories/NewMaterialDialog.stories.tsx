import type { Meta, StoryObj } from "@storybook/react-vite";
import { NewMaterialDialog } from "../components/NewMaterialDialog";
import { StoryApiFixture, type StoryFixtureMode } from "./storyApiFixture";

function DialogStage({ fixture = "ready" }: { fixture?: StoryFixtureMode }) {
  return <StoryApiFixture mode={fixture}><NewMaterialDialog onClose={() => undefined} onSave={async () => undefined} /></StoryApiFixture>;
}

const meta = {
  title: "Components/Materials/New Material Dialog",
  component: DialogStage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DialogStage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithProjects: Story = {};
export const WithoutProjects: Story = { args: { fixture: "empty" } };
