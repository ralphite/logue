import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { CommandSourceSnapshot, ExtensionSkill, LocalError, PageMaterial, PanelCaptureState, PanelProject } from "../../../extension/src/sidePanelModels";
import { SidePanelView } from "../../../extension/src/sidePanelView";
import "../../../extension/src/sidePanel.css";

const skills: ExtensionSkill[] = [
  {
    id: "sk_reply",
    name: "Draft reply",
    purpose: "Write a concise reply from the current page.",
    task: "generate",
    output: "insert",
    surfaces: ["extension"],
    contexts: ["page", "target"],
    enabled: true,
  },
];

const pageMaterials: PageMaterial[] = [
  { id: "mat_2", content: "This was added moments ago and appears first.", createdAt: "2026-08-03T03:30:00Z" },
  { id: "mat_1", content: "A previous note connected to this page.", annotation: "Keep the original source separate from this annotation.", createdAt: "2026-08-03T03:20:00Z" },
];

const projects: PanelProject[] = [
  { name: "Mobile research" },
  { name: "Launch narrative" },
];

const commandSources: CommandSourceSnapshot[] = [
  { id: "src_research", kind: "selection", actor: "user", content: "Field interviews consistently described offline access as the deciding factor.", projects: ["Mobile research"], tags: ["evidence"], source: { url: "https://example.com/research", title: "Field research", domain: "example.com", selection: "Offline access is the deciding factor for field teams." } },
  { id: "src_note", kind: "text", actor: "user", content: "Lead with the workflow evidence, then state the rollout constraint.", projects: ["Mobile research"], tags: ["draft"], source: { url: "https://example.com/notes", title: "Launch notes", domain: "example.com" } },
];

const currentPage: PanelCaptureState = {
  tabId: 1,
  intent: "page",
  source: { url: "https://example.com/research", title: "Research notes for a focused product decision", domain: "example.com" },
  targetAvailable: false,
  updatedAt: 1,
};

const pageSelection: PanelCaptureState = {
  ...currentPage,
  intent: "selection",
  selectionText: "Keep the selected source intact, then add a concise voice annotation as a separate note.",
};

const currentEditor: PanelCaptureState = {
  ...currentPage,
  intent: "input",
  targetAvailable: true,
  targetText: "A draft already in the editor.",
};

const generation: PanelCaptureState = {
  ...currentEditor,
  intent: "generate",
};

function SidePanelStage({
  state = currentPage,
  initialPhase = "idle",
  initialDraft = "",
  initialGeneratedText = "",
  error,
  pendingInsert = false,
  initialServerSettingsOpen = false,
  initialServerConnecting = false,
  initialServerSettingsError,
}: {
  state?: PanelCaptureState;
  initialPhase?: "idle" | "starting" | "recording" | "processing" | "error";
  initialDraft?: string;
  initialGeneratedText?: string;
  error?: LocalError;
  pendingInsert?: boolean;
  initialServerSettingsOpen?: boolean;
  initialServerConnecting?: boolean;
  initialServerSettingsError?: string;
}) {
  const [phase, setPhase] = useState(initialPhase);
  const [draft, setDraft] = useState(initialDraft);
  const [generatedText, setGeneratedText] = useState(initialGeneratedText);
  const [activeError, setActiveError] = useState(error);
  const [pending, setPending] = useState(pendingInsert);
  const [serverURLDraft, setServerURLDraft] = useState("https://logue.example.com");
  const [serverSettingsOpen, setServerSettingsOpen] = useState(initialServerSettingsOpen);
  const [generatedUndoAvailable, setGeneratedUndoAvailable] = useState(false);
  const [selectedProject, setSelectedProject] = useState(state?.projects?.[0] ?? "");
  const renderedState = state ? { ...state, projects: selectedProject ? [selectedProject] : [] } : undefined;

  return <SidePanelView
    state={renderedState}
    phase={phase}
    draft={draft}
    generatedText={generatedText}
    commandSources={generatedText ? commandSources : []}
    generatedUndoAvailable={generatedUndoAvailable}
    skills={skills}
    skillId={skills[0].id}
    projects={projects}
    pageMaterials={pageMaterials}
    error={activeError}
    elapsed={7}
    pendingInsert={pending && renderedState ? { text: "Saved text ready to insert.", materialId: "mat_saved", sourceURL: renderedState.source.url } : undefined}
    insertingPending={false}
    generating={false}
    canRetry
    serverURLDraft={serverURLDraft}
    serverCandidateURL={state?.candidateServerURL}
    serverSettingsOpen={serverSettingsOpen}
    serverConnecting={initialServerConnecting}
    serverSettingsError={initialServerSettingsError}
    onDraftChange={setDraft}
    onGeneratedTextChange={setGeneratedText}
    onCopyGenerated={() => undefined}
    onUndoGenerated={() => setGeneratedUndoAvailable(false)}
    onSkillIdChange={() => undefined}
    onProjectChange={setSelectedProject}
    onStartRecording={() => { setActiveError(undefined); setPending(false); setPhase("starting"); }}
    onStopRecording={() => setPhase("processing")}
    onCancelRecording={() => setPhase("idle")}
    onRetryTranscription={() => { setActiveError(undefined); setPhase("processing"); }}
    onSave={() => { setDraft(""); setActiveError(undefined); }}
    onRequestGeneration={() => undefined}
    onReturnToPage={() => undefined}
    onGenerate={() => setGeneratedText("A concise generated reply stays editable and is never sent automatically.")}
    onInsertGenerated={() => { setGeneratedUndoAvailable(true); setActiveError(undefined); }}
    onRetryInsert={() => setPending(false)}
    onCopyPendingInsert={() => setPending(false)}
    onServerURLDraftChange={setServerURLDraft}
    onOpenServerSettings={() => setServerSettingsOpen(true)}
    onCloseServerSettings={() => setServerSettingsOpen(false)}
    onConnectServer={() => setServerSettingsOpen(false)}
    onConnectCandidateServer={() => setActiveError(undefined)}
    onRetryServer={() => setActiveError(undefined)}
  />;
}

