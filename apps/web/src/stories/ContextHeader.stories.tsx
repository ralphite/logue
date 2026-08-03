import { ArrowLeft } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, ContextHeader } from "../components/ui";

function ContextHeaderFrame({ error = false, title = "All projects" }: { error?: boolean; title?: string }) {
  return (
    <main className="min-h-36 bg-[#f7f7f5]">
      <ContextHeader
        leading={<Button variant="ghost" size="sm"><ArrowLeft size={14} />{title}</Button>}
        actions={error ? <span className="text-[14px] text-[#a84d44]">Save failed</span> : undefined}
      />
      <div className="mx-auto max-w-[960px] bg-white px-8 py-6 text-[14px] text-[#999a95]">Editor content follows the same axis.</div>
    </main>
  );
}

const meta = { title: "Components/Headers/Context Header", component: ContextHeader, args: { leading: null }, parameters: { layout: "fullscreen" } } satisfies Meta<typeof ContextHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <ContextHeaderFrame /> };
export const LocalError: Story = { render: () => <ContextHeaderFrame error /> };
export const LongContext: Story = { render: () => <ContextHeaderFrame title="A long parent context that must not move the action area" error /> };
