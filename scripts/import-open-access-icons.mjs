import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {
  SOURCE_IDS, DEFAULT_QUERY, acceptRecord, appendLog, cliArgs, collectSource,
  duplicateFor, isMain, readCatalog, saveCatalog, storeImage,
  duplicateAgainstExisting,
} from './lib/open-access-icons.mjs';

function storedRecord(candidate, image) {
  return {
    source: candidate.source,
    source_url: candidate.sourceUrl,
    source_id: candidate.sourceId,
    title: candidate.title,
    description: candidate.description,
    museum: candidate.museum,
    inventory_number: candidate.inventoryNumber,
    license: candidate.license,
    license_url: candidate.licenseUrl,
    rights: candidate.rights,
    commercial_use: candidate.commercialUse,
    modifications_allowed: candidate.modificationsAllowed,
    attribution_required: candidate.attributionRequired,
    copyright_note: candidate.copyrightNote,
    image_url: candidate.imageUrl,
    image_mime: image.mime,
    sha256: image.sha256,
    phash: image.phash,
    path: image.path,
    bytes: image.bytes,
    source_metadata: candidate.raw,
    imported_at: new Date().toISOString(),
    status: 'imported',
  };
}

function usage() {
  console.log(`Usage:
  node scripts/import-open-access-icons.mjs --source=met --query="orthodox icon" --dry-run
  node scripts/import-open-access-icons.mjs --source=cleveland --limit=100

Sources: ${SOURCE_IDS.join(', ')}
Required for special sources:
  Smithsonian: SMITHSONIAN_API_KEY
  Europeana: EUROPEANA_API_KEY
  Nationalmuseum: --record-url=https://...[,https://...]
  NGA/Walters: --input=/absolute/server/records.json

Without --dry-run the script downloads only accepted originals into --output.
`);
}

async function main() {
  const args = cliArgs(process.argv.slice(2));
  if (args.help || args.h) return usage();
  const source = String(args.source ?? '');
  if (!SOURCE_IDS.includes(source)) throw new Error(`Укажите один --source из: ${SOURCE_IDS.join(', ')}`);
  const dryRun = Boolean(args['dry-run']);
  const limit = Math.max(1, Math.min(10_000, Number(args.limit ?? 100)));
  const output = resolve(String(args.output ?? 'storage/open-access-icons'));
  const catalogPath = resolve(String(args.catalog ?? join(output, 'catalog.json')));
  const existingCatalogPath = resolve(String(args['existing-catalog'] ?? 'data/icon-library/catalog.json'));
  const logPath = resolve(String(args.log ?? join(output, 'import.log.jsonl')));
  const lockPath = join(output, 'import.lock');
  const options = {
    input: args.input ? String(args.input) : undefined,
    recordUrls: args['record-url'] ? String(args['record-url']).split(',').map(value => value.trim()).filter(Boolean) : [],
    timeoutMs: Number(args.timeout ?? 45_000),
    userAgent: String(args['user-agent'] ?? 'KalendarOpenAccessIconImporter/1.0'),
  };
  if (!dryRun) {
    if (existsSync(lockPath)) {
      const pid = Number(readFileSync(lockPath, 'utf8'));
      try { process.kill(pid, 0); throw new Error(`Импортёр уже запущен: ${pid}`); } catch (error) { if (error.message.includes('Импортёр')) throw error; }
      unlinkSync(lockPath);
    }
    writeFileSync(lockPath, String(process.pid), {flag: 'wx'});
  }
  try {
    const catalog = dryRun ? {schemaVersion: 1, records: {}, blobs: {}} : await readCatalog(catalogPath);
    const existingCatalog = existsSync(existingCatalogPath) ? await readCatalog(existingCatalogPath) : {records: {}, blobs: {}};
    const writeLog = (entry) => dryRun ? Promise.resolve() : appendLog(logPath, entry);
    const stats = {source, scanned: 0, accepted: 0, rejected: 0, downloaded: 0, duplicates: 0, errors: 0, reasons: {}};
    for await (const candidate of collectSource(source, String(args.query ?? DEFAULT_QUERY), limit, options)) {
      stats.scanned += 1;
      const decision = acceptRecord(candidate);
      if (!decision.accepted) {
        stats.rejected += 1;
        stats.reasons[decision.reason] = (stats.reasons[decision.reason] ?? 0) + 1;
        await writeLog({event: 'rejected', source, sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl, reason: decision.reason});
        continue;
      }
      stats.accepted += 1;
      const existing = duplicateFor(candidate, catalog);
      const existingAzbyka = existing ? undefined : duplicateAgainstExisting(candidate, existingCatalog);
      if (existing || existingAzbyka) {
        stats.duplicates += 1;
        const match = existing ? {catalog: 'open-access', source: existing.source, sourceId: existing.sourceId ?? existing.source_id, path: existing.path} : {catalog: 'azbyka', key: existingAzbyka.key, source: existingAzbyka.item.source ?? 'azbyka.ru', sourceUrl: existingAzbyka.item.url, path: existingAzbyka.item.path};
        await writeLog({event: 'duplicate', matchType: existing?.sha256 === candidate.sha256 ? 'sha256' : existingAzbyka?.match ?? 'source-id-or-url', source, sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl, existing: match, relation: existingAzbyka ? 'same-image-do-not-copy' : 'already-imported'});
        continue;
      }
      if (dryRun) {
        console.log(JSON.stringify({event: 'would-import', source: candidate.source, sourceId: candidate.sourceId, title: candidate.title, license: candidate.license, sourceUrl: candidate.sourceUrl, imageUrl: candidate.imageUrl}));
        continue;
      }
      try {
        const image = await storeImage(candidate, output, options);
        const record = storedRecord(candidate, image);
        catalog.records[`${source}:${candidate.sourceId}`] = record;
        catalog.blobs[image.sha256] = {path: image.path, sha256: image.sha256, bytes: image.bytes, mime: image.mime, phash: image.phash};
        stats.downloaded += 1;
        await appendLog(logPath, {event: 'imported', source, sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl, path: image.path, sha256: image.sha256, phash: image.phash});
        await saveCatalog(catalogPath, catalog);
      } catch (error) {
        stats.errors += 1;
        await appendLog(logPath, {event: 'error', source, sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl, error: error instanceof Error ? error.message : String(error)});
      }
    }
    if (!dryRun) { catalog.lastRun = {source, finishedAt: new Date().toISOString(), stats}; await saveCatalog(catalogPath, catalog); }
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    if (!dryRun) { try { unlinkSync(lockPath); } catch {} }
  }
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
