import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AgentGenerationPanel,
  CapturePanel,
  VoiceInputPanel,
  type CapturePanelProps,
  type CapturePhase,
  type VoiceInputErrorKind,
  type VoiceInputPhase,
} from "@logue/ui";
import { useState } from "react";
import { userEvent, within } from "storybook/test";

const contexts = [
  { id: "page", label: "ChatGPT | New chat", type: "page" as const },
  { id: "project", label: "Agent Harness", type: "project" as const, removable: true },
  { id: "glossary", label: "6 confirmed terms", type: "glossary" as const },
];

function StoryHarness(props: Partial<CapturePanelProps> & { initialPhase?: CapturePhase }) {
  const [draft, setDraft] = useState(props.draft ?? "");
  const [transcript, setTranscript] = useState(props.transcript ?? "");
  const [phase, setPhase] = useState<CapturePhase>(props.initialPhase ?? "idle");
  const [project, setProject] = useState(props.selectedProject ?? "Agent Harness");
  const [selectedProjects, setSelectedProjects] = useState(props.selectedProjects ?? []);
  const [tags, setTags] = useState(props.tags ?? []);
  return (
    <div className="w-[360px] overflow-hidden rounded-[14px] border border-[#d9dad5] bg-white shadow-[0_22px_64px_rgba(25,27,23,0.18)]">
      <CapturePanel
        phase={phase}
        contexts={props.contexts ?? contexts}
        selectedText={props.selectedText}
        draft={draft}
        transcript={transcript}
        elapsedSeconds={18}
        errorMessage={props.errorMessage}
        errorKind={props.errorKind}
        serviceConnected={props.serviceConnected ?? true}
        committing={props.committing}
        projectOptions={[{ value: "Agent Harness", label: "Agent Harness" }, { value: "Logue", label: "Logue" }]}
        selectedProject={project}
        selectedProjects={selectedProjects}
        tags={tags}
        onProjectChange={setProject}
        onSelectedProjectsChange={setSelectedProjects}
        onTagsChange={setTags}
        onDraftChange={setDraft}
        onTranscriptChange={setTranscript}
        onClose={() => undefined}
        onStartRecording={() => setPhase("recording")}
        onStopRecording={() => setPhase("processing")}
        onCancelRecording={() => setPhase("idle")}
        onUseTranscript={() => setPhase("idle")}
        onRetry={() => setPhase(props.errorKind === "microphone" ? "recording" : "processing")}
        onDeleteRecording={() => setPhase("idle")}
        onPrimary={() => undefined}
      />
    </div>
  );
}

const meta: Meta = {
  id: "extension-voice-input",
  title: "Features/Extension/Voice Input",
  component: VoiceInputPanel,
  parameters: {
    layout: "centered",
    backgrounds: { default: "page", values: [{ name: "page", value: "#f5f5f2" }] },
  },
};

export default meta;
type Story = StoryObj;

function VoiceStoryHarness({
  initialPhase = "recording",
  errorKind,
  errorMessage,
}: {
  initialPhase?: VoiceInputPhase;
  errorKind?: VoiceInputErrorKind;
  errorMessage?: string;
}) {
  const [phase, setPhase] = useState<VoiceInputPhase>(initialPhase);
  return (
    <div className="w-[320px] overflow-hidden rounded-[14px] border border-[#d9dad5] bg-white shadow-[0_22px_64px_rgba(25,27,23,0.18)]">
      <VoiceInputPanel
        phase={phase}
        elapsedSeconds={18}
        errorKind={errorKind}
        errorMessage={errorMessage}
        onStopAndInsert={() => setPhase("processing")}
        onCancel={() => undefined}
        onRetry={() => setPhase(errorKind === "microphone" ? "starting" : "processing")}
        onCopy={() => undefined}
      />
    </div>
  );
}

export const VoiceStarting: Story = { render: () => <VoiceStoryHarness initialPhase="starting" /> };
export const VoiceRecording: Story = { render: () => <VoiceStoryHarness /> };
export const VoiceProcessing: Story = { render: () => <VoiceStoryHarness initialPhase="processing" /> };
export const VoiceMicrophoneError: Story = {
  render: () => <VoiceStoryHarness initialPhase="error" errorKind="microphone" errorMessage="Microphone access is blocked. Allow it in the address bar and try again." />,
};
export const VoiceTargetLostAfterSave: Story = {
  render: () => <VoiceStoryHarness initialPhase="error" errorKind="target" errorMessage="The material was saved. Focus another input to insert again, or copy the text." />,
};

function AgentStoryHarness({ result = false }: { result?: boolean }) {
  const [instruction, setInstruction] = useState("Use my relevant materials to draft a concise reply in under 120 words.");
  const [output, setOutput] = useState("Focus on the shortest core loop first: transcribe, save, and insert automatically after the user finishes. Organize in the background and review only uncertain items.");
  const [phase, setPhase] = useState<"ready" | "generating" | "result">(result ? "result" : "ready");
  return (
    <div className="w-[360px] overflow-hidden rounded-[14px] border border-[#d9dad5] bg-white shadow-[0_22px_64px_rgba(25,27,23,0.18)]">
      <AgentGenerationPanel
        agents={[
          { id: "reply", name: "Concise reply", purpose: "Create a ready-to-use reply from relevant materials" },
          { id: "qa", name: "Material Q&A", purpose: "Answer the current question from materials" },
        ]}
        selectedAgentId="reply"
        instruction={instruction}
        output={output}
        phase={phase}
        contextLabel="Current page | Logue | 3 relevant materials"
        onAgentChange={() => undefined}
        onInstructionChange={setInstruction}
        onOutputChange={setOutput}
        onGenerate={() => {
          setPhase("generating");
          window.setTimeout(() => setPhase("result"), 600);
        }}
        onInsert={() => undefined}
        onCopy={() => undefined}
        onRetry={() => setPhase("generating")}
        onClose={() => undefined}
      />
    </div>
  );
}

export const AgentGenerate: Story = { render: () => <AgentStoryHarness /> };
export const AgentResult: Story = { render: () => <AgentStoryHarness result /> };

export const SelectionSaveOnly: Story = {
  render: () => <StoryHarness selectedText="Design tool schemas around clear intent and make retries idempotent." />,
};
export const SelectionRecording: Story = {
  render: () => <StoryHarness initialPhase="recording" selectedText="Design tool schemas around clear intent and make retries idempotent." />,
};
export const SelectionReview: Story = {
  render: () => <StoryHarness initialPhase="review" selectedText="Design tool schemas around clear intent and make retries idempotent." transcript="Use this as a reference for Extension transaction design." />,
};

export const SelectionLongSourceAndFiling: Story = {
  render: () => <StoryHarness selectedText={`${"The complete selected source must stay readable, immutable, and scrollable. ".repeat(12)}\n\nEnd check: this sentence must still be present.`} selectedProjects={["Agent Harness", "Logue"]} tags={["research", "provenance"]} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Set organization" }));
  },
};

export const SelectionTranscriptionError: Story = {
  render: () => <StoryHarness initialPhase="error" selectedText="Source text to save" errorKind="transcription" errorMessage="No clear speech was detected. The recording is preserved so you can retry." />,
};
export const SelectionServiceDisconnected: Story = { render: () => <StoryHarness selectedText="Source text to save" serviceConnected={false} /> };

export const SelectionReferenceDetails: Story = {
  render: () => <StoryHarness selectedText="Source text to save" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "View sources used" }));
  },
};
