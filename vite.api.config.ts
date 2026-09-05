import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "scripts/calendar-api-server.ts",
    outDir: "server-dist",
    emptyOutDir: true,
    target: "node20",
    rollupOptions: {
      output: {
        entryFileNames: "calendar-api-server.mjs",
      },
    },
  },
});
