import type { Meta, StoryObj } from "@storybook/react-vite";
import { MockSessionProvider } from "../../v2-mock/runtime/MockSessionProvider";
import { ContextReview, type ContextReviewTab } from "../../v2-mock/web/ContextReview";

function ContextReviewStory({ tab = "context" }: { tab?: ContextReviewTab }) {
  return <MockSessionProvider><ContextReview initialTab={tab} /></MockSessionProvider>;
}

const meta = { title: "V2 Product/Project Context", component: ContextReviewStory, parameters: { layout: "fullscreen" } } satisfies Meta<typeof ContextReviewStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MembershipReview: Story = { args: { tab: "context" } };
export const TopicsAndClassification: Story = { args: { tab: "topics" } };
export const ActivityAndRuns: Story = { args: { tab: "activity" } };
export const AiAndDocumentLineage: Story = { args: { tab: "lineage" } };
export const ProjectTranscriptionContext: Story = { args: { tab: "voice" } };
