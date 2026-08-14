import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { Empty, ErrorBubble, ErrorNote, Keys, Loading, Notice, RecordingDot, Spinner } from "./Feedback";

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


/** Every face a wait or a failure has, side by side — one vocabulary. */
export const TheWholeFamily: Story = {
  render: () => (
    <div className="grid w-[460px] gap-3">
      <Loading />
      <ErrorNote>Logue is not running on this Mac.</ErrorNote>
      <ErrorBubble>The model rejected the request. The recording was kept.</ErrorBubble>
      <div className="flex items-center gap-2 text-xs text-muted">
        <RecordingDot /> the dot is the word
      </div>
      <div className="rounded-md border border-line">
        <Empty>Nothing kept from this page yet.</Empty>
      </div>
    </div>
  ),
};

/**
 * The three tones of a message in the flow, side by side.
 *
 * There were seven spellings of this across the packages — two with colours
 * typed in by hand — so the same failure looked like a different product
 * depending on which surface it happened on.
 */
export const Notices: Story = {
  render: () => (
    <div className="grid w-[460px] gap-2">
      <Notice action={<button type="button" className="font-[560] underline underline-offset-2">Try again</button>}>
        The model is busy (503). The recording was kept — you can try again.
      </Notice>
      <Notice tone="warning" action={<Button>Open Chrome settings</Button>}>
        Chrome is blocking the microphone for this page.
      </Notice>
      <Notice
        tone="quiet"
        action={
          <>
            <Button>Keep mine</Button>
            <Button variant="ghost">Discard mine</Button>
          </>
        }
      >
        This document changed somewhere else. Your edits are still here, unsaved.
      </Notice>
    </div>
  ),
};

/** A key, drawn as a key — it was `<kbd>` styled as ordinary grey text. */
export const TheKeys: Story = {
  render: () => (
    <div className="flex items-center gap-3 text-[11px] text-muted">
      <span className="flex items-center gap-1">
        <Keys>↑</Keys>
        <Keys>↓</Keys> to move
      </span>
      <span className="flex items-center gap-1">
        <Keys>↵</Keys> to open
      </span>
      <span className="flex items-center gap-1">
        <Keys>⌘K</Keys> from anywhere
      </span>
    </div>
  ),
};
