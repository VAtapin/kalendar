import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { documentRoutes } from './src/document-routes';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ isSsrBuild }) => ({
  resolve: { alias: !isSsrBuild && !process.env.VITEST ? [{
    find: /^.*\/corpus-data$/,
    replacement: fileURLToPath(new URL('./src/calendar/localization/corpus-data.browser.ts', import.meta.url)),
  }] : [] },
  plugins: [vue(), {
    name: 'document-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const file = documentRoutes[url.pathname.replace(/\/$/, '')];
        if (file) req.url = file + url.search;
        next();
      });
    },
  }],
  optimizeDeps: {
    entries: ["index.html"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
    watch: {
      // Large source datasets are loaded at runtime and must not participate in HMR.
      ignored: ["**/public/data/**"],
    },
  },
}));
