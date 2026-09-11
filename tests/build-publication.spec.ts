import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildAndPublish, isVersionedAsset, publishBuild } from "../scripts/publish-build";

const roots: string[] = [];
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "calendar-publish-test-"));
  roots.push(root);
  return root;
}
async function file(root: string, path: string, content: string): Promise<void> {
  const target = join(root, path);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, content);
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("safe production publication", () => {
  it("keeps the full old import graph across repeated deployments, while updating HTML and PHP", async () => {
    const root = await fixture();
    await file(root, "dist/index.html", "old entry");
    await file(root, "dist/assets/pdf-exporter-Abcd1234.js", 'import "./shared-Efgh5678.js"');
    await file(root, "dist/assets/shared-Efgh5678.js", "old dependency");
    await file(root, "dist/assets/editor-Qrst1234.css", "old css");
    await file(root, "dist/api/removed.php", "removed endpoint");
    await file(root, "dist/obsolete.json", "old unversioned data");
    await file(root, "storage/calendar.json", "private user data");
    for (const version of ["second", "third"]) {
      await buildAndPublish(root, async output => {
        // Even while compilation is running the old entry/assets are still served.
        expect(await readFile(join(root, "dist/index.html"), "utf8")).toBe(version === "second" ? "old entry" : "second");
        await file(output, "assets/pdf-exporter-New12345.js", "new exporter");
        await file(output, "api/index.php", "updated endpoint");
        await file(output, "index.html", version);
      });
    }
    expect(await readFile(join(root, "dist/index.html"), "utf8")).toBe("third");
    expect(await readFile(join(root, "dist/assets/pdf-exporter-Abcd1234.js"), "utf8")).toContain("shared-Efgh5678.js");
    expect(await readFile(join(root, "dist/assets/shared-Efgh5678.js"), "utf8")).toBe("old dependency");
    expect(await readFile(join(root, "dist/assets/editor-Qrst1234.css"), "utf8")).toBe("old css");
    expect(await readFile(join(root, "dist/api/index.php"), "utf8")).toBe("updated endpoint");
    await expect(readFile(join(root, "dist/api/removed.php"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(root, "dist/obsolete.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(root, "storage/calendar.json"), "utf8")).toBe("private user data");
    expect(await readdir(join(root, "tmp"))).toEqual([]);
  });

  it("does not touch the live site on a failed build and releases the lock", async () => {
    const root = await fixture();
    await file(root, "dist/index.html", "working site");
    const failure = new Error("Compilation failed");
    await expect(buildAndPublish(root, async output => {
      await file(output, "index.html", "incomplete build");
      throw failure;
    })).rejects.toBe(failure);
    expect(await readFile(join(root, "dist/index.html"), "utf8")).toBe("working site");
    expect(await readdir(join(root, "tmp"))).toEqual([]);
  });

  it("refuses concurrent builds, without removing the other build's lock", async () => {
    const root = await fixture();
    await mkdir(join(root, "tmp/production-build.lock"), { recursive: true });
    await expect(buildAndPublish(root, async () => { throw new Error("must not build"); })).rejects.toThrow("Another build may be running");
    expect(await readdir(join(root, "tmp"))).toEqual(["production-build.lock"]);
  });

  it("does not publish incomplete output without an HTML entry point", async () => {
    const root = await fixture();
    await file(root, "dist/index.html", "working site");
    await file(root, "staged/assets/partial-12345678.js", "partial");
    await expect(publishBuild(join(root, "staged"), join(root, "dist"))).rejects.toThrow("no index.html");
    expect(await readFile(join(root, "dist/index.html"), "utf8")).toBe("working site");
    expect(await readdir(join(root, "dist"))).toEqual(["index.html"]);
  });

  it("retains hashed static files, not removed executable server endpoints", () => {
    for (const path of ["assets/pdf-exporter-Abcd1234.js", "assets/shared-aB_9-x_y.js", "assets/theme-12345678.css", "assets/font-Abcd1234.woff2"]) expect(isVersionedAsset(path)).toBe(true);
    for (const path of ["api/old-Abcd1234.php", "assets/old-Abcd1234.php", "index.html", "assets/nested/image.png", "assets/manifest.json"]) expect(isVersionedAsset(path)).toBe(false);
  });

  it("keeps the old HTML if an asset cannot be published", async () => {
    const root = await fixture();
    await file(root, "dist/index.html", "working site");
    await file(root, "dist/assets/blocked-12345678.js/placeholder", "unexpected directory");
    await file(root, "staged/index.html", "must not be published");
    await file(root, "staged/assets/blocked-12345678.js", "new code");
    await expect(publishBuild(join(root, "staged"), join(root, "dist"))).rejects.toThrow();
    expect(await readFile(join(root, "dist/index.html"), "utf8")).toBe("working site");
  });

  it("refuses a junction/symlink in dist instead of writing or deleting outside it", async () => {
    const root = await fixture();
    await file(root, "outside/private.txt", "private file");
    await file(root, "dist/index.html", "working site");
    await symlink(join(root, "outside"), join(root, "dist/assets"), "junction");
    await file(root, "staged/index.html", "new site");
    await expect(publishBuild(join(root, "staged"), join(root, "dist"))).rejects.toThrow("symlink");
    expect(await readFile(join(root, "outside/private.txt"), "utf8")).toBe("private file");
    expect(await readFile(join(root, "dist/index.html"), "utf8")).toBe("working site");
  });

  it("uses the safe publisher for the documented build command", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    expect(packageJson.scripts.build).toBe("vue-tsc -b && tsx scripts/build-production.ts");
  });

  it("revalidates HTML and excludes missing static assets from Apache's SPA fallback", async () => {
    const htaccess = await readFile("public/.htaccess", "utf8");
    expect(htaccess).toContain('<FilesMatch "\\.html$">');
    expect(htaccess).toContain('Header always set Cache-Control "no-cache, max-age=0, must-revalidate"');
    const api = htaccess.indexOf("RewriteRule ^api");
    const missing = htaccess.indexOf("RewriteRule ^(?:assets|fonts|brand|data|downloads|calendar-ui)(?:/|$) - [R=404,L]");
    const fallback = htaccess.indexOf("RewriteRule ^ index.html [L]");
    expect(api).toBeGreaterThan(-1);
    expect(missing).toBeGreaterThan(api);
    expect(fallback).toBeGreaterThan(missing);
  });
});
