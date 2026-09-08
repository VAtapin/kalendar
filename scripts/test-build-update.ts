import { chromium, expect } from "@playwright/test";
import { build } from "vite";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildAndPublish } from "./publish-build";

// A real production import graph and real browser, with no accounts/network mail.
// Keep this fixture in tmp for inspection; all writes are generated test inputs.
const workspace = resolve(import.meta.dirname, "..");
await mkdir(join(workspace, "tmp"), { recursive: true });
const fixture = await mkdtemp(join(workspace, "tmp/build-update-browser-"));
const source = join(fixture, "source");
await mkdir(source);
async function input(name: string, text: string): Promise<void> {
  await writeFile(join(source, name), text);
}
await input("index.html", '<!doctype html><html><body><input id="draft"><button id="export">Export</button><output id="result"></output><script type="module" src="/main.js"></script></body></html>');
async function publish(version: string): Promise<void> {
  await input("main.js", `document.body.dataset.version = ${JSON.stringify(version)};
    document.querySelector('#export').onclick = async () => {
      const { run } = await import('./pdf-exporter.js');
      document.querySelector('#result').textContent = await run();
    };`);
  await input("pdf-exporter.js", `import './pdf-exporter.css';
    export async function run() { const { name } = await import('./pdf-dependency.js'); return ${JSON.stringify(version)} + ':' + name; }`);
  await input("pdf-dependency.js", `export const name = ${JSON.stringify(`dependency-${version}`)};`);
  await input("pdf-exporter.css", `#result { color: ${version === "old" ? "rgb(1, 2, 3)" : "rgb(4, 5, 6)"}; }`);
  await buildAndPublish(fixture, outDir => build({
    configFile: false, root: source, logLevel: "error", build: { outDir, emptyOutDir: true },
  }));
}

await publish("old");
const server = createServer(async (request, response) => {
  // This fixture exercises published files, not Apache configuration. A missing
  // asset deliberately gets the old HTML fallback to reproduce the original bug.
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const path = join(fixture, "dist", pathname === "/" ? "index.html" : pathname);
  try {
    const bytes = await readFile(path);
    response.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "text/html");
    response.setHeader("Cache-Control", "no-store");
    response.end(bytes);
  } catch {
    response.setHeader("Content-Type", "text/html");
    response.end(await readFile(join(fixture, "dist/index.html")));
  }
});
await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing test server address");
const browser = await chromium.launch(process.platform === "win32" ? { channel: "msedge" } : {});
try {
  const oldTab = await browser.newPage();
  const failedRequests: string[] = [];
  const browserErrors: string[] = [];
  const exportsRequested: string[] = [];
  oldTab.on("requestfailed", request => failedRequests.push(request.url()));
  oldTab.on("pageerror", error => browserErrors.push(error.message));
  oldTab.on("request", request => { if (request.url().includes("pdf-exporter-")) exportsRequested.push(request.url()); });
  const url = `http://127.0.0.1:${address.port}`;
  await oldTab.goto(url);
  await expect(oldTab.locator("body")).toHaveAttribute("data-version", "old");
  await oldTab.locator("#draft").fill("Unsaved calendar draft stays in this tab");
  expect(exportsRequested).toEqual([]);

  // Update twice before the old tab has loaded ANY of the PDF graph.
  await publish("new");
  await publish("newest");
  await oldTab.locator("#export").click();
  await expect(oldTab.locator("#result")).toHaveText("old:dependency-old");
  await expect(oldTab.locator("#result")).toHaveCSS("color", "rgb(1, 2, 3)");
  await expect(oldTab.locator("#draft")).toHaveValue("Unsaved calendar draft stays in this tab");
  await expect(oldTab.locator("body")).toHaveAttribute("data-version", "old");
  expect(exportsRequested.length).toBeGreaterThan(0);
  expect(failedRequests).toEqual([]);
  expect(browserErrors).toEqual([]);

  const newTab = await browser.newPage();
  await newTab.goto(url);
  await expect(newTab.locator("body")).toHaveAttribute("data-version", "newest");
  await newTab.locator("#export").click();
  await expect(newTab.locator("#result")).toHaveText("newest:dependency-newest");
  await expect(newTab.locator("#result")).toHaveCSS("color", "rgb(4, 5, 6)");
  console.info("PASS: old tab loads its untouched PDF import graph after two deployments; new tab loads the latest graph; unsaved input retained; no reload or browser errors.");
  console.info(`Fixture: ${fixture}`);
} finally {
  await browser.close();
  await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
}
