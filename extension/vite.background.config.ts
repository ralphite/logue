import { defineConfig } from "vite";

/** The service worker is a module, but must ship as one file. */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/background.ts",
      output: { entryFileNames: "background.js", format: "es", inlineDynamicImports: true },
    },
  },
});
