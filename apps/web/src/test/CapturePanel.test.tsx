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
      selectedText="Complete source text to save"
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

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(["Cancel Esc", "Stop and insert ↵"]);
    expect(screen.queryByText(/Sources|Projects|Tags|Review transcript/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Stop and insert/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(actions.stop).toHaveBeenCalledOnce();
    expect(actions.cancel).toHaveBeenCalledOnce();
  });

  it("shows automatic progress without a second confirmation", () => {
    renderVoice({ phase: "processing" });
    expect(screen.getByText("Transcribing and inserting…")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Review transcript")).toBeNull();
  });

  it("keeps saved text recoverable when the original target disappeared", () => {
    const actions = renderVoice({ phase: "error", errorKind: "target", errorMessage: "The material was saved." });
    fireEvent.click(screen.getByRole("button", { name: "Copy text" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert again" }));
    expect(actions.copy).toHaveBeenCalledOnce();
    expect(actions.retry).toHaveBeenCalledOnce();
  });
});

function renderAgent(overrides: Partial<AgentGenerationPanelProps> = {}) {
  const actions = { generate: vi.fn(), insert: vi.fn(), close: vi.fn() };
  render(
    <AgentGenerationPanel
      agents={[{ id: "reply", name: "Concise reply", purpose: "Create a ready-to-use reply" }]}
      selectedAgentId="reply"
      instruction="Create a reply from relevant materials"
      output="Complete the core input loop first."
      phase="ready"
      contextLabel="Current page | Logue | 3 relevant materials"
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
    expect(screen.getByText("Current page | Logue | 3 relevant materials")).toBeTruthy();
    expect(screen.queryByText(/Tags|Organization|Project selection/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(actions.generate).toHaveBeenCalledOnce();
  });

  it("keeps the generated result editable and inserts without a send action", () => {
    const actions = renderAgent({ phase: "result" });
    expect(screen.getByRole("textbox", { name: "Generated result" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Insert into field" }));
    expect(actions.insert).toHaveBeenCalledOnce();
  });
});

describe("selection CapturePanel", () => {
  it("saves an unannotated selection with one explicit action", () => {
    const actions = renderSelection();
    fireEvent.click(screen.getByRole("button", { name: "Save selection" }));
    expect(actions.primary).toHaveBeenCalledOnce();
  });

  it("keeps selection voice review independent from input-box voice", () => {
    const actions = renderSelection({ phase: "review", transcript: "Transcript saved as a selection annotation" });
    fireEvent.click(screen.getByRole("button", { name: "Save source and annotation" }));
    expect(actions.useTranscript).toHaveBeenCalledOnce();
  });

  it("keeps the complete selection readable and supports multiple projects and tags", () => {
    const selectedText = `${"The complete selected source must not be truncated. ".repeat(30)}End check`;
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
    fireEvent.click(screen.getByRole("button", { name: "Set organization" }));
    fireEvent.click(screen.getByRole("button", { name: "Logue" }));
    expect(onSelectedProjectsChange).toHaveBeenCalledWith(["Agent Harness", "Logue"]);

    fireEvent.change(screen.getByRole("textbox", { name: "Add tag" }), { target: { value: "provenance" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Add tag" }), { key: "Enter" });
    expect(onTagsChange).toHaveBeenCalledWith(["research", "provenance"]);
  });

  it("disables recording and saving while the local service is unavailable", () => {
    renderSelection({ serviceConnected: false });
    expect((screen.getByRole("button", { name: "Start voice input" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Save selection" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
