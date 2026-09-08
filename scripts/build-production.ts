import { resolve } from "node:path";
import { build } from "vite";
import { buildAndPublish } from "./publish-build";
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, "..");
await buildAndPublish(root, async outDir => {
  await build({ root, build: { outDir, emptyOutDir: true } });
  await build({ root, configFile: false, publicDir: false, ssr: { noExternal: true }, build: {
    ssr: resolve(root, 'scripts/calendar-http-runtime.ts'), outDir: resolve(outDir, 'api'), emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: 'calendar-runtime.mjs', inlineDynamicImports: true } },
  } });
  const hash = createHash('sha256');
  for (const file of ['api/calendar-runtime.mjs', 'data/MemoryDays.xml', 'data/church-slavonic/catalogue.json']) {
    hash.update(await readFile(resolve(outDir, file)));
  }
  await writeFile(resolve(outDir, 'api/calendar-runtime.json'), JSON.stringify({
    nodeBinary: process.execPath, dataVersion: hash.digest('hex'),
  }));
});
console.info("Published dist/index.html after all assets. Previous versioned assets remain available to open tabs.");
