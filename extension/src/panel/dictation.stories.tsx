import type { Meta, StoryObj } from "@storybook/react-vite";
import { Recording } from "@logue/ui";
import { DictatedText, RecordControl } from "./dictation";
import type { Skill } from "../api";
import type { Take } from "../useDictation";

/**
 * Feature · Dictation.
 *
 * Every state one recording can be in, side by side and without a Host. These
 * were only ever visible by speaking into a real microphone and hoping the
 * failure you wanted was the failure you got.
 */

const SKILLS: Skill[] = [
  { id: "en", name: "Into English", output: "insert", contexts: ["dictation"], enabled: true },
  { id: "md", name: "As Markdown", output: "insert", contexts: ["dictation"], enabled: true },
  { id: "short", name: "Shorten", output: "insert", contexts: ["dictation"], enabled: true },
  { id: "formal", name: "Formal", output: "insert", contexts: ["dictation"], enabled: true },
];

const SAID =
  "我们今天先把面板的信息架构定下来,然后再去做 Dictation 这一块。我的想法是先不要动 Chat 和 This page 的分法,等把这一条走通了再回头看要不要合并。";

const take = (over: Partial<Take> = {}): Take => ({ id: "t", text: SAID, used: [], made: [], ...over });

/** The panel is 360 wide and nothing here may be reviewed at any other width. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[360px] rounded-lg border border-line-strong bg-surface p-2.5 text-ink">{children}</div>
  );
}

const meta = {
  title: "Feature/Dictation",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// -- the control ----------------------------------------------------------

/** One control, in one place: Record becomes cancel · clock · level · done. */
export const TheControl: Story = {
  render: () => (
    <div className="grid w-[360px] gap-3">
      {(
        [
          ["Idle", "idle", 0],
          ["Reaching the microphone", "starting", 0],
          ["Recording", "recording", 14],
          ["A long one", "recording", 138],
        ] as const
      ).map(([label, phase, seconds]) => (
        <div key={label} className="grid gap-1">
          <span className="text-xs text-muted">{label}</span>
          <RecordControl
            phase={phase}
            seconds={seconds}
            onStart={() => undefined}
            onStop={() => undefined}
            onCancel={() => undefined}
          />
        </div>
      ))}
    </div>
  ),
};

// -- one text -------------------------------------------------------------

export const ATranscript: Story = {
  render: () => (
    <Panel>
      <DictatedText take={take()} skills={SKILLS} onApply={() => undefined} />
    </Panel>
  ),
};

/** Two Skills fit a 360-pixel row; the rest are behind the ⋯. */
export const MoreSkillsThanFit: Story = {
  render: () => (
    <Panel>
      <DictatedText take={take()} skills={SKILLS} onApply={() => undefined} />
    </Panel>
  ),
};

/** A Skill already run on this text is not offered on it again. */
export const SkillsAlreadyUsed: Story = {
  render: () => (
    <Panel>
      <DictatedText take={take({ used: ["en", "md", "short"] })} skills={SKILLS} onApply={() => undefined} />
    </Panel>
  ),
};

/** The place the answer will land is claimed while it is on its way. */
export const ARewriteRunning: Story = {
  render: () => (
    <Panel>
      <DictatedText take={take({ running: "Into English" })} skills={SKILLS} onApply={() => undefined} />
    </Panel>
  ),
};

/**
 * Lineage is position. v1 → v2 → v3 goes down and in; a second rewrite of the
 * transcript sits beside the first rather than after it.
 */
export const AChainAndABranch: Story = {
  render: () => (
    <Panel>
      <DictatedText
        take={take({
          used: ["en", "short"],
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
            { id: "short", from: "Shorten", text: "先定面板的信息架构,再做 Dictation。", used: [], made: [] },
          ],
        })}
        skills={SKILLS}
        onApply={() => undefined}
      />
    </Panel>
  ),
};

/** A single word, and a wall of text. Both have to survive the same row. */
export const TooShortAndTooLong: Story = {
  render: () => (
    <div className="grid gap-3">
      <Panel>
        <DictatedText take={take({ text: "嗯" })} skills={SKILLS} onApply={() => undefined} />
      </Panel>
      <Panel>
        <DictatedText take={take({ text: SAID.repeat(6) })} skills={SKILLS} onApply={() => undefined} />
      </Panel>
    </div>
  ),
};

// -- the recording itself -------------------------------------------------

/** One widget, one time: the total at rest, the position while playing. */
export const ThePlayer: Story = {
  render: () => (
    <div className="grid w-[360px] gap-3">
      {[7, 47, 605].map((seconds) => (
        <Recording key={seconds} src="" seconds={seconds} shape={`cap_${seconds}`} />
      ))}
      <span className="text-xs text-muted">A recording whose length was never recorded:</span>
      <Recording src="" shape="cap_unknown" />
    </div>
  ),
};
