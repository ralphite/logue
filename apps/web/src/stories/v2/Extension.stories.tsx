import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExtensionSurface } from "../../v2-mock/extension/ExtensionSurface";
import { createStorySeed } from "../../v2-mock/fixtures/storySeeds";
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
export const VoiceCommentRecording: Story = {
  render: () => {
    let state = createStorySeed("journey-start");
    state = reduceMockSession(state, { type: "start-voice-comment", tabId: "research-tab" });
    return <ExtensionSurface initialState={state} />;
  },
};

export const VoiceCommentInProject: Story = {
  render: () => {
    let state = createStorySeed("journey-start");
    state = reduceMockSession(state, { type: "start-voice-comment", tabId: "research-tab" });
    state = reduceMockSession(state, { type: "accept-voice-comment", transcript: "This is the evidence we should carry into the decision." });
    return <ExtensionSurface initialState={state} />;
  },
};

export const VoiceCommentSavedOnly: Story = {
  render: () => {
    let state = createStorySeed("journey-start");
    state = reduceMockSession(state, { type: "set-tab-project", tabId: "research-tab", projectId: null });
    state = reduceMockSession(state, { type: "start-voice-comment", tabId: "research-tab" });
    state = reduceMockSession(state, { type: "accept-voice-comment", transcript: "Keep this with the page even before it belongs to a project." });
    return <ExtensionSurface initialState={state} />;
  },
};
