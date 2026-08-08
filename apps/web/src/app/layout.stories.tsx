import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../ui";
import {
  ContextSummary,
  Lead,
  PageAxis,
  PageHeading,
  PageScroll,
  PanelSectionHeading,
  ReviewList,
  ReviewRow,
  SettingRow,
  SettingsSection,
} from "./layout";

/**
 * How a route is assembled. Every page stacks the same three pieces — a scroll
 * container, a reading axis, a heading — before it shows anything of its own.
 */
const meta = {
  title: "Layout/Page",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen flex-col bg-canvas">{children}</div>;
}

export const Page: Story = {
  render: () => (
    <Frame>
      <PageScroll>
        <PageAxis>
          <PageHeading
            title="Library"
            lead="Everything you capture stays private on this Host until you delete it."
            actions={<Button variant="primary">New Source</Button>}
          />
          <ReviewList>
            {["Offline access matters more than sync", "Quiet capture beats real-time prompts"].map((title) => (
              <ReviewRow key={title}>
                <div>
                  <h3>{title}</h3>
                  <p>Saved from example.com · Added to Mobile research</p>
                </div>
                <Button size="sm">Open</Button>
              </ReviewRow>
            ))}
          </ReviewList>
        </PageAxis>
      </PageScroll>
    </Frame>
  ),
};

/** The three axes side by side, so the width difference is visible. */
export const Axes: Story = {
  render: () => (
    <Frame>
      <PageScroll>
        {(["reading", "list", "settings"] as const).map((axis) => (
          <PageAxis key={axis} axis={axis} className="!pt-6 !pb-6">
            <div className="rounded-lg border border-line bg-surface p-4">
              <strong className="text-[13px] font-[620]">{axis}</strong>
              <Lead>This block is as wide as the {axis} axis allows.</Lead>
            </div>
          </PageAxis>
        ))}
      </PageScroll>
    </Frame>
  ),
};

export const Settings: Story = {
  render: () => (
    <Frame>
      <PageScroll>
        <PageAxis axis="settings">
          <PageHeading title="Host" lead="This Mac owns your Logue data. There is no Logue account." />
          <SettingsSection title="Current Host">
            <SettingRow title="This Mac" detail="/Users/you/.logue-data" />
            <SettingRow title="Storage used" detail="19.7 MB" />
            <SettingRow title="Local address" detail="An Extension on this Mac pairs automatically.">
              <Button size="sm">Pair another device</Button>
            </SettingRow>
          </SettingsSection>
        </PageAxis>
      </PageScroll>
    </Frame>
  ),
};

export const DocumentFooter: Story = {
  render: () => (
    <Frame>
      <PageScroll>
        <PageAxis axis="reading">
          <p className="text-[17px] leading-[1.78] text-[#292b28]">
            Quiet capture consistently outperforms real-time prompts in mobile research.
          </p>
          <ContextSummary>
            <span>Revision 106 · 5 frozen Sources</span>
            <Button size="sm" variant="ghost">Continue editing</Button>
          </ContextSummary>
          <PanelSectionHeading className="mt-10">
            <div>
              <h2>Recent work</h2>
              <p>Continue a Document or reopen a sourced result.</p>
            </div>
          </PanelSectionHeading>
        </PageAxis>
      </PageScroll>
    </Frame>
  ),
};
