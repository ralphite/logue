import type { Meta, StoryObj } from "@storybook/react-vite";
import { LandingPage } from "../../v2-mock/landing/LandingPage";

const meta = {
  title: "V2 Product/logue.ai",
  component: LandingPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Landing: Story = {};
