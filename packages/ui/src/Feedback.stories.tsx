import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { Empty, ErrorNote, RecordingDot, Spinner } from "./Feedback";

const meta = { title: "Component/States", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Recording is the dot. The word lives in the accessibility tree, not the bar. */
export const Working: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <RecordingDot /> recording
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <Spinner /> transcribing
      </div>
      <ErrorNote>Could not reach the model. The recording is saved.</ErrorNote>
    </div>
  ),
};

/** One line, one action — never a paragraph about what could be here. */
export const Nothing: Story = {
  render: () => (
    <div className="w-[420px] rounded-md border border-line">
      <Empty action={<Button variant="primary">Capture this page</Button>}>
        Nothing saved from this page yet.
      </Empty>
    </div>
  ),
};
