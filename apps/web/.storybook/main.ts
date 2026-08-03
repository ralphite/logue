import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  managerHead: (head) => `${head}<script>
    if (!window.location.search && !window.location.hash) {
      window.location.replace(window.location.pathname + "?path=/story/foundations-design-tokens--overview");
    }
  </script>`,
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
