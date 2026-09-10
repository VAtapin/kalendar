import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, join, resolve} from 'node:path';

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || '';
const kind = option('kind');
const output = option('output');
if (!['mother-of-god', 'savior', 'saint'].includes(kind) || !output) {
  throw new Error('Usage: node scripts/export-icon-corpus.mjs --kind=savior --output=/absolute/directory');
}
const source = resolve('data/icon-library');
const destination = resolve(output);
if (existsSync(destination) && readdirSync(destination).length > 0) {
  throw new Error(`Destination is not empty: ${destination}`);
}
mkdirSync(destination, {recursive: true});
const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8'));
const records = Object.fromEntries(Object.entries(catalog.records).filter(([, record]) => record.kind === kind));
const referencedBlobs = new Set(Object.values(records).flatMap(record => (record.images || []).map(image => image.sourceUrl).filter(Boolean)));
const blobs = Object.fromEntries([...referencedBlobs].flatMap(url => catalog.blobs[url] ? [[url, catalog.blobs[url]]] : []));
const copy = relative => {
  const from = join(source, relative), to = join(destination, relative);
  if (!existsSync(from)) return false;
  mkdirSync(dirname(to), {recursive: true}); copyFileSync(from, to); return true;
};
let images = 0, pages = 0;
for (const record of Object.values(records)) {
  if (copy(`pages/${createHash('sha256').update(record.url).digest('hex')}.html`)) pages++;
  for (const image of record.images || []) if (image.path && copy(image.path)) images++;
}
writeFileSync(join(destination, 'catalog.json'), JSON.stringify({
  schemaVersion: catalog.schemaVersion, source: catalog.source, exportedAt: new Date().toISOString(),
  kind, indexes: catalog.indexes, records, blobs,
}, null, 2) + '\n');
console.log(JSON.stringify({kind, records: Object.keys(records).length, images, pages, destination}, null, 2));