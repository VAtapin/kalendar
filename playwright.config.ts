import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1600, height: 1000 },
    launchOptions: process.platform === "win32"
      ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" }
      : undefined,
  },
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run api",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
