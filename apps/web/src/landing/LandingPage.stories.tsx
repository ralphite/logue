import type { Meta, StoryObj } from "@storybook/react-vite";
import { LandingPage } from "./LandingPage";

const meta = {
  title: "Landing/logue.ai",
  component: LandingPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Landing: Story = {};
