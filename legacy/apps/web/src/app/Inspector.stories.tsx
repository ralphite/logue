import { X } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { IconButton, OriginLabel } from "../ui";
import {
  Chip,
  InspectorHeader,
  InspectorScroll,
  SourceBody,
  SourceBundle,
  SourceExcerptToggle,
  SourceHeading,
  SourceList,
  SourceMeta,
} from "./Inspector";

/**
 * The Sources panel. It has to make three things obvious at a glance: what the
 * page said, what you added, and which passage a citation points at.
 */
const meta = {
  title: "Layout/Sources inspector",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const excerpt =
  "Asynchronous research removes the pressure of the moment. Participants can respond when it is convenient, resulting in more thoughtful, detailed, and authentic feedback. Because it fits into their day, people are more likely to complete the study and provide richer context.";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-100 flex-col border-l border-line bg-panel">
      <InspectorHeader>
        <h2>Sources</h2>
        <IconButton label="Close sources" variant="ghost">
          <X size={17} />
        </IconButton>
      </InspectorHeader>
      <InspectorScroll>{children}</InspectorScroll>
    </div>
  );
}

export const Bundle: Story = {
  render: () => {
    const [expanded, setExpanded] = useState(false);
    return (
      <Panel>
        <SourceList>
          <SourceBundle>
            <OriginLabel origin="web" detail="Original evidence" />
            <SourceHeading>
              <h3>Why asynchronous research beats real-time prompts on mobile</h3>
            </SourceHeading>
            <SourceBody clamp={!expanded}>
              <p>{excerpt}</p>
            </SourceBody>
            <SourceExcerptToggle expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
            <SourceBody>
              <OriginLabel origin="you" detail="Original voice retained" />
              <p>This matches what we saw in the last study.</p>
            </SourceBody>
            <SourceMeta>Jul 14 · uxcollective.cc</SourceMeta>
          </SourceBundle>
          <SourceBundle>
            <OriginLabel origin="web" detail="Original evidence" />
            <SourceHeading>
              <h3>Asynchronous vs. synchronous research: what the data shows</h3>
            </SourceHeading>
            <SourceBody>
              <p>Data from multiple studies shows asynchronous methods yield higher completion rates.</p>
            </SourceBody>
            <SourceMeta>Feb 28 · nngroup.com</SourceMeta>
          </SourceBundle>
        </SourceList>
      </Panel>
    );
  },
};

/** The Source a citation points at lifts out of the list. */
export const ActiveCitation: Story = {
  render: () => (
    <Panel>
      <SourceList>
        <SourceBundle active>
          <OriginLabel origin="web" detail="Original evidence" />
          <SourceHeading>
            <h3>Why asynchronous research beats real-time prompts on mobile</h3>
          </SourceHeading>
          <SourceBody cited>
            <p>{excerpt}</p>
          </SourceBody>
          <SourceMeta>Jul 14 · uxcollective.cc</SourceMeta>
        </SourceBundle>
        <SourceBundle>
          <OriginLabel origin="you" detail="Saved text" />
          <SourceHeading>
            <h3>Offline access matters more than sync</h3>
          </SourceHeading>
          <SourceMeta>Aug 2 · This Mac</SourceMeta>
        </SourceBundle>
      </SourceList>
    </Panel>
  ),
};

export const Chips: Story = {
  render: () => (
    <Panel>
      <div className="flex flex-wrap gap-1.5">
        <Chip>Export Markdown</Chip>
        <Chip as="a" href="https://example.com" target="_blank" rel="noreferrer">
          Open original
        </Chip>
        <Chip>Pin revision</Chip>
      </div>
    </Panel>
  ),
};
