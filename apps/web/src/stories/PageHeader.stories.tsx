import { CirclePlus } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, ContextHeader, PageHeader, PaneHeader } from "../components/ui";

function PageHeaderFrame({ title = "Stream", withAction = false }: { title?: string; withAction?: boolean }) {
  return (
    <main className="min-h-44 bg-[#f7f7f5]">
      <PageHeader title={title} actions={withAction ? <Button variant="primary" size="sm"><CirclePlus size={14} />Add material</Button> : undefined} />
      <div className="mx-auto max-w-[1080px] bg-white px-8 py-6 text-[14px] text-[#999a95]">Page content follows the same axis.</div>
    </main>
  );
}

function HeaderOverview() {
  return (
    <main className="space-y-8 bg-[#f7f7f5] py-8">
      <section><p className="mx-auto mb-2 max-w-[1080px] px-8 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#888984]">Page</p><PageHeader title="Stream" actions={<Button variant="primary" size="sm"><CirclePlus size={14} />Add material</Button>} /></section>
      <section><p className="mx-auto mb-2 max-w-[960px] px-8 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#888984]">Context</p><ContextHeader leading={<Button variant="ghost" size="sm">All projects</Button>} /></section>
      <section className="mx-auto w-[360px] bg-white"><p className="mb-2 bg-[#f7f7f5] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#888984]">Pane</p><PaneHeader title="Sources" /><div className="h-20" /></section>
    </main>
  );
}

const meta = { id: "components-page-headers", title: "Components/Headers/Page Header", component: PageHeader, parameters: { layout: "fullscreen" } } satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = { render: () => <HeaderOverview /> };
export const Default: Story = { render: () => <PageHeaderFrame /> };
export const WithPrimaryAction: Story = { render: () => <PageHeaderFrame withAction /> };
export const LongTitle: Story = { render: () => <PageHeaderFrame title="A deliberately long page title that truncates before it competes with the primary action" withAction /> };
