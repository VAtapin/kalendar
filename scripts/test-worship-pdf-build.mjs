import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve('dist');
const manifest = JSON.parse(await readFile(resolve(root, 'calendar-ui/worship-pdf-manifest.json'), 'utf8'));
if (!/^\/assets\/worship-pdf-[\w-]{8,}\.js$/.test(manifest.module)) throw new Error('Invalid built PDF asset URL');
const module = await import(pathToFileURL(resolve(root, '.' + manifest.module)).href);
for (const name of ['captureWorshipPdf', 'downloadWorshipPdf', 'exportWorshipPdf', 'StaleWorshipPdfError']) {
  if (typeof module[name] !== 'function') throw new Error('Missing browser export: ' + name);
}
for (const file of ['DejaVuSerif.ttf', 'DejaVuSans.ttf', 'Ponomar-Regular.ttf']) await access(resolve(root, 'fonts', file));
for (const file of ['book-reader.js', 'worship-reader.js', 'reader-pdf-controls.js']) {
  const text = await readFile(resolve(root, 'calendar-ui', file), 'utf8');
  if (!text.includes('Pdf')) throw new Error('Missing published reader PDF wiring: ' + file);
}
console.info('PASS built PDF manifest URL, ES exports, reader controls and embedded-font assets (no browser).');
