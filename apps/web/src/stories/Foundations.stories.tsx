import type { Meta, StoryObj } from "@storybook/react-vite";
import { editorColumnClass, pageColumnClass, readingColumnClass } from "../components/layout";

function Foundations() {
  const colors = [
    ["Ink", "--ink"],
    ["Muted ink", "--muted"],
    ["Canvas", "--canvas"],
    ["Surface", "--surface"],
    ["Line", "--line"],
    ["Accent", "--accent"],
  ] as const;
  return (
    <main className="mx-auto max-w-[1080px] space-y-12 bg-white p-10 text-[#242522]">
      <section>
        <h1 className="text-[32px] font-bold tracking-[-0.04em]">Logue foundations</h1>
        <p className="mt-2 text-[15px] text-[#777873]">Quiet, content-first, and internally consistent.</p>
      </section>
      <section>
        <h2 className="text-[14px] font-semibold text-[#555651]">Type</h2>
        <div className="mt-4 space-y-5 border-t border-[#eeeeeb] pt-5">
          <p className="text-[38px] font-bold tracking-[-0.045em]">Document title</p>
          <p className="text-[20px] font-semibold tracking-[-0.035em]">Page title</p>
          <p className="text-[15px] leading-7">Body text uses a calm reading rhythm and avoids decorative weight.</p>
          <p className="text-[14px] text-[#777873]">Metadata and supporting information</p>
        </div>
      </section>
      <section>
        <h2 className="text-[14px] font-semibold text-[#555651]">Color</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {colors.map(([name, variable]) => <div key={name}><div className="h-16 rounded-md border border-[#deded9]" style={{ background: `var(${variable})` }} /><p className="mt-2 text-[14px] font-medium">{name}</p><code className="text-[13px] text-[#888984]">{variable}</code></div>)}
        </div>
      </section>
      <section>
        <h2 className="text-[14px] font-semibold text-[#555651]">Content axes</h2>
        <div className="mt-4 space-y-3 bg-[#f7f7f5] py-5 text-[13px] text-[#777873]">
          <div className={`${pageColumnClass} h-10 rounded bg-white py-3`}>Page · 1080px · databases and lists</div>
          <div className={`${editorColumnClass} h-10 rounded bg-white py-3`}>Editor · 960px · forms and structured editing</div>
          <div className={`${readingColumnClass} h-10 rounded bg-white py-3`}>Reading · 900px · documents and long-form material</div>
        </div>
      </section>
    </main>
  );
}

const meta = { title: "Foundations/Design Tokens", component: Foundations, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Foundations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
