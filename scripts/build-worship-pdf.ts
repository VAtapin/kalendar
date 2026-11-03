import { resolve } from 'node:path';
import { build } from 'vite';
import { writeFile } from 'node:fs/promises';

/** Run inside buildAndPublish, after the main Vite build and before publication. */
export async function buildWorshipPdf(root: string, outDir: string) {
  const result = await build({
    configFile: false,
    root,
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: false,
      lib: { entry: resolve(root, 'src/export/worship-pdf-browser.ts'), formats: ['es'], fileName: () => 'assets/worship-pdf-[hash].js' },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const entry = outputs.flatMap(output => 'output' in output ? output.output : []).find(item => item.type === 'chunk' && item.isEntry);
  if (!entry) throw new Error('Missing worship PDF browser entry');
  await writeFile(resolve(outDir, 'calendar-ui/worship-pdf-manifest.json'), JSON.stringify({ module: '/' + entry.fileName }));
}
