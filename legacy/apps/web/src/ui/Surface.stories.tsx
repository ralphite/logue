import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { Banner, Card, CardText, Eyebrow, InlineActions, Meta as MetaText, Pill } from "./Surface";

const meta = {
  title: "Components/Surfaces",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cards: Story = {
  render: () => (
    <div className="grid w-125 gap-3">
      <Card>
        <strong className="text-sm font-[620]">No saved content matches this search.</strong>
        <CardText>Try fewer words, or clear the filters to see everything you have saved.</CardText>
      </Card>
      <Card>
        <CardText>Could not reach the Logue Host.</CardText>
        <InlineActions className="mt-3">
          <Button variant="primary" size="sm">Retry</Button>
          <Button size="sm">Open Settings</Button>
        </InlineActions>
      </Card>
    </div>
  ),
};

/** Three tones: something to fix, something destructive, something confirmed. */
export const Banners: Story = {
  render: () => (
    <div className="grid w-125 gap-3">
      <Banner tone="warning" role="alert">
        Connect a provider in Settings → Models before using Ask, Compare, or Draft.
      </Banner>
      <Banner tone="danger">
        <p className="mb-3.5">Deleting this Project removes its Context membership. The Sources stay in your Library.</p>
        <Button variant="danger" size="sm">Delete Project</Button>
      </Banner>
      <Banner tone="neutral" role="status">
        Saved. This Skill revision is frozen into every Run that used it.
      </Banner>
    </div>
  ),
};

export const Pills: Story = {
  render: () => (
    <InlineActions>
      <Pill>Saved only</Pill>
      <Pill>Mobile research</Pill>
      <Pill tone="suggested">Suggested</Pill>
      <Pill onClick={() => undefined}>Remove correction</Pill>
    </InlineActions>
  ),
};

/** Provenance and quiet labels around a heading. */
export const Text: Story = {
  render: () => (
    <div className="w-125">
      <Eyebrow>Project</Eyebrow>
      <h1 className="text-[32px] leading-[1.16] font-[690] tracking-[-0.04em] text-ink">Mobile research</h1>
      <MetaText>Aug 7 · example.com · Saved only</MetaText>
    </div>
  ),
};
