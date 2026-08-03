import type { Meta, StoryObj } from "@storybook/react-vite";
import { App } from "../App";
import { StoryApiFixture, type StoryFixtureMode } from "./storyApiFixture";

function AppComposition({ route = "?view=stream", fixture = "ready" }: { route?: string; fixture?: StoryFixtureMode }) {
  if (window.location.search !== route) window.history.replaceState(null, "", `${window.location.pathname}${route}`);
  return <StoryApiFixture mode={fixture}><div className="h-[760px] overflow-hidden border border-[#deded9] bg-white"><App key={`${route}:${fixture}`} /></div></StoryApiFixture>;
}

const meta = {
  title: "Pages/App Compositions",
  component: AppComposition,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppComposition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stream: Story = { args: { route: "?view=stream" } };
export const MaterialDetail: Story = { args: { route: "?view=stream&material=mat_voice" } };
export const Projects: Story = { args: { route: "?view=projects" } };
export const ProjectDetail: Story = { args: { route: "?view=projects&project=Research" } };
export const Documents: Story = { args: { route: "?view=documents&doc=doc_research" } };
export const Skills: Story = { args: { route: "?view=skills" } };
export const Settings: Story = { args: { route: "?view=settings" } };
export const StreamEmpty: Story = { args: { route: "?view=stream", fixture: "empty" } };
export const StreamLoading: Story = { args: { route: "?view=stream", fixture: "loading" } };
export const StreamServiceError: Story = { args: { route: "?view=stream", fixture: "error" } };
export const MaterialNeedsReview: Story = { args: { route: "?view=stream&material=mat_voice", fixture: "needs-review" } };
export const DocumentsEmpty: Story = { args: { route: "?view=documents", fixture: "empty" } };
export const DocumentsLoading: Story = { args: { route: "?view=documents", fixture: "loading" } };
export const DocumentsServiceError: Story = { args: { route: "?view=documents", fixture: "error" } };
export const SkillsEmpty: Story = { args: { route: "?view=skills", fixture: "empty" } };
