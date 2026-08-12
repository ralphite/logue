import type { Preview } from "@storybook/react-vite";
import "./preview.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { expanded: true },
    a11y: { test: "todo" },
    // The sidebar reads in the order the work divides, smallest to largest —
    // alphabetical order put Journey above Component, which is backwards.
    options: {
      storySort: {
        order: ["Foundation", "Component", "Feature", "Page", ["The app", "Side panel"], "Journey"],
      },
    },
  },
};

export default preview;
