import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExternalLink, Settings2 } from "lucide-react";
import { Recording, Spinner, cn } from "@logue/ui";
import { DictatedText, RecordControl } from "./dictation";
import type { Skill } from "../api";
import type { Take } from "../useDictation";
import type { VoicePhase } from "../useVoice";

/**
 * Page · The side panel.
 *
 * The real components, in the real layout, at the width Chrome actually gives
 * it. A panel can be assembled entirely out of components that were each
 * reviewed on their own and still be wrong — the record button ended up a
 * whole panel away from the tick that ends the recording, and every part of
 * that was correct in isolation.
 */

const SKILLS: Skill[] = [
  { id: "en", name: "Into English", output: "insert", contexts: ["dictation"], enabled: true },
  { id: "md", name: "As Markdown", output: "insert", contexts: ["dictation"], enabled: true },
  { id: "short", name: "Shorten", output: "insert", contexts: ["dictation"], enabled: true },
];

const SAID = "我们今天先把面板的信息架构定下来,然后再去做 Dictation 这一块。我的想法是先不要动 Chat 和 This page 的分法。";
const nothing = () => undefined;

const TABS = ["Dictation", "Chat", "This page", "Project"] as const;

/** The panel's own frame: 360 wide, and the height Chrome gives a side panel. */
function Panel({
  children,
  foot,
  on = "Dictation",
}: {
  children: React.ReactNode;
  foot?: React.ReactNode;
  on?: (typeof TABS)[number];
}) {
  return (
    <div className="flex h-[640px] w-[360px] flex-col overflow-hidden rounded-lg border border-line-strong bg-surface text-ink">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs text-muted">语音识别 - 维基百科,自由的百科全书</span>
        <span className="inline-flex h-control shrink-0 items-center gap-1 rounded-md border border-line px-1.5 text-xs text-muted">
          <ExternalLink size={12} /> Open Logue web app
        </span>
        <span className="inline-flex size-control items-center justify-center rounded-md text-muted">
          <Settings2 size={13} />
        </span>
      </header>
      <div role="tablist" className="flex shrink-0 gap-0.5 border-b border-line px-1.5">
        {TABS.map((label) => (
          <span
            key={label}
            role="tab"
            aria-selected={label === on}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-xs",
              label === on ? "border-accent font-[560] text-ink" : "border-transparent text-muted",
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="logue-scroll flex-1">{children}</div>
      {foot && <div className="shrink-0 border-t border-line bg-surface p-2">{foot}</div>}
    </div>
  );
}

function control(phase: VoicePhase = "idle", seconds = 0) {
  return <RecordControl phase={phase} seconds={seconds} onStart={nothing} onStop={nothing} onCancel={nothing} />;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-line p-2.5 last:border-b-0">{children}</div>;
}

const take = (over: Partial<Take> = {}): Take => ({ id: "t", text: SAID, used: [], made: [], ...over });

const meta = { title: "Page/Side panel", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing said yet — the first thing anyone sees. */
export const Empty: Story = {
  render: () => (
    <Panel foot={control()}>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <p className="max-w-56 text-center text-xs leading-[1.6] text-muted">Say something and it lands here.</p>
      </div>
    </Panel>
  ),
};

/** Recording. The control changed shape where it already was. */
export const WhileRecording: Story = {
  render: () => (
    <Panel foot={control("recording", 14)}>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <p className="max-w-56 text-center text-xs leading-[1.6] text-muted">Say something and it lands here.</p>
      </div>
    </Panel>
  ),
};

/** One recording still settling while the next is already being made. */
export const TwoInFlight: Story = {
  render: () => (
    <Panel foot={control("recording", 3)}>
      <Row>
        <div className="flex items-center gap-2">
          <Spinner size={13} className="text-muted" />
          <span className="flex-1 text-xs text-muted">Transcribing…</span>
        </div>
      </Row>
      <Row>
        <Recording src="" seconds={47} shape="cap_a" />
        <div className="mt-1">
          <DictatedText take={take()} skills={SKILLS} onApply={nothing} />
        </div>
      </Row>
    </Panel>
  ),
};

/** A recording, and everything Skills have made from it. */
export const AFullChain: Story = {
  render: () => (
    <Panel foot={control()}>
      <Row>
        <Recording src="" seconds={47} shape="cap_a" />
        <div className="mt-1">
          <DictatedText
            take={take({
              used: ["en"],
              made: [
                {
                  id: "en",
                  from: "Into English",
                  text: "Let's settle the panel's information architecture first, then move on to Dictation.",
                  used: ["md"],
                  made: [
                    {
                      id: "md",
                      from: "As Markdown",
                      text: "## Panel\n\n- Settle the information architecture first\n- Then move on to Dictation",
                      used: [],
                      made: [],
                    },
                  ],
                },
              ],
            })}
            skills={SKILLS}
            onApply={nothing}
          />
        </div>
      </Row>
    </Panel>
  ),
};

/** Out of four recordings, one failed — and it is the one that says so. */
export const OneOfThemFailed: Story = {
  render: () => (
    <Panel foot={control()}>
      <Row>
        <Recording src="" seconds={12} shape="cap_b" />
        <div className="mt-2 rounded-md border border-danger-line bg-danger-soft px-2 py-1.5 text-xs leading-[1.45] text-danger">
          Model rejected the request (503). The recording was kept — you can try again.
          <button type="button" className="mt-1 block font-[560] underline decoration-danger-line underline-offset-2">
            Try again
          </button>
        </div>
      </Row>
      <Row>
        <Recording src="" seconds={47} shape="cap_a" />
        <div className="mt-1">
          <DictatedText take={take()} skills={SKILLS} onApply={nothing} />
        </div>
      </Row>
    </Panel>
  ),
};

/** Recordings stopped somewhere, said once, above the ones that arrived. */
export const SomethingIsWaiting: Story = {
  render: () => (
    <Panel foot={control()}>
      <div className="p-2">
        <section className="grid gap-1.5 rounded-lg border border-line bg-surface-muted p-2">
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="size-1.5 shrink-0 rounded-full bg-danger" />
            <span className="flex-1">3 recordings without words · 1 failed</span>
            <span className="text-accent-ink">Show</span>
          </div>
        </section>
      </div>
      <Row>
        <Recording src="" seconds={47} shape="cap_a" />
        <div className="mt-1">
          <DictatedText take={take()} skills={SKILLS} onApply={nothing} />
        </div>
      </Row>
    </Panel>
  ),
};

/** The microphone is refused by Chrome, and the setting is one press away. */
export const TheMicrophoneIsBlocked: Story = {
  render: () => (
    <Panel
      foot={
        <>
          <div className="mb-1.5 flex items-center gap-2 rounded-md border border-line bg-surface-muted px-2 py-1.5">
            <span className="flex-1 text-xs text-warning">
              Chrome is blocking the microphone for this extension.
            </span>
            <span className="inline-flex h-control items-center rounded-md border border-line-strong px-2 text-xs font-[560] text-ink-soft">
              Open Chrome settings
            </span>
          </div>
          {control()}
        </>
      }
    >
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <p className="max-w-56 text-center text-xs leading-[1.6] text-muted">Say something and it lands here.</p>
      </div>
    </Panel>
  ),
};
