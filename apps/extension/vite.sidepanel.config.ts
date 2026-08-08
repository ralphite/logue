import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, "sidepanel.html"),
        microphone: resolve(import.meta.dirname, "microphone.html"),
      },
    },
  },
});
