import { resolve } from "node:path";
import { build } from "vite";
import { buildAndPublish } from "./publish-build";

const root = resolve(import.meta.dirname, "..");
await buildAndPublish(root, outDir => build({ root, build: { outDir, emptyOutDir: true } }));
console.info("Published dist/index.html after all assets. Previous versioned assets remain available to open tabs.");
