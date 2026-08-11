import type { Meta, StoryObj } from "@storybook/react-vite";
import { Recording } from "./Recording";

/**
 * Component · Recording.
 *
 * Play, a waveform to scrub, and **one** time. The browser's own
 * `<audio controls>` took the whole row of a 360-pixel panel and printed a
 * duration it did not have — MediaRecorder never writes the length into the
 * file — so the real length was printed a second time beside it. Two clocks,
 * one of them wrong.
 *
 * The bars are drawn from the recording's id, so a recording looks like itself
 * every time it is shown, and never needs downloading to be drawn.
 */
const meta = {
  title: "Component/Recording",
  component: Recording,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Recording>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InAPanel: Story = {
  args: { src: "", seconds: 47, shape: "cap_47" },
  render: (args) => (
    <div className="w-[360px]">
      <Recording {...args} />
    </div>
  ),
};

/** Every length has to fit the same row: a note, a thought, ten minutes. */
export const EveryLength: Story = {
  args: { src: "" },
  render: () => (
    <div className="grid w-[360px] gap-2">
      {[3, 47, 605].map((seconds) => (
        <Recording key={seconds} src="" seconds={seconds} shape={`cap_${seconds}`} />
      ))}
    </div>
  ),
};

/** Recorded before the length was written down: no number rather than a wrong one. */
export const LengthUnknown: Story = {
  args: { src: "", shape: "cap_old" },
  render: (args) => (
    <div className="w-[360px]">
      <Recording {...args} />
    </div>
  ),
};

/** Two recordings never look alike, and each looks the same every time. */
export const TellingThemApart: Story = {
  args: { src: "" },
  render: () => (
    <div className="grid w-[360px] gap-2">
      {["cap_a1b2", "cap_c3d4", "cap_e5f6"].map((id) => (
        <Recording key={id} src="" seconds={31} shape={id} />
      ))}
    </div>
  ),
};

/** Wide enough for a page, and narrow enough for a panel that is mostly text. */
export const AtEveryWidth: Story = {
  args: { src: "" },
  render: () => (
    <div className="grid gap-3">
      {[220, 360, 640].map((width) => (
        <div key={width} style={{ width }}>
          <Recording src="" seconds={47} shape="cap_47" />
        </div>
      ))}
    </div>
  ),
};
