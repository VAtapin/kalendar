import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

// Isolated build: never publish or replace the site's dist directory.
const root = resolve(import.meta.dirname, '..');
const label = process.argv[2] || 'current';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple report label');
await mkdir(resolve(root, 'artifacts'), { recursive: true });
await build({ root, logLevel: 'error', build: { copyPublicDir: false,
  outDir: resolve(root, 'tmp', `bundle-audit-${label}`), emptyOutDir: true,
}, plugins: [{ name: 'audit-browser-bundle', async generateBundle(_options, bundle) {
  const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
  const reports = chunks.map(chunk => ({ file: chunk.fileName, entry: chunk.isEntry,
    bytes: Buffer.byteLength(chunk.code), gzipBytes: gzipSync(chunk.code).length,
    imports: chunk.imports, dynamicImports: chunk.dynamicImports,
    modules: Object.entries(chunk.modules).map(([id, info]) => ({
      id: id.replaceAll('\\', '/').replace(root.replaceAll('\\', '/') + '/', ''), bytes: info.renderedLength,
    })).sort((a, b) => b.bytes - a.bytes),
  })).sort((a, b) => b.bytes - a.bytes);
  function closure(file: string, visited = new Set<string>()): Set<string> {
    if (visited.has(file)) return visited;
    visited.add(file);
    reports.find(item => item.file === file)?.imports.forEach(dep => closure(dep, visited));
    return visited;
  }
  const routes = reports.filter(item => item.entry || item.modules.some(module =>
    /components\/(HomeRoute|CalendarApiDocs|PublicSitePage)\.vue|^src\/App\.vue/.test(module.id)));
  const routeTotals = routes.map(route => {
    const files = closure(route.file);
    reports.filter(item => item.entry).forEach(item => closure(item.file, files));
    const selected = reports.filter(item => files.has(item.file));
    return { file: route.file, bytes: selected.reduce((n, item) => n + item.bytes, 0),
      gzipBytes: selected.reduce((n, item) => n + item.gzipBytes, 0), files: [...files] };
  });
  await writeFile(resolve(root, `artifacts/bundle-audit-${label}.json`), JSON.stringify({ reports, routeTotals }, null, 2));
  console.log(JSON.stringify({ largest: reports.slice(0, 4).map(({ file, bytes, gzipBytes }) => ({ file, bytes, gzipBytes })), routeTotals }, null, 2));
  if (label !== 'before') {
    const home = routeTotals.find(item => /\/HomeRoute-/.test(item.file));
    if (!home || home.bytes > 350_000) throw new Error('Home JavaScript exceeds 350 kB; inspect static dependencies');
    const homeChunks = reports.filter(item => home.files.includes(item.file));
    if (homeChunks.some(item => item.modules.some(module => /calendar\/localization\/|pdf-lib\/|@pdf-lib\/fontkit\//.test(module.id)))) {
      throw new Error('Home unexpectedly loads calendar corpora or PDF libraries');
    }
    const editor = routeTotals.find(item => /\/App-/.test(item.file));
    if (!editor || editor.bytes > 1_000_000) throw new Error('Initial editor JavaScript exceeds 1 MB');
    const editorChunks = reports.filter(item => editor.files.includes(item.file));
    if (editorChunks.some(item => item.modules.some(module => /(?:uk-commemorations|pl-commemorations|german-additions|slavonic-editorial-titles)\.json|pdf-lib\/|@pdf-lib\/fontkit\//.test(module.id)))) {
      throw new Error('Initial editor unexpectedly loads optional corpora or PDF libraries');
    }
  }
} }] });
