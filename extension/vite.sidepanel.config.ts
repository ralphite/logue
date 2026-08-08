import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

/** The side panel and the offscreen recorder are ordinary extension pages. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // An extension page loads from chrome-extension://<id>/, so absolute asset
  // paths resolve against the extension root and 404. Relative paths do not.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, "sidepanel.html"),
        offscreen: resolve(import.meta.dirname, "offscreen.html"),
      },
    },
  },
});
