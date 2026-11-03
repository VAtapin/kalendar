import { resolve } from "node:path";
import { build } from "vite";
import { buildAndPublish } from "./publish-build";
import { writeFile } from 'node:fs/promises';

import { buildWorshipPdf } from './build-worship-pdf';

const root = resolve(import.meta.dirname, "..");
await buildAndPublish(root, async outDir => {
  await build({ root, build: { outDir, emptyOutDir: true } });
  await buildWorshipPdf(root, outDir);
  // Print export keeps its Node executable manifest independently of calendar data.
  await writeFile(resolve(outDir, 'api/print-runtime.json'), JSON.stringify({nodeBinary: process.execPath}));
});
console.info("Published dist/index.html after all assets. Previous versioned assets remain available to open tabs.");
