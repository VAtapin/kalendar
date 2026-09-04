import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    watch: {
      // Large source datasets are loaded at runtime and must not participate in HMR.
      ignored: ["**/public/data/**"],
    },
  },
});
