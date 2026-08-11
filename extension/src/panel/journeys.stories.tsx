import type { Meta, StoryObj } from "@storybook/react-vite";
import { Recording, Spinner } from "@logue/ui";
import { DictatedText, RecordControl } from "./dictation";
import { VoiceBar } from "../surfaces/VoiceBar";
import type { Skill } from "../api";
import type { Take } from "../useDictation";

/**
 * Journey · one thing, start to finish.
 *
 * A state on its own says whether it is drawn correctly. Only the sequence
 * says whether it is *usable*: whether the hand moves, whether the eye has to
 * go looking, whether what was true a moment ago is still on screen. The
 * record button being a whole panel away from the tick that ends the
 * recording was invisible until the two were put side by side.
 */

const SKILLS: Skill[] = [
  { id: "en", name: "Into English", output: "insert", contexts: ["dictation"], enabled: true },
  { id: "md", name: "As Markdown", output: "insert", contexts: ["dictation"], enabled: true },
  { id: "short", name: "Shorten", output: "insert", contexts: ["dictation"], enabled: true },
];
const SAID = "我们今天先把面板的信息架构定下来,然后再去做 Dictation 这一块。";
const ENGLISH = "Let's settle the panel's information architecture first, then move on to Dictation.";
const nothing = () => undefined;
const take = (over: Partial<Take> = {}): Take => ({ id: "t", text: SAID, used: [], made: [], ...over });

/** One frame of the film: what is on screen, and what just happened. */
function Frame({ step, did, children }: { step: number; did: string; children: React.ReactNode }) {
  return (
    <figure className="m-0 grid w-[360px] gap-1.5">
      <figcaption className="flex items-baseline gap-2 text-xs">
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent-soft font-[560] text-accent-ink">
          {step}
        </span>
        <span className="text-muted">{did}</span>
      </figcaption>
      <div className="rounded-lg border border-line-strong bg-surface p-2.5 text-ink">{children}</div>
    </figure>
  );
}

function Film({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-start gap-5 p-2">{children}</div>;
}

const meta = { title: "Journey/Dictation", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Say something, keep it, make something of it.
 *
 * The thing to check here is that the hand never travels: Record, then the
 * tick, are the same place — and the transcript arrives above them without
 * moving anything that was already on screen.
 */
export const SayItThenRewriteIt: Story = {
  render: () => (
    <Film>
      <Frame step={1} did="Nothing said yet.">
        <p className="py-6 text-center text-xs text-muted">Say something and it lands here.</p>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={2} did="Pressed Record — the same box, changed shape.">
        <p className="py-6 text-center text-xs text-muted">Say something and it lands here.</p>
        <RecordControl phase="recording" seconds={14} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={3} did="Pressed the tick. The microphone is already free.">
        <div className="mb-2 flex items-center gap-2 border-b border-line pb-2">
          <Spinner size={13} className="text-muted" />
          <span className="flex-1 text-xs text-muted">Transcribing…</span>
        </div>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={4} did="The words arrived, with the recording that proves them.">
        <div className="mb-2 border-b border-line pb-2">
          <Recording src="" seconds={47} shape="cap_a" />
          <DictatedText take={take()} skills={SKILLS} onApply={nothing} />
        </div>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={5} did="Pressed Into English. The place it will land is already claimed.">
        <div className="mb-2 border-b border-line pb-2">
          <Recording src="" seconds={47} shape="cap_a" />
          <DictatedText take={take({ running: "Into English" })} skills={SKILLS} onApply={nothing} />
        </div>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={6} did="It landed under what it came from. The original did not move.">
        <div className="mb-2 border-b border-line pb-2">
          <Recording src="" seconds={47} shape="cap_a" />
          <DictatedText
            take={take({
              used: ["en"],
              made: [{ id: "en", from: "Into English", text: ENGLISH, used: [], made: [] }],
            })}
            skills={SKILLS}
            onApply={nothing}
          />
        </div>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>
    </Film>
  ),
};

/**
 * The Host was off the whole time.
 *
 * Nothing said is lost, and at no point is the person told something that is
 * not true — including that it worked.
 */
export const WhenLogueIsNotRunning: Story = {
  render: () => (
    <Film>
      <Frame step={1} did="Recording, with no idea anything is wrong. Nor should there be.">
        <p className="py-6 text-center text-xs text-muted">Say something and it lands here.</p>
        <RecordControl phase="recording" seconds={9} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={2} did="Pressed the tick. Nothing answered, and the audio is kept here.">
        <section className="mb-2 grid gap-1.5 rounded-lg border border-line bg-surface-muted p-2">
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="size-1.5 shrink-0 rounded-full bg-warning" />
            <span className="flex-1">1 recording without words</span>
            <span className="text-accent-ink">Show</span>
          </div>
        </section>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={3} did="Opened it: what it is, and everything that can be done with it.">
        <section className="mb-2 grid gap-1.5 rounded-lg border border-line bg-surface-muted p-2">
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="size-1.5 shrink-0 rounded-full bg-warning" />
            <span className="flex-1">1 recording without words</span>
            <span className="text-accent-ink">Hide</span>
          </div>
          <div className="grid gap-1 rounded-md border border-line bg-surface p-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>14:32</span>
              <span>· 9s</span>
            </div>
            <p className="text-xs text-muted">Goes in when Logue is back — nothing to do</p>
            <div className="flex gap-1">
              {["Try now", "Export audio", "Delete"].map((label) => (
                <span
                  key={label}
                  className="inline-flex h-control items-center rounded-md border border-line-strong px-2 text-xs font-[560] text-ink-soft"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>

      <Frame step={4} did="Logue came back. It went in by itself.">
        <div className="mb-2 border-b border-line pb-2">
          <Recording src="" seconds={9} shape="cap_late" />
          <DictatedText take={take({ text: "刚才那段在 Logue 没开的时候录的。" })} skills={SKILLS} onApply={nothing} />
        </div>
        <RecordControl phase="idle" seconds={0} onStart={nothing} onStop={nothing} onCancel={nothing} />
      </Frame>
    </Film>
  ),
};

/**
 * Speaking into somebody else's page.
 *
 * The bar is the whole interface here, so every step of it has to be legible
 * on top of text nobody controls.
 */
export const SpeakingIntoAPage: Story = {
  render: () => (
    <Film>
      {(
        [
          [1, "The caret landed in a field. Three icons, nothing to read.", "idle", 0],
          [2, "Speaking. The tick is where the microphone was.", "recording", 12],
          [3, "Accepted; the words are on their way to that caret.", "working", 0],
        ] as const
      ).map(([step, did, phase, seconds]) => (
        <Frame key={step} step={step} did={did}>
          <div className="flex justify-center py-3">
            <VoiceBar
              phase={phase}
              seconds={seconds}
              overrides={{}}
              onOverrides={nothing}
              onStart={nothing}
              onCommand={nothing}
              onStop={nothing}
              onCancel={nothing}
            />
          </div>
        </Frame>
      ))}
      <Frame step={4} did="Landed. Only the way back is left, and it leaves on its own.">
        <div className="flex justify-center py-3">
          <VoiceBar
            phase="idle"
            inserted
            onUndo={nothing}
            overrides={{}}
            onOverrides={nothing}
            onStart={nothing}
            onCommand={nothing}
            onStop={nothing}
            onCancel={nothing}
          />
        </div>
      </Frame>
    </Film>
  ),
};
