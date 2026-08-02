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
  { id: "page", label: "ChatGPT · New chat", type: "page" as const },
  { id: "project", label: "Agent Harness", type: "project" as const, removable: true },
  { id: "glossary", label: "6 个已确认术语", type: "glossary" as const },
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
  title: "Extension/Voice Input",
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
  render: () => <VoiceStoryHarness initialPhase="error" errorKind="microphone" errorMessage="麦克风权限未开启，请在浏览器地址栏允许后重试。" />,
};
export const VoiceTargetLostAfterSave: Story = {
  render: () => <VoiceStoryHarness initialPhase="error" errorKind="target" errorMessage="资料已经保存。重新聚焦一个输入框后可再次插入，或直接复制文字。" />,
};

function AgentStoryHarness({ result = false }: { result?: boolean }) {
  const [instruction, setInstruction] = useState("基于我的相关资料，生成一段可直接使用的简洁回复（不超过 120 字）。");
  const [output, setOutput] = useState("建议先聚焦最短的核心闭环：用户说完后自动转写、保存并插入，整理工作在后台完成，只有不确定项才需要复核。");
  const [phase, setPhase] = useState<"ready" | "generating" | "result">(result ? "result" : "ready");
  return (
    <div className="w-[360px] overflow-hidden rounded-[14px] border border-[#d9dad5] bg-white shadow-[0_22px_64px_rgba(25,27,23,0.18)]">
      <AgentGenerationPanel
        agents={[
          { id: "reply", name: "简洁回复", purpose: "结合相关资料，生成可直接使用的回复" },
          { id: "qa", name: "资料问答", purpose: "基于资料回答当前问题" },
        ]}
        selectedAgentId="reply"
        instruction={instruction}
        output={output}
        phase={phase}
        contextLabel="当前页面 · Logue · 3 条相关资料"
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
  render: () => <StoryHarness initialPhase="review" selectedText="Design tool schemas around clear intent and make retries idempotent." transcript="把这段作为扩展事务设计依据。" />,
};

export const SelectionLongSourceAndFiling: Story = {
  render: () => <StoryHarness selectedText={`${"完整选区原文必须保持可读、不可变，并允许用户滚动查看。".repeat(12)}\n\n末尾校验：这句话必须仍然存在。`} selectedProjects={["Agent Harness", "Logue"]} tags={["research", "provenance"]} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "设置归入" }));
  },
};

export const SelectionTranscriptionError: Story = {
  render: () => <StoryHarness initialPhase="error" selectedText="待保存的原文" errorKind="transcription" errorMessage="没有识别到清晰语音。录音仍保留，可重试。" />,
};
export const SelectionServiceDisconnected: Story = { render: () => <StoryHarness selectedText="待保存的原文" serviceConnected={false} /> };

export const SelectionReferenceDetails: Story = {
  render: () => <StoryHarness selectedText="待保存的原文" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "查看本次参考" }));
  },
};
