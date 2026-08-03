import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { InlineVoiceControls, type InlineVoicePhase } from "../../../extension/src/InlineVoiceControls";
import "../../../extension/src/extension.css";

function VoiceControlStage({ initialPhase = "idle", error }: { initialPhase?: InlineVoicePhase; error?: string }) {
  const [phase, setPhase] = useState<InlineVoicePhase>(initialPhase);
  const [copied, setCopied] = useState(false);

  return (
    <div className="logue-voice-control-story">
      <style>{`
        .logue-voice-control-story { width: min(680px, calc(100vw - 32px)); color: #242522; }
        .logue-voice-control-story .voice-field { min-height: 132px; width: 100%; resize: vertical; border: 1px solid #e4e5df; border-radius: 16px; outline: 0; background: #fff; padding: 18px 20px; color: #242522; font: 400 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; }
        .logue-voice-control-story .voice-field:focus { border-color: #c8cbff; box-shadow: 0 0 0 3px rgba(91, 100, 244, 0.10); }
        .logue-voice-control-story .voice-stage { position: relative; }
        .logue-voice-control-story .logue-launcher-group { position: absolute; right: 10px; bottom: 10px; left: auto; top: auto; }
      `}</style>
      <div className="voice-stage">
        <textarea className="voice-field" aria-label="Message" placeholder="Write a reply…" />
        <InlineVoiceControls
          phase={phase}
          onStart={() => setPhase("starting")}
          onCancel={() => setPhase("idle")}
          onStopAndInsert={() => setPhase("processing")}
          error={error}
          pendingCopyText={error ? "Saved transcription" : undefined}
          onCopy={() => {
            void navigator.clipboard?.writeText("Saved transcription").catch(() => undefined);
            setCopied(true);
          }}
        />
      </div>
      {copied && <p className="mt-3 text-[14px] text-[#5a7b5f]" role="status">Copied</p>}
    </div>
  );
}

const meta = {
  title: "Features/Extension/Inline Voice Controls",
  component: VoiceControlStage,
  parameters: { layout: "centered" },
} satisfies Meta<typeof VoiceControlStage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = { render: () => <VoiceControlStage /> };
export const StartingMicrophone: Story = { render: () => <VoiceControlStage initialPhase="starting" /> };
export const Recording: Story = { render: () => <VoiceControlStage initialPhase="recording" /> };
export const Processing: Story = { render: () => <VoiceControlStage initialPhase="processing" /> };
export const TargetLost: Story = { render: () => <VoiceControlStage initialPhase="error" error="Saved, but the original input is no longer available." /> };
