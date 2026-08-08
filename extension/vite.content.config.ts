import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * One self-contained IIFE. A content script cannot load chunks from the host
 * page's origin, and its CSS is inlined so it can be injected into the shadow
 * root rather than leaking into the page.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: "src/content.tsx",
      output: { entryFileNames: "content.js", format: "iife", inlineDynamicImports: true },
    },
  },
});
