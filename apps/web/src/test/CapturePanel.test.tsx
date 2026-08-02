import { fireEvent, render, screen } from "@testing-library/react";
import { AgentGenerationPanel, CapturePanel, VoiceInputPanel, type AgentGenerationPanelProps, type CapturePanelProps, type VoiceInputPanelProps } from "@logue/ui";
import { describe, expect, it, vi } from "vitest";

function renderSelection(overrides: Partial<CapturePanelProps> = {}) {
  const actions = {
    primary: vi.fn(),
    useTranscript: vi.fn(),
  };
  render(
    <CapturePanel
      phase="idle"
      contexts={[]}
      selectedText="待保存的完整原文"
      draft=""
      onDraftChange={() => undefined}
      onClose={() => undefined}
      onStartRecording={() => undefined}
      onStopRecording={() => undefined}
      onCancelRecording={() => undefined}
      onUseTranscript={actions.useTranscript}
      onRetry={() => undefined}
      onDeleteRecording={() => undefined}
      onPrimary={actions.primary}
      {...overrides}
    />,
  );
  return actions;
}

function renderVoice(overrides: Partial<VoiceInputPanelProps> = {}) {
  const actions = {
    stop: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    copy: vi.fn(),
  };
  render(
    <VoiceInputPanel
      phase="recording"
      elapsedSeconds={18}
      onStopAndInsert={actions.stop}
      onCancel={actions.cancel}
      onRetry={actions.retry}
      onCopy={actions.copy}
      {...overrides}
    />,
  );
  return actions;
}

describe("VoiceInputPanel", () => {
  it("keeps exactly two actions while recording", () => {
    const actions = renderVoice();
    const buttons = screen.getAllByRole("button");

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(["取消 Esc", "停止并插入 ↵"]);
    expect(screen.queryByText(/参考|项目|标签|检查转写/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /停止并插入/ }));
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(actions.stop).toHaveBeenCalledOnce();
    expect(actions.cancel).toHaveBeenCalledOnce();
  });

  it("shows automatic progress without a second confirmation", () => {
    renderVoice({ phase: "processing" });
    expect(screen.getByText("正在转写并插入…")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("检查转写")).toBeNull();
  });

  it("keeps saved text recoverable when the original target disappeared", () => {
    const actions = renderVoice({ phase: "error", errorKind: "target", errorMessage: "资料已经保存。" });
    fireEvent.click(screen.getByRole("button", { name: "复制文字" }));
    fireEvent.click(screen.getByRole("button", { name: "重新插入" }));
    expect(actions.copy).toHaveBeenCalledOnce();
    expect(actions.retry).toHaveBeenCalledOnce();
  });
});

function renderAgent(overrides: Partial<AgentGenerationPanelProps> = {}) {
  const actions = { generate: vi.fn(), insert: vi.fn(), close: vi.fn() };
  render(
    <AgentGenerationPanel
      agents={[{ id: "reply", name: "简洁回复", purpose: "生成可直接使用的回复" }]}
      selectedAgentId="reply"
      instruction="根据相关资料生成回复"
      output="建议先完成核心输入闭环。"
      phase="ready"
      contextLabel="当前页面 · Logue · 3 条相关资料"
      onAgentChange={() => undefined}
      onInstructionChange={() => undefined}
      onOutputChange={() => undefined}
      onGenerate={actions.generate}
      onInsert={actions.insert}
      onCopy={() => undefined}
      onRetry={() => undefined}
      onClose={actions.close}
      {...overrides}
    />,
  );
  return actions;
}

describe("AgentGenerationPanel", () => {
  it("generates from automatic context without filing controls", () => {
    const actions = renderAgent();
    expect(screen.getByText("当前页面 · Logue · 3 条相关资料")).toBeTruthy();
    expect(screen.queryByText(/标签|归入|项目选择/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "生成" }));
    expect(actions.generate).toHaveBeenCalledOnce();
  });

  it("keeps the generated result editable and inserts without a send action", () => {
    const actions = renderAgent({ phase: "result" });
    expect(screen.getByRole("textbox", { name: "生成结果" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /发送/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "插入输入框" }));
    expect(actions.insert).toHaveBeenCalledOnce();
  });
});

describe("selection CapturePanel", () => {
  it("saves an unannotated selection with one explicit action", () => {
    const actions = renderSelection();
    fireEvent.click(screen.getByRole("button", { name: "保存选区" }));
    expect(actions.primary).toHaveBeenCalledOnce();
  });

  it("keeps selection voice review independent from input-box voice", () => {
    const actions = renderSelection({ phase: "review", transcript: "作为选区批注的转写" });
    fireEvent.click(screen.getByRole("button", { name: "保存原文与批注" }));
    expect(actions.useTranscript).toHaveBeenCalledOnce();
  });

  it("keeps the complete selection readable and supports multiple projects and tags", () => {
    const selectedText = `${"完整选区原文不能被截断。".repeat(30)}末尾校验`;
    const onSelectedProjectsChange = vi.fn();
    const onTagsChange = vi.fn();
    renderSelection({
      selectedText,
      projectOptions: [
        { value: "Agent Harness", label: "Agent Harness" },
        { value: "Logue", label: "Logue" },
      ],
      selectedProjects: ["Agent Harness"],
      tags: ["research"],
      onSelectedProjectsChange,
      onTagsChange,
    });

    expect(screen.getByText(selectedText)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "设置归入" }));
    fireEvent.click(screen.getByRole("button", { name: "Logue" }));
    expect(onSelectedProjectsChange).toHaveBeenCalledWith(["Agent Harness", "Logue"]);

    fireEvent.change(screen.getByRole("textbox", { name: "添加标签" }), { target: { value: "provenance" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "添加标签" }), { key: "Enter" });
    expect(onTagsChange).toHaveBeenCalledWith(["research", "provenance"]);
  });

  it("disables recording and saving while the local service is unavailable", () => {
    renderSelection({ serviceConnected: false });
    expect((screen.getByRole("button", { name: "开始语音" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "保存选区" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
