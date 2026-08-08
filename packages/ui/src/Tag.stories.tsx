import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Tag } from "./Tag";

const meta = { title: "Content/Tag", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A tag and a Project share a line, so they must not read as one list. The `#`
 * is the whole difference: a Project is somewhere a Source belongs, a tag is
 * something it is about.
 */
export const BesideAProject: Story = {
  render: () => (
    <div className="flex items-center gap-1.5 text-[11px] text-muted">
      <span className="rounded-sm bg-surface-muted px-1 text-ink-soft">Research</span>
      <Tag name="async" />
      <Tag name="interviews" />
    </div>
  ),
};

/** Long enough to break a row, so it truncates rather than pushing things out. */
export const TooLong: Story = {
  render: () => (
    <div className="flex w-52 items-center gap-1 text-[11px]">
      <Tag name="a-very-long-tag-somebody-actually-typed" />
    </div>
  ),
};

function Editable() {
  const [tags, setTags] = useState(["async", "interviews", "q3"]);
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      {tags.map((name) => (
        <Tag key={name} name={name} onRemove={() => setTags(tags.filter((t) => t !== name))} />
      ))}
      {tags.length === 0 && <span className="text-faint">No tags</span>}
    </div>
  );
}

/** Removable, as it appears on a Source. */
export const Removable: Story = { render: () => <Editable /> };

/** Clickable, as it appears in the Stream — pressing one narrows the list. */
export const Filtering: Story = {
  render: () => (
    <div className="flex items-center gap-1 text-[11px]">
      <Tag name="async" onClick={() => undefined} />
      <Tag name="interviews" onClick={() => undefined} />
    </div>
  ),
};
