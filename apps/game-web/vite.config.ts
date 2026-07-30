import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    sourcemap: true,
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) return "phaser";
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react-vendor";
          if (id.includes("/src/replay/")) return "replay-tools";
          if (id.includes("/src/editor/")) return "scenario-editor";
          if (id.includes("/src/settings/")) return "browser-settings";
          return undefined;
        },
      },
    },
  },
});
