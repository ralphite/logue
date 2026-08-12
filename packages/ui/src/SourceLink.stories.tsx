import type { Meta, StoryObj } from "@storybook/react-vite";
import { SourceLink } from "./SourceLink";

/**
 * Component · SourceLink.
 *
 * Where something came from, as a link when there is somewhere to go and as
 * plain text when there is not — a Source typed by hand has no address, and
 * dressing it as a link would promise a way back that does not exist.
 */
const meta = { title: "Component/SourceLink", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithSomewhereToGo: Story = {
  render: () => (
    <div className="w-[360px] text-xs">
      <SourceLink url="https://en.wikipedia.org/wiki/Speech_recognition" label="en.wikipedia.org" />
    </div>
  ),
};

/** No URL: the same words, none of the invitation. */
export const NowhereToGo: Story = {
  render: () => (
    <div className="w-[360px] text-xs">
      <SourceLink label="This Mac" />
    </div>
  ),
};

/** A long title in a narrow row truncates rather than wrapping the row. */
export const TooLongForItsRow: Story = {
  render: () => (
    <div className="flex w-[240px] items-center gap-2 rounded-md border border-line p-2 text-xs">
      <SourceLink
        url="https://example.com/very/deep"
        label="A page title that is far longer than the row it has to live in without breaking it"
        className="min-w-0 flex-1"
      />
      <span className="shrink-0 text-muted">14h ago</span>
    </div>
  ),
};