const meta = {
  title: "Features/Extension/Native Side Panel",
  component: SidePanelStage,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "360px-900px" } },
} satisfies Meta<typeof SidePanelStage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentPage: Story = { args: { state: currentPage, initialDraft: "A note about this page" } };
export const SelectedProject: Story = { args: { state: { ...currentPage, projects: ["Mobile research"] }, initialDraft: "A note grounded in this project" } };
export const SelectionWithHistory: Story = { args: { state: pageSelection } };
export const StartingMicrophone: Story = { args: { state: currentEditor, initialPhase: "starting" } };
export const Recording: Story = { args: { state: currentEditor, initialPhase: "recording" } };
export const Transcribing: Story = { args: { state: pageSelection, initialPhase: "processing" } };
export const TargetLost: Story = { args: { state: currentEditor, initialPhase: "error", pendingInsert: true, error: { kind: "target", message: "The original editor is no longer available. Your text is saved in Logue.", action: "copy" } } };
export const ServiceUnavailable: Story = { args: { state: currentPage, initialPhase: "error", error: { kind: "service", message: "Can’t reach Logue.", action: "change-server" } } };
export const LinuxServerAvailable: Story = { args: { state: { ...currentPage, source: { url: "https://logue.example.com/doc", title: "Logue", domain: "logue.example.com" }, candidateServerURL: "https://logue.example.com" }, initialPhase: "error", error: { kind: "service", message: "Can’t reach Logue.", action: "change-server" } } };
export const ServerSettings: Story = { args: { state: currentPage, initialServerSettingsOpen: true } };
export const ServerConnecting: Story = { args: { state: currentPage, initialServerSettingsOpen: true, initialServerConnecting: true } };
export const ServerPermissionDenied: Story = { args: { state: currentPage, initialServerSettingsOpen: true, initialServerSettingsError: "Chrome did not allow access to this server." } };
export const ServerInvalidURL: Story = { args: { state: currentPage, initialServerSettingsOpen: true, initialServerSettingsError: "Enter a complete http:// or https:// address." } };
export const ServerUnreachable: Story = { args: { state: currentPage, initialServerSettingsOpen: true, initialServerSettingsError: "Can’t reach this address." } };
export const ServerNotLogue: Story = { args: { state: currentPage, initialServerSettingsOpen: true, initialServerSettingsError: "This address is not a Logue server." } };
export const ServerIncompatible: Story = { args: { state: currentPage, initialServerSettingsOpen: true, initialServerSettingsError: "This Logue server is not compatible with this extension." } };
export const GenerateDraft: Story = { args: { state: generation, initialDraft: "Draft a concise reply that captures the decision." } };
export const GeneratedReply: Story = { args: { state: generation, initialGeneratedText: "A concise generated reply stays editable and is never sent automatically." } };
export const GeneratedTargetLost: Story = { args: { state: generation, initialGeneratedText: "A concise generated reply remains available when the editor is lost.", initialPhase: "error", error: { kind: "target", message: "The original editor is unavailable. Your draft is still saved here.", action: "copy" } } };
export const Empty: Story = { args: { state: undefined } };
