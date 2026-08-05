import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExtensionSurface } from "../../v2-mock/extension/ExtensionSurface";
import { createCanonicalScenario } from "../../v2-mock/fixtures/canonicalScenario";
import { reduceMockSession } from "../../v2-mock/model/reducer";
import "../../v2-mock/styles/surfaces.css";

const meta = {
  title: "V2 Product/Extension",
  component: ExtensionSurface,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ExtensionSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanonicalRoundTrip: Story = { args: { seed: "journey-start" } };
export const SourcedCommandWithSkills: Story = { args: { seed: "canonical" } };
export const TargetLost: Story = { args: { seed: "target-lost" } };
export const UnlinkedVoiceComment: Story = {
  render: () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "select-article", tabId: "research-tab", pageId: "article-a" });
    state = reduceMockSession(state, { type: "start-voice-comment", tabId: "research-tab" });
    state = reduceMockSession(state, { type: "stop-voice-comment", transcript: "This is the evidence we should carry into the decision." });
    return <ExtensionSurface initialState={state} />;
  },
};
