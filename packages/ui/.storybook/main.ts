import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // Every level, in one Storybook: the parts, the pieces made of parts, the
  // surfaces made of pieces, and the journeys through them. They were only
  // ever the parts, which is how a panel could be assembled entirely out of
  // reviewed components and still be wrong.
  stories: [
    "../src/**/*.stories.@(ts|tsx)",
    "../../../extension/src/**/*.stories.@(ts|tsx)",
    "../../../web/src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  // This product does not send anything anywhere, and its tools should not
  // either — Storybook reports usage home unless told not to.
  core: { disableTelemetry: true },
};

export default config;
