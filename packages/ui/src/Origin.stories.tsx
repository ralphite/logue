import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Citation, OriginMark } from "./Origin";

const meta = { title: "Component/Origin", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The product's central promise: web evidence, what you said, and what a model
 * produced never look alike.
 */
export const Marks: Story = {
  render: () => (
    <div className="grid gap-1.5">
      <OriginMark origin="web" detail="uxcollective.cc" />
      <OriginMark origin="you" detail="Voice · 12s" />
      <OriginMark origin="ai" detail="Draft document" />
    </div>
  ),
};

function CitedParagraph() {
  const [open, setOpen] = useState<number>();
  return (
    <p className="max-w-page text-[13px] leading-[1.6] text-ink">
      Asynchronous research yields higher completion rates{" "}
      <Citation n={1} aria-pressed={open === 1} onClick={() => setOpen(open === 1 ? undefined : 1)} /> and
      richer detail than real-time prompting{" "}
      <Citation n={2} aria-pressed={open === 2} onClick={() => setOpen(open === 2 ? undefined : 2)} />.
    </p>
  );
}

/** A citation is pressed while the Source it points at is open. */
export const Citations: Story = { render: () => <CitedParagraph /> };
