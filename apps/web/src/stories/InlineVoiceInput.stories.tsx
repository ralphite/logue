import type { Meta, StoryObj } from "@storybook/react-vite";
import { AudioLines, Check, LoaderCircle, Square, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import "../../../extension/src/extension.css";

type VoicePhase = "idle" | "starting" | "recording" | "processing" | "error";

const insertedText = "I’d like to turn this into a concise plan for the next release.";

function controlClass(phase: VoicePhase) {
  return `logue-launcher-group is-${phase}${phase === "starting" || phase === "recording" || phase === "processing" ? " is-capturing" : ""}`;
}

function InlineVoiceWorkflow({
  initialPhase = "idle",
  initialValue = "",
  narrow = false,
  multiline = true,
}: {
  initialPhase?: VoicePhase;
  initialValue?: string;
  narrow?: boolean;
  multiline?: boolean;
}) {
  const [phase, setPhase] = useState<VoicePhase>(initialPhase);
  const [focused, setFocused] = useState(initialPhase !== "idle");
  const [value, setValue] = useState(initialValue);
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const completionTimer = useRef<number | undefined>(undefined);

  const cancel = () => {
    window.clearTimeout(completionTimer.current);
    setPhase("idle");
    fieldRef.current?.focus();
  };

  const start = () => {
    setPhase("starting");
    completionTimer.current = window.setTimeout(() => setPhase("recording"), 440);
  };

  const accept = () => {
    setPhase("processing");
    completionTimer.current = window.setTimeout(() => {
      setValue((current) => `${current}${current ? " " : ""}${insertedText}`);
      setPhase("idle");
      fieldRef.current?.focus();
    }, 860);
  };

  useEffect(() => () => window.clearTimeout(completionTimer.current), []);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.key === "Escape" && phase !== "idle") {
      event.preventDefault();
      cancel();
    }
    if (event.key === "Enter" && phase === "recording") {
      event.preventDefault();
      accept();
    }
  };

  const controlsVisible = focused || phase !== "idle";
  const showError = phase === "error";
  const bottomPadding = phase === "recording" ? "3.9rem" : "3.15rem";
  const setTextareaRef = (node: HTMLTextAreaElement | null) => { fieldRef.current = node; };
  const setInputRef = (node: HTMLInputElement | null) => { fieldRef.current = node; };
  const inputProps = {
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(event.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onKeyDown,
    placeholder: "Write a reply…",
    "aria-label": "Message",
    style: { paddingBottom: multiline ? bottomPadding : undefined },
  };

  return (
    <section className={`logue-inline-voice-story ${narrow ? "is-narrow" : ""}`}>
      <style>{`
        .logue-inline-voice-story { width: min(720px, calc(100vw - 32px)); color: #242522; }
        .logue-inline-voice-story.is-narrow { width: min(320px, calc(100vw - 32px)); }
        .logue-inline-voice-story .voice-stage { position: relative; border: 1px solid #e4e5df; border-radius: 16px; background: #fff; box-shadow: 0 14px 42px rgba(25, 27, 23, 0.07); }
        .logue-inline-voice-story .voice-stage:focus-within { border-color: #c8cbff; box-shadow: 0 0 0 3px rgba(91, 100, 244, 0.10), 0 14px 42px rgba(25, 27, 23, 0.07); }
        .logue-inline-voice-story .voice-field { display: block; min-height: 148px; width: 100%; resize: vertical; border: 0; border-radius: inherit; outline: 0; background: transparent; color: #242522; font: 400 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; padding: 18px 20px; }
        .logue-inline-voice-story .voice-input { min-height: 0; height: 56px; resize: none; }
        .logue-inline-voice-story .voice-field::placeholder { color: #a0a19b; }
        .logue-inline-voice-story .logue-launcher-group { position: absolute; right: 10px; bottom: 10px; left: auto; top: auto; z-index: 1; }
        .logue-inline-voice-story .logue-launcher-group.is-recording { width: 126px; }
        .logue-inline-voice-story .logue-launcher-group.is-starting, .logue-inline-voice-story .logue-launcher-group.is-processing, .logue-inline-voice-story .logue-launcher-group.is-error { width: 86px; }
        .logue-inline-voice-story .logue-launcher-error { right: 0; bottom: calc(100% + 8px); }
      `}</style>
      <div className="voice-stage">
        {multiline ? <textarea ref={setTextareaRef} className="voice-field" {...inputProps} /> : <input ref={setInputRef} className="voice-field voice-input" {...inputProps} />}
        {controlsVisible && <div className={controlClass(phase)} role="group" aria-label="Logue voice input">
          {phase === "recording" && <>
            <button type="button" className="logue-launcher logue-inline-cancel" aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={cancel}><X size={17} /></button>
            <span className="logue-inline-live" role="status" aria-label="Recording"><Square size={13} fill="currentColor" /></span>
            <button type="button" className="logue-launcher logue-inline-accept" aria-label="Stop and insert voice input" aria-keyshortcuts="Enter" title="Stop and insert (Enter)" onPointerDown={(event) => event.preventDefault()} onClick={accept}><Check size={18} strokeWidth={2.3} /></button>
          </>}
          {(phase === "starting" || phase === "processing") && <>
            <button type="button" className="logue-launcher logue-inline-cancel" aria-label="Cancel voice input" aria-keyshortcuts="Escape" title="Cancel (Esc)" onPointerDown={(event) => event.preventDefault()} onClick={cancel}><X size={17} /></button>
            <span className="logue-inline-status" role="status" aria-label={phase === "starting" ? "Starting microphone" : "Transcribing and inserting"}><LoaderCircle size={17} className="logue-inline-spinner" /></span>
          </>}
          {phase === "error" && <>
            <button type="button" className="logue-launcher logue-inline-cancel" aria-label="Dismiss voice input error" title="Dismiss" onPointerDown={(event) => event.preventDefault()} onClick={cancel}><X size={17} /></button>
            <button type="button" className="logue-launcher logue-launcher-voice" aria-label="Try voice input again" title="Try voice input again" onPointerDown={(event) => event.preventDefault()} onClick={start}><AudioLines size={17} strokeWidth={2.1} /></button>
          </>}
          {phase === "idle" && <button type="button" className="logue-launcher logue-launcher-voice" aria-label="Start voice input" title="Start voice input" onPointerDown={(event) => event.preventDefault()} onClick={start}><AudioLines size={17} strokeWidth={2.1} /></button>}
          {showError && <div className="logue-launcher-error" role="alert">Microphone access is unavailable. You can dismiss this or try again.</div>}
        </div>}
      </div>
    </section>
  );
}

