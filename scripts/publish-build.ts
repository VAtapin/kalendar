import { lstat, mkdir, mkdtemp, readdir, realpath, rename, rm, rmdir, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

// Old tabs retain the complete import graph (including shared chunks and CSS),
// not just pdf-exporter.js. Never expire these files during a routine update.
export function isVersionedAsset(path: string): boolean {
  return /^assets\/[^/]+-[\w-]{8,}\.[\w.]+$/.test(path)
    && !/\.(?:php\d*|phtml|pht|phar|cgi|pl|py|asp|aspx)$/i.test(path);
}

async function regularDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Not a regular build directory: ${path}`);
}

async function filesIn(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(join(directory, entry.name), `${path}/`));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unexpected symlink or special file in build: ${path}`);
  }
  return files;
}

async function replaceFile(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  // Staging and dist are on the same project filesystem. Keep temporary files
  // OUTSIDE the document root (especially PHP source); publish by atomic rename.
  // If the operator mounted dist elsewhere, EXDEV fails rather than falling back
  // to a non-atomic write of a live resource.
  await rename(source, target);
}

/** Publish a fully built directory. The HTML entry point is the last file replaced. */
export async function publishBuild(staged: string, destination: string): Promise<void> {
  await regularDirectory(staged);
  const nextFiles = await filesIn(staged);
  if (!nextFiles.includes("index.html")) throw new Error("Build has no index.html; live site was not changed");
  await regularDirectory(destination);
  // Inventory before writing also refuses links/junctions inside the served tree.
  const previousFiles = await filesIn(destination);
  for (const path of nextFiles.filter(path => path !== "index.html")) {
    await replaceFile(join(staged, path), join(destination, path));
  }
  await replaceFile(join(staged, "index.html"), join(destination, "index.html"));

  // Keep old content-addressed bundles, not removed PHP endpoints or arbitrary
  // public files. dist is generated output; user data lives outside it in storage.
  const published = new Set(nextFiles);
  for (const path of previousFiles) {
    if (!published.has(path) && !isVersionedAsset(path)) await unlink(join(destination, path));
  }
}

/** Build outside the document root; failed/concurrent builds cannot erase the site. */
export async function buildAndPublish(root: string, build: (output: string) => Promise<unknown>): Promise<void> {
  const projectRoot = await realpath(root);
  const temporaryRoot = join(projectRoot, "tmp");
  await regularDirectory(temporaryRoot);
  const lock = join(temporaryRoot, "production-build.lock");
  try { await mkdir(lock); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Another build may be running. If a previous process crashed, remove only ${lock} after checking it has stopped.`);
    }
    throw error;
  }
  let staged: string | undefined;
  try {
    staged = await mkdtemp(join(temporaryRoot, "site-build-"));
    await build(staged);
    await publishBuild(staged, join(projectRoot, "dist"));
  } finally {
    try {
      if (staged) {
        // Never recursively delete a computed path without checking its resolved
        // boundary. Only this invocation's unique staging directory is removable.
        const checked = await realpath(staged);
        const local = relative(temporaryRoot, checked);
        if (isAbsolute(local) || local.includes(sep) || !local.startsWith("site-build-") || resolve(staged) !== checked) {
          throw new Error(`Refusing to remove unexpected staging path: ${checked}`);
        }
        await rm(checked, { recursive: true });
      }
    } finally { await rmdir(lock); }
  }
}
