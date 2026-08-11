import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectionBar, type SelectionPhase } from "./SelectionBar";
import { VoiceBar, type Phase } from "./VoiceBar";
import { ProfilePicker } from "./ProfilePicker";
import type { Context, Skill } from "../api";

/**
 * Feature · What Logue puts on somebody else's page.
 *
 * These float over pages we do not own, at 360 pixels of somebody else's
 * layout, and every state of them used to be reachable only by producing that
 * state for real — a failing model, a blocked microphone, a recording that
 * heard nothing.
 */

const CONTEXT: Context = {
  voice_profile: { label: "Logue QA", project_name: "Logue QA", primary_language: "" },
  projects: [
    { id: "p1", name: "Logue QA" },
    { id: "p2", name: "Reading" },
  ],
  vocabularies: [{ id: "v1", name: "产品术语" }],
  skills: [],
};

const SKILLS: Skill[] = [
  { id: "s1", name: "Simplify", output: "insert", contexts: ["selection"], enabled: true },
  { id: "s2", name: "中文翻译", output: "insert", contexts: ["selection"], enabled: true },
  { id: "s3", name: "Draft reply", output: "insert", contexts: ["selection"], enabled: true },
];

const nothing = () => undefined;

/** A page underneath, because these are judged against text, never against white. */
function OnAPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[640px] rounded-lg bg-white p-5 text-[13px] leading-[1.7] text-ink-soft shadow-[0_1px_0_rgb(0_0_0/6%)]">
      <p>
        Speech recognition is an interdisciplinary subfield of computer science and computational
        linguistics that develops methodologies and technologies enabling the recognition and
        translation of spoken language into text.
      </p>
      <div className="mt-4 flex justify-center">{children}</div>
    </div>
  );
}

const meta = { title: "Feature/On the page", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const TheCaretBar: Story = {
  render: () => (
    <div className="grid gap-4">
      {(["idle", "starting", "recording", "working"] as Phase[]).map((phase) => (
        <div key={phase} className="grid gap-1">
          <span className="text-xs text-muted">{phase}</span>
          <OnAPage>
            <VoiceBar
              phase={phase}
              context={CONTEXT}
              seconds={phase === "recording" ? 14 : 0}
              overrides={{}}
              onOverrides={nothing}
              onStart={nothing}
              onCommand={nothing}
              onStop={nothing}
              onCancel={nothing}
            />
          </OnAPage>
        </div>
      ))}
    </div>
  ),
};

/** Past a minute a recording must not run silently: it says where it stops. */
export const ALongRecording: Story = {
  render: () => (
    <OnAPage>
      <VoiceBar
        phase="recording"
        context={CONTEXT}
        seconds={138}
        long
        overrides={{}}
        onOverrides={nothing}
        onStart={nothing}
        onCommand={nothing}
        onStop={nothing}
        onCancel={nothing}
      />
    </OnAPage>
  ),
};

/** The audio outlived the failure, and the way back to it is on the bar. */
export const AFailureWithAWayBack: Story = {
  render: () => (
    <OnAPage>
      <VoiceBar
        phase="idle"
        context={CONTEXT}
        error="Logue did not hear anything. The recording was kept — you can try again."
        keptCapture="cap_1"
        onRetry={nothing}
        overrides={{}}
        onOverrides={nothing}
        onStart={nothing}
        onCommand={nothing}
        onStop={nothing}
        onCancel={nothing}
      />
    </OnAPage>
  ),
};

/** Words landed, and can still be taken back. Nothing else on the bar. */
export const JustInserted: Story = {
  render: () => (
    <OnAPage>
      <VoiceBar
        phase="idle"
        context={CONTEXT}
        inserted
        onUndo={nothing}
        overrides={{}}
        onOverrides={nothing}
        onStart={nothing}
        onCommand={nothing}
        onStop={nothing}
        onCancel={nothing}
      />
    </OnAPage>
  ),
};

/** Recordings still settling while the microphone is already free again. */
export const StillTranscribing: Story = {
  render: () => (
    <OnAPage>
      <VoiceBar
        phase="idle"
        context={CONTEXT}
        pending={3}
        overrides={{}}
        onOverrides={nothing}
        onStart={nothing}
        onCommand={nothing}
        onStop={nothing}
        onCancel={nothing}
      />
    </OnAPage>
  ),
};

export const TheSelectionBar: Story = {
  render: () => (
    <div className="grid gap-4">
      {(["idle", "recording", "saving", "saved"] as SelectionPhase[]).map((phase) => (
        <div key={phase} className="grid gap-1">
          <span className="text-xs text-muted">{phase}</span>
          <OnAPage>
            <SelectionBar
              phase={phase}
              skills={SKILLS}
              writing={false}
              note=""
              onNote={nothing}
              onOpenNote={nothing}
              onSaveNote={nothing}
              onSave={nothing}
              onVoice={nothing}
              onAccept={nothing}
              onCancel={nothing}
              onSkill={nothing}
            />
          </OnAPage>
        </div>
      ))}
    </div>
  ),
};

/** Writing a note about the passage, in the bar that sits on it. */
export const WritingANote: Story = {
  render: () => (
    <OnAPage>
      <SelectionBar
        phase="idle"
        skills={SKILLS}
        writing
        note="This is the paragraph the whole argument rests on."
        onNote={nothing}
        onOpenNote={nothing}
        onSaveNote={nothing}
        onSave={nothing}
        onVoice={nothing}
        onAccept={nothing}
        onCancel={nothing}
        onSkill={nothing}
      />
    </OnAPage>
  ),
};

/** What the next recording will assume — three rows, one vocabulary. */
export const VoiceOptions: Story = {
  render: () => (
    <div className="logue-float w-[280px] p-2.5">
      <ProfilePicker context={CONTEXT} overrides={{}} onChange={nothing} />
    </div>
  ),
};
