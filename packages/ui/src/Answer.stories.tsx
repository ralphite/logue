import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Answer } from "./Answer";

/**
 * Component · Answer.
 *
 * Generated text with its citations made clickable — the one component the
 * whole product's promise rides on. Every claim points at a Source; the chip
 * carries the passage it stands on, so hovering is the difference between a
 * label and proof.
 */

const SOURCES = [
  { content: "抽取器用「含空格」判断正文,而中文句子没有空格。" },
  { content: "On zh.wikipedia's 语音识别, 362 of 440 blocks were dropped." },
  { content: "The rule was written for navigation labels, not for prose.", superseded_by: { id: "m9" } },
];

const TEXT =
  "因为抽取器用空格判断正文 [Source 1],真实中文页上四百四十块丢了三百六十二块 [Source 2]。最初的规矩是给导航标签写的 [Source 3]。";

function Tell({ text, sources }: { text: string; sources?: typeof SOURCES }) {
  const [open, setOpen] = useState<number>();
  return (
    <div className="w-[520px] text-[13px] leading-[1.7] text-ink">
      <Answer text={text} open={open} onCite={setOpen} sources={sources} />
    </div>
  );
}

const meta = { title: "Component/Answer", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Chips inline with the prose. The third one's Source has been overruled
 *  since, and the chip says so rather than presenting it as still true. */
export const WithCitations: Story = { render: () => <Tell text={TEXT} sources={SOURCES} /> };

/** `[Source 3, 7]` and `[Source 3, Source 7]` — both spellings models write. */
export const BothSpellings: Story = {
  render: () => (
    <Tell
      text="One claim on two Sources [Source 1, 2], and one written the long way [Source 1, Source 2]."
      sources={SOURCES}
    />
  ),
};

/** The answer cites more Sources than it was given: the chip still renders,
 *  with nothing behind it — never invented proof. */
export const ACitationWithNothingBehindIt: Story = {
  render: () => <Tell text="This stands on a Source that was never provided [Source 9]." sources={SOURCES.slice(0, 1)} />,
};

/** No citations at all. Prose is passed through untouched. */
export const PlainProse: Story = {
  render: () => <Tell text="Nothing here cites anything, and nothing is decorated." sources={[]} />,
};
