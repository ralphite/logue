import type { Meta, StoryObj } from "@storybook/react-vite";
import { FirstRunSetup } from "../../v2-mock/web/FirstRunSetup";

const meta = { title: "V2 Product/First Run", component: FirstRunSetup, parameters: { layout: "fullscreen" } } satisfies Meta<typeof FirstRunSetup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseModels: Story = {};
export const RecommendedLocalModels: Story = { args: { initialChoice: "local" } };
export const ConnectMyProvider: Story = { args: { initialChoice: "provider" } };
