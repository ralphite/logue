import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The theme every component reads from. These are Tailwind theme tokens, so a
 * swatch here is the same value a route gets from `bg-surface` or `text-muted`.
 */
const meta = {
  title: "Foundations/Design tokens",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const surfaces = [
  { name: "canvas", token: "bg-canvas", note: "The page behind everything" },
  { name: "surface", token: "bg-surface", note: "Cards, inputs, menus" },
  { name: "surface-muted", token: "bg-surface-muted", note: "Hover and quiet fills" },
  { name: "panel", token: "bg-panel", note: "The Sources panel and Side Panel" },
  { name: "nav", token: "bg-nav", note: "Primary navigation" },
];

const inks = [
  { name: "ink", token: "text-ink", note: "Headings and primary text" },
  { name: "ink-soft", token: "text-ink-soft", note: "Body copy" },
  { name: "muted", token: "text-muted", note: "Labels and secondary copy" },
  { name: "faint", token: "text-faint", note: "Timestamps and provenance" },
];

const accents = [
  { name: "accent", token: "bg-accent", onDark: true },
  { name: "accent-hover", token: "bg-accent-hover", onDark: true },
  { name: "accent-soft", token: "bg-accent-soft" },
  { name: "accent-line", token: "bg-accent-line" },
  { name: "danger", token: "bg-danger", onDark: true },
  { name: "warning", token: "bg-warning", onDark: true },
];

const axes = [
  { name: "reading", token: "max-w-reading", width: "820px", note: "A document and its composer" },
  { name: "list", token: "max-w-list", width: "940px", note: "Library, Skills, History" },
  { name: "settings", token: "max-w-settings", width: "1180px", note: "Settings, with its own nav column" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[13px] font-[650] text-ink">{title}</h2>
      {children}
    </section>
  );
}

export const Overview: Story = {
  render: () => (
    <div className="min-h-screen bg-canvas p-10 text-ink">
      <h1 className="mb-1 text-[32px] leading-[1.16] font-[690] tracking-[-0.04em]">Design tokens</h1>
      <p className="mb-10 max-w-160 text-[15px] text-muted">
        Every colour, radius and reading width in Logue comes from this theme. Components never hardcode a
        value that exists here.
      </p>

      <Section title="Surfaces">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {surfaces.map((entry) => (
            <div key={entry.name} className="overflow-hidden rounded-lg border border-line">
              <div className={`h-16 ${entry.token}`} />
              <div className="border-t border-line bg-surface px-3 py-2">
                <strong className="block text-[13px] font-[620]">{entry.name}</strong>
                <span className="text-xs text-muted">{entry.note}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Text">
        <div className="grid gap-2 rounded-lg border border-line bg-surface p-4">
          {inks.map((entry) => (
            <div key={entry.name} className="flex items-baseline gap-4">
              <code className="w-32 shrink-0 text-xs text-faint">{entry.token}</code>
              <span className={`text-[15px] ${entry.token}`}>{entry.note}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Accent and status">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {accents.map((entry) => (
            <div key={entry.name} className={`rounded-lg border border-line px-3 py-4 ${entry.token}`}>
              <strong className={`block text-[13px] font-[620] ${entry.onDark ? "text-white" : "text-ink"}`}>
                {entry.name}
              </strong>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Reading axes">
        <div className="grid gap-2">
          {axes.map((entry) => (
            <div key={entry.name} className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <code className="text-xs text-faint">{entry.token}</code>
                <span className="text-xs text-muted">
                  {entry.width} · {entry.note}
                </span>
              </div>
              <div className={`h-2 w-full rounded-full bg-accent-soft ${entry.token}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii">
        <div className="flex gap-3">
          {["rounded-sm", "rounded-md", "rounded-lg"].map((token) => (
            <div key={token} className={`grid size-24 place-items-center border border-line bg-surface ${token}`}>
              <code className="text-xs text-faint">{token}</code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
};