const meta = {
  id: "extension-inline-voice-input",
  title: "Features/Extension/Inline Voice Input",
  component: InlineVoiceWorkflow,
  parameters: { layout: "centered" },
} satisfies Meta<typeof InlineVoiceWorkflow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveWorkflow: Story = {
  name: "Interactive workflow",
  render: () => <InlineVoiceWorkflow />,
};

export const FocusedIdle: Story = {
  name: "Focused field",
  render: () => <InlineVoiceWorkflow initialPhase="idle" />,
  play: async ({ canvasElement }) => {
    (canvasElement.querySelector("textarea") as HTMLTextAreaElement | null)?.focus();
  },
};

export const Recording: Story = {
  render: () => <InlineVoiceWorkflow initialPhase="recording" />,
};

export const StartingMicrophone: Story = {
  render: () => <InlineVoiceWorkflow initialPhase="starting" />,
};

export const Processing: Story = {
  render: () => <InlineVoiceWorkflow initialPhase="processing" />,
};

export const Failure: Story = {
  render: () => <InlineVoiceWorkflow initialPhase="error" />,
};

export const NarrowSingleLineInput: Story = {
  name: "Narrow single-line input",
  render: () => <InlineVoiceWorkflow narrow multiline={false} />,
};

export const InsertedText: Story = {
  name: "Inserted text",
  render: () => <InlineVoiceWorkflow initialValue={insertedText} />,
};

export const LongTextInNarrowField: Story = {
  name: "Long text in a narrow field",
  render: () => <InlineVoiceWorkflow narrow initialPhase="recording" initialValue="A long draft stays readable while compact recording controls reserve their own space instead of covering the text being written." />,
};
