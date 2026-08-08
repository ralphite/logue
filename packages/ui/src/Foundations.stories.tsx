import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The values every surface resolves to. If a size or color is not here, it does
 * not belong in the product.
 */
const meta = { title: "Foundations/Tokens", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const swatches = [
  ["ink", "#20211f", "reading text"],
  ["ink-soft", "#4e504b", "buttons, secondary text"],
  ["muted", "#70726c", "labels, meta"],
  ["faint", "#73756f", "chevrons, hints"],
  ["line", "#e7e7e3", "dividers"],
  ["line-strong", "#d9dad5", "control borders"],
  ["surface-muted", "#f6f6f4", "hover fill"],
  ["accent", "#535fdb", "the one primary action"],
  ["accent-soft", "#f0f1fd", "citation chips"],
  ["success", "#347847", "confirmations"],
  ["warning", "#9a6814", "needs attention"],
  ["danger", "#a33d36", "destructive, errors"],
];

export const Color: Story = {
  render: () => (
    <div className="grid max-w-[560px] gap-1">
      {swatches.map(([name, hex, use]) => (
        <div key={name} className="grid grid-cols-[24px_140px_90px_1fr] items-center gap-2 text-xs">
          <span className="size-6 rounded-md" style={{ background: hex, boxShadow: "inset 0 0 0 1px rgb(15 15 15/8%)" }} />
          <code className="text-ink">{name}</code>
          <code className="text-faint">{hex}</code>
          <span className="text-muted">{use}</span>
        </div>
      ))}
    </div>
  ),
};

export const Density: Story = {
  render: () => (
    <div className="grid max-w-[560px] gap-3 text-xs">
      {[
        ["control", "28px", "buttons, selects, inputs, menu rows"],
        ["bar", "32px", "floating toolbars"],
        ["row", "36px", "panel headers and footers"],
      ].map(([name, value, use]) => (
        <div key={name} className="grid grid-cols-[80px_56px_1fr] items-center gap-2">
          <code>{name}</code>
          <code className="text-faint">{value}</code>
          <div className="rounded-md bg-accent-soft" style={{ height: value }} title={use} />
        </div>
      ))}
      <p className="text-muted">Body text is 13px/1.5. UI text is 12px. Gaps are 2, 4, 6, 8.</p>
    </div>
  ),
};

export const Elevation: Story = {
  render: () => (
    <div className="flex gap-4 bg-surface-muted p-8">
      <div className="logue-float grid h-20 w-44 place-items-center text-xs text-muted">Floating surface</div>
      <div className="grid h-20 w-44 place-items-center rounded-lg border border-line text-xs text-muted">
        Inline surface
      </div>
    </div>
  ),
};
