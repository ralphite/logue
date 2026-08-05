import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStorySeed, type StorySeedName } from "../../v2-mock/fixtures/storySeeds";
import { MockSessionProvider } from "../../v2-mock/runtime/MockSessionProvider";
import { SidePanel, type SidePanelMode } from "../../v2-mock/side-panel/SidePanel";

function SidePanelStory({ mode = "page", seed = "canonical" }: { mode?: SidePanelMode; seed?: StorySeedName }) {
  return <MockSessionProvider initialState={createStorySeed(seed)}><SidePanel mode={mode} /></MockSessionProvider>;
}

const meta = {
  title: "V2 Product/Extension Side Panel",
  component: SidePanelStory,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "480px-900px" } },
} satisfies Meta<typeof SidePanelStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PageAndComments: Story = { args: { mode: "page" } };
export const SourcedDraft: Story = { args: { mode: "draft" } };
export const ClassificationSuggestion: Story = { args: { mode: "classification" } };
export const OfflinePending: Story = { args: { mode: "offline" } };
export const TargetLost: Story = { args: { mode: "target-lost", seed: "target-lost" } };
export const ModelNotReady: Story = { args: { mode: "model-not-ready", seed: "provider-needs-attention" } };
