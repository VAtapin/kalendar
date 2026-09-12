import {createHash} from 'node:crypto';
import {appendFile, mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PNG} from 'pngjs';

export const SOURCE_IDS = Object.freeze([
  'wikimedia', 'met', 'cleveland', 'smithsonian', 'nationalmuseum',
  'nga', 'getty', 'aic', 'walters', 'europeana',
]);

export const DEFAULT_QUERY = 'orthodox icon byzantine icon Christian iconography';

const ICON_TERMS = /(?:orthodox|byzantine|christian|iconography|icon|theotokos|virgin mary|madonna|saint|apostle|holy|богород|икон|православ|визант|свят|христ|мадонн|orthodoxe|byzantin|ikone|heilig)/iu;
const DISALLOWED_RIGHTS = /(?:non[- ]?commercial|\b(?:nc|nd)\b|no known copyright|in[- ]?copyright|restricted|usage conditions apply|permission required|all rights reserved|copyrighted|other)/iu;
const LICENSE_URLS = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  pdm: 'https://creativecommons.org/publicdomain/mark/1.0/',
  ccBy: 'https://creativecommons.org/licenses/by/4.0/',
  ccBySa: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export const ACCEPTED_LICENSES = Object.freeze({
  cc0: {license: 'CC0', commercialUse: true, modificationsAllowed: true, attributionRequired: false},
  pdm: {license: 'Public Domain Mark', commercialUse: true, modificationsAllowed: true, attributionRequired: false},
  ccBy: {license: 'CC BY', commercialUse: true, modificationsAllowed: true, attributionRequired: true},
  ccBySa: {license: 'CC BY-SA', commercialUse: true, modificationsAllowed: true, attributionRequired: true},
});

const sourceLabels = {
  wikimedia: 'Wikimedia Commons', met: 'The Metropolitan Museum of Art',
  cleveland: 'Cleveland Museum of Art', smithsonian: 'Smithsonian Open Access',
  nationalmuseum: 'Nationalmuseum Stockholm', nga: 'National Gallery of Art',
  getty: 'Getty Open Content', aic: 'Art Institute of Chicago',
  walters: 'Walters Art Museum', europeana: 'Europeana',
};

export function sourceLabel(source) {
  return sourceLabels[source] ?? source;
}

function text(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' | ');
  if (typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' | ');
  return String(value).replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function first(...values) {
  return values.map(text).find(Boolean) ?? '';
}

function absoluteUrl(value, base) {
  const candidate = first(value);
  if (!candidate) return '';
  try { return new URL(candidate, base).href; } catch { return ''; }
}

export function classifyRights(input = {}) {
  const raw = first(input.license, input.licenseName, input.licenseUrl, input.rights, input.rightsText, input.usageRights);
  const value = raw.toLowerCase();
  if (!raw || DISALLOWED_RIGHTS.test(value)) return null;
  let key = '';
  if (/creativecommons\.org\/(?:publicdomain\/zero|licenses\/cc0)|\bcc0\b|creative commons zero/iu.test(value)) key = 'cc0';
  else if (/public domain mark|public-domain mark|\bpdm\b|public domain/iu.test(value)) key = 'pdm';
  else if (/creativecommons\.org\/licenses\/by-sa|\bcc\s*by[- ]?sa\b|attribution[- ]sharealike/iu.test(value)) key = 'ccBySa';
  else if (/creativecommons\.org\/licenses\/by(?:\/|\b)|\bcc\s*by\b|attribution 4\.0|attribution license/iu.test(value)) key = 'ccBy';
  if (!key) return null;
  const policy = ACCEPTED_LICENSES[key];
  return {
    ...policy,
    licenseUrl: first(input.licenseUrl) || LICENSE_URLS[key],
    rights: raw,
    copyrightNote: first(input.copyrightNote, input.creditLine),
    key,
  };
}

export function isIconCandidate(record) {
  return ICON_TERMS.test([
    record.title, record.description, record.subjects, record.culture,
    record.classification, record.objectName, record.kind,
  ].map(text).join(' '));
}

export function normalizeRecord(record, source) {
  const rights = classifyRights(record);
  const normalized = {
    source,
    sourceName: sourceLabel(source),
    sourceUrl: first(record.sourceUrl, record.objectUrl, record.recordUrl),
    sourceId: first(record.sourceId, record.id, record.objectId, record.accessionNumber),
    title: first(record.title, record.objectName) || 'Без названия',
    description: first(record.description, record.subjects, record.culture),
    museum: first(record.museum, sourceLabel(source)),
    inventoryNumber: first(record.inventoryNumber, record.accessionNumber, record.accessionNum),
    license: rights?.license ?? '',
    licenseUrl: rights?.licenseUrl ?? first(record.licenseUrl),
    rights: rights?.rights ?? first(record.rights, record.usageRights),
    commercialUse: rights?.commercialUse ?? false,
    modificationsAllowed: rights?.modificationsAllowed ?? false,
    attributionRequired: rights?.attributionRequired ?? false,
    copyrightNote: first(record.copyrightNote, record.creditLine, record.credit),
    imageUrl: first(record.imageUrl, record.originalImageUrl, record.primaryImage, record.iiifUrl),
    imageMime: first(record.imageMime, record.mime),
    subjects: first(record.subjects, record.classification, record.culture),
    raw: record.raw ?? record,
  };
  return normalized;
}

export function acceptRecord(record) {
  if (!record.sourceId || !record.sourceUrl || !record.imageUrl) return {accepted: false, reason: 'missing-identity-or-image'};
  if (!isIconCandidate(record)) return {accepted: false, reason: 'not-iconography'};
  if (!record.license || !record.commercialUse || !record.modificationsAllowed) return {accepted: false, reason: 'rights-not-allowed'};
  return {accepted: true, reason: 'accepted'};
}

export function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function averageHashFromPixels(pixels, width, height) {
  const values = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / 8));
      const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / 8));
      const offset = (sy * width + sx) * 4;
      values.push((pixels[offset] * 299 + pixels[offset + 1] * 587 + pixels[offset + 2] * 114) / 1000);
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((hash, value, index) => hash | ((value >= mean ? 1 : 0) << index), 0n).toString(16).padStart(16, '0');
}

/** Computes an aHash-compatible perceptual fingerprint for PNGs. Other formats remain explicit null. */
export function perceptualHash(bytes, mime) {
  if (!/^image\/png$/iu.test(mime)) return null;
  try {
    const png = PNG.sync.read(bytes);
    return averageHashFromPixels(png.data, png.width, png.height);
  } catch { return null; }
}

function extForMime(mime) {
  return ({'image/jpeg': 'jpg', 'image/png': 'png', 'image/tiff': 'tif', 'image/webp': 'webp'})[mime] ?? 'bin';
}

function iiifImageUrl(value) {
  const url = first(value);
  if (!url) return '';
  return /\.(?:jpg|jpeg|png)(?:\?|$)/iu.test(url) ? url : `${url.replace(/\/$/u, '')}/full/full/0/default.jpg`;
}

async function jsonFetch(url, {headers = {}, timeoutMs = 45_000} = {}) {
  const response = await fetch(url, {signal: AbortSignal.timeout(timeoutMs), headers: {Accept: 'application/json', ...headers}});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function htmlFetch(url, {timeoutMs = 45_000} = {}) {
  const response = await fetch(url, {signal: AbortSignal.timeout(timeoutMs), headers: {Accept: 'text/html'}});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

function meta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'iu'));
  return match?.[1] ?? '';
}

function htmlTitle(html) {
  return first(meta(html, 'og:title'), html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/iu)?.[1], html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]);
}

function htmlImage(html, base) {
  const value = first(meta(html, 'og:image'), html.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/iu)?.[1]);
  return absoluteUrl(value, base);
}

function htmlLinks(html, base) {
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/giu)]
    .map(match => absoluteUrl(match[1], base)).filter(Boolean);
}

function asString(value) {
  return typeof value === 'string' ? value : text(value);
}

async function* collectWikimedia(query, limit, context) {
  let continueToken = '';
  let yielded = 0;
  while (yielded < limit) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query'); url.searchParams.set('format', 'json'); url.searchParams.set('formatversion', '2');
    url.searchParams.set('generator', 'search'); url.searchParams.set('gsrsearch', query); url.searchParams.set('gsrnamespace', '6'); url.searchParams.set('gsrlimit', String(Math.min(50, limit - yielded)));
    url.searchParams.set('prop', 'imageinfo'); url.searchParams.set('iiprop', 'url|size|mime|extmetadata|sha1');
    if (continueToken) url.searchParams.set('gsroffset', continueToken);
    const data = await jsonFetch(url, context);
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0]; const metadata = info?.extmetadata ?? {};
      if (!info?.url) continue;
      yielded += 1;
      yield normalizeRecord({sourceId: page.pageid, sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%3A/iu, ':')}`, title: page.title.replace(/^File:/iu, ''), description: first(metadata.ImageDescription?.value, metadata.ObjectName?.value), imageUrl: info.url, imageMime: info.mime, license: first(metadata.LicenseShortName?.value, metadata.UsageTerms?.value), licenseUrl: metadata.LicenseUrl?.value, rights: metadata.UsageTerms?.value, copyrightNote: first(metadata.Artist?.value, metadata.Credit?.value), raw: page}, 'wikimedia');
      if (yielded >= limit) break;
    }
    continueToken = data.continue?.gsroffset;
    if (!continueToken || !(data.query?.pages?.length)) break;
  }
}

async function* collectMet(query, limit, context) {
  const data = await jsonFetch(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`, context);
  for (const id of (data.objectIDs ?? []).slice(0, limit)) {
    const record = await jsonFetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, context);
    yield normalizeRecord({sourceId: record.objectID, sourceUrl: record.objectURL, title: record.title, description: record.objectName, imageUrl: record.primaryImage, imageMime: 'image/jpeg', accessionNumber: record.accessionNumber, museum: 'The Metropolitan Museum of Art', license: record.isPublicDomain ? 'CC0' : '', rights: record.isPublicDomain ? 'Public Domain / Open Access' : '', copyrightNote: record.creditLine, culture: record.culture, classification: record.classification, raw: record}, 'met');
  }
}

async function* collectCleveland(query, limit, context) {
  const data = await jsonFetch(`https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 100)}`, context);
  for (const record of data.data ?? []) {
    const image = record.images?.full?.url ?? record.images?.full ?? record.images?.web?.url ?? record.images?.web ?? record.image_url ?? '';
    yield normalizeRecord({sourceId: record.id, sourceUrl: record.url ?? `https://www.clevelandart.org/art/${record.accession_number ?? record.id}`, title: record.title, description: record.tombstone, imageUrl: image, accessionNumber: record.accession_number, museum: 'Cleveland Museum of Art', license: record.share_license_status, rights: record.share_license_status, copyrightNote: record.creditline, subjects: record.type, raw: record}, 'cleveland');
  }
}

function findValues(value, wanted, result = []) {
  if (!value || result.length > 20) return result;
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (wanted.test(key) && typeof child === 'string') result.push(child);
      findValues(child, wanted, result);
    }
  }
  return result;
}

function findImageUrls(value, result = []) {
  if (!value || result.length > 20) return result;
  if (typeof value === 'string' && /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png)(?:[/?]|$)/iu.test(value)) result.push(value);
  else if (typeof value === 'string' && /https?:\/\/media\.getty\.edu\/iiif\/image\//iu.test(value)) result.push(`${value.replace(/\/$/u, '')}/full/full/0/default.jpg`);
  else if (typeof value === 'object') for (const child of Object.values(value)) findImageUrls(child, result);
  return result;
}

async function* collectSmithsonian(query, limit, context) {
  const key = process.env.SMITHSONIAN_API_KEY;
  if (!key) throw new Error('Для Smithsonian задайте переменную SMITHSONIAN_API_KEY');
  const url = `https://api.si.edu/openaccess/api/v1.0/search?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}&rows=${Math.min(limit, 100)}`;
  const data = await jsonFetch(url, context);
  for (const row of data.response?.rows ?? []) {
    const content = row.content ?? row;
    const media = row.online_media?.media ?? [];
    const mediaRecord = media.find(item => item.content || item.url || item.idsId);
    const image = first(mediaRecord?.content, mediaRecord?.url, row.online_media?.media?.[0]?.content);
    const rights = first(mediaRecord?.usage_rights, mediaRecord?.usage, row.media_usage, ...findValues(row, /rights|usage/iu));
    yield normalizeRecord({sourceId: row.id, sourceUrl: row.url ?? `https://www.si.edu/object/${encodeURIComponent(row.id ?? '')}`, title: first(content.title, row.title), description: first(content.description, content.notes), imageUrl: image, imageMime: 'image/jpeg', accessionNumber: first(content.accession_number, row.accession_number), museum: 'Smithsonian Institution', license: rights, rights, copyrightNote: first(content.credit_line, row.credit_line), subjects: first(content.topic, content.object_type, row.topic), raw: row}, 'smithsonian');
  }
}

async function* collectNationalmuseum(query, limit, context, options) {
  const urls = (options.recordUrls ?? []).slice(0, limit);
  if (!urls.length) throw new Error('Nationalmuseum не имеет подтверждённого публичного API: передайте --record-url=https://... (один или несколько URL через запятую)');
  for (const sourceUrl of urls) {
    const html = await htmlFetch(sourceUrl, context);
    const body = text(html);
    const rights = /\bCC\s*BY-SA\b/iu.test(body) ? 'CC BY-SA' : /\bPD\b|public domain/iu.test(body) ? 'Public Domain' : '';
    yield normalizeRecord({sourceId: sourceUrl, sourceUrl, title: htmlTitle(html), description: meta(html, 'description'), imageUrl: htmlImage(html, sourceUrl), imageMime: 'image/jpeg', museum: 'Nationalmuseum Stockholm', license: rights, rights, copyrightNote: first(meta(html, 'author'), body.match(/(?:Photo|Fotograf)[^<]{0,180}/iu)?.[0]), raw: {url: sourceUrl}}, 'nationalmuseum');
  }
}

async function* collectNga(query, limit, context, options) {
  const data = options.input ? JSON.parse(await readFile(resolve(options.input), 'utf8')) : null;
  const objects = data ? (Array.isArray(data) ? data : data.records ?? []) : parseCsv(await (await fetch('https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/objects.csv', {signal: AbortSignal.timeout(context.timeoutMs)})).text());
  const images = data ? [] : parseCsv(await (await fetch('https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/published_images.csv', {signal: AbortSignal.timeout(context.timeoutMs)})).text());
  const imageByObject = new Map(images.filter(item => /^(?:1|true)$/iu.test(String(item.openaccess ?? item.openAccess))).map(item => [String(item.depictstmsobjectid ?? item.objectid), item]));
  let found = 0;
  for (const record of objects) {
    const image = data ? record : imageByObject.get(String(record.objectid));
    if (!image || (data && !/^(?:1|true)$/iu.test(String(record.openaccess ?? record.openAccess ?? '1')))) continue;
    if (!ICON_TERMS.test([record.title, record.classification, record.medium].map(text).join(' ')) && !String(query).toLowerCase().split(/\s+/u).some(term => term.length > 2 && [record.title, record.classification, record.medium].map(text).join(' ').toLowerCase().includes(term))) continue;
    found += 1;
    yield normalizeRecord({sourceId: record.uuid ?? record.objectid, sourceUrl: record.url ?? `https://www.nga.gov/collection/art-object-page.${record.objectid}.html`, title: record.title, description: record.medium, imageUrl: iiifImageUrl(image.iiifurl ?? image.iiifURL ?? record.imageUrl), imageMime: 'image/jpeg', accessionNumber: record.accessionnum ?? record.accessionNum, museum: 'National Gallery of Art', license: 'CC0', rights: 'NGA Open Access / Public Domain', copyrightNote: record.creditline, subjects: record.classification, raw: {object: record, image}}, 'nga');
    if (found >= limit) break;
  }
}

function parseCsv(csv) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"') { if (quoted && csv[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && csv[index + 1] === '\n') index += 1; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift()?.map(value => value.trim().toLowerCase()) ?? [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

async function* collectGetty(query, limit, context) {
  const endpoint = 'https://data.getty.edu/museum/collection/sparql';
  const terms = String(query).toLowerCase().split(/\s+/u).map(term => term.replace(/[^\p{L}\p{N}-]/gu, '')).filter(term => term.length > 2).slice(0, 6);
  const conditions = terms.map(term => `CONTAINS(LCASE(STR(?label)), "${term}")`).join(' || ') || 'true';
  const sparql = `PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> SELECT DISTINCT ?object WHERE { ?object a crm:E22_Human-Made_Object ; rdfs:label ?label . FILTER(${conditions}) } LIMIT ${Math.min(limit, 100)}`;
  const response = await fetch(endpoint, {method: 'POST', signal: AbortSignal.timeout(context.timeoutMs), headers: {'Accept': 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({query: sparql})});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${endpoint}`);
  const result = await response.json();
  for (const row of result.results?.bindings ?? []) {
    const objectUrl = row.object?.value;
    if (!objectUrl) continue;
    const record = await jsonFetch(objectUrl, {timeoutMs: context.timeoutMs, headers: {Accept: 'application/ld+json'}});
    const encoded = JSON.stringify(record);
    const imageUrl = first(...findImageUrls(record));
    const cc0 = /creativecommons\.org\/publicdomain\/zero\/1\.0\//iu.test(encoded);
    yield normalizeRecord({sourceId: objectUrl.split('/').pop(), sourceUrl: objectUrl, title: first(record._label, record.label, record.name), description: first(...findValues(record, /description/iu)), imageUrl, imageMime: 'image/jpeg', museum: 'Getty Museum', license: cc0 ? 'CC0' : '', rights: cc0 ? 'CC0 Open Content' : '', copyrightNote: first(...findValues(record, /credit|attribution/iu)), subjects: first(...findValues(record, /classification|subject/iu)), raw: record}, 'getty');
  }
}

async function* collectAic(query, limit, context) {
  const data = await jsonFetch(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&query[term][is_public_domain]=true&limit=${Math.min(limit, 100)}&fields=id,title,description,artist_display,date_display,medium_display,main_reference_number,credit_line,is_public_domain,image_id`, context);
  const base = data.config?.iiif_url ?? 'https://www.artic.edu/iiif/2';
  for (const record of data.data ?? []) {
    yield normalizeRecord({sourceId: record.id, sourceUrl: record.api_link ?? `https://www.artic.edu/artworks/${record.id}`, title: record.title, description: record.description, imageUrl: record.image_id ? `${base}/${record.image_id}/full/full/0/default.jpg` : '', imageMime: 'image/jpeg', accessionNumber: record.main_reference_number, museum: 'Art Institute of Chicago', license: record.is_public_domain ? 'CC0' : '', rights: record.is_public_domain ? 'Public Domain / Open Access' : '', copyrightNote: record.credit_line, raw: record}, 'aic');
  }
}

async function* collectWalters(query, limit, context, options) {
  const data = options.input ? JSON.parse(await readFile(resolve(options.input), 'utf8')) : null;
  if (!data) throw new Error('Walters API v1 закрыт. Передайте --input с официальным статическим JSON-экспортом Walters');
  for (const record of (Array.isArray(data) ? data : data.records ?? []).slice(0, limit)) {
    yield normalizeRecord({sourceId: record.id ?? record.objectid, sourceUrl: record.url ?? record.objectUrl, title: record.title, description: record.description, imageUrl: record.imageUrl ?? record.primaryImage ?? record.images?.[0]?.url, imageMime: record.mime ?? 'image/jpeg', accessionNumber: record.accessionNumber ?? record.accession_number, museum: 'Walters Art Museum', license: record.license ?? record.rights ?? record.sourceLicense, rights: record.rights ?? record.license, copyrightNote: record.creditLine, subjects: record.type ?? record.classification, raw: record}, 'walters');
  }
  void query; void context;
}

async function* collectEuropeana(query, limit, context) {
  const key = process.env.EUROPEANA_API_KEY;
  if (!key) throw new Error('Для Europeana задайте переменную EUROPEANA_API_KEY');
  const data = await jsonFetch(`https://api.europeana.eu/record/v2/search.json?query=${encodeURIComponent(query)}&reusability=open&media=true&rows=${Math.min(limit, 100)}&wskey=${encodeURIComponent(key)}`, context);
  for (const item of data.items ?? []) {
    const rights = first(item.rights, item.edmRights, item.proxy_dc_rights);
    yield normalizeRecord({sourceId: item.id, sourceUrl: item.guid ?? item.link, title: first(item.title, item.dcTitle), description: first(item.dcDescription, item.description), imageUrl: first(item.edmIsShownBy, item.edmHasView, item.edmObject), imageMime: 'image/jpeg', museum: first(item.dataProvider, item.provider), license: rights, rights, copyrightNote: first(item.credit, item.dcCreator), subjects: first(item.dcSubject, item.type), raw: item}, 'europeana');
  }
}

export async function* collectSource(source, query, limit, options = {}) {
  const context = {timeoutMs: options.timeoutMs ?? 45_000, headers: options.userAgent ? {'User-Agent': options.userAgent} : {}};
  const collectors = {wikimedia: collectWikimedia, met: collectMet, cleveland: collectCleveland, smithsonian: collectSmithsonian, nationalmuseum: collectNationalmuseum, nga: collectNga, getty: collectGetty, aic: collectAic, walters: collectWalters, europeana: collectEuropeana};
  const collector = collectors[source];
  if (!collector) throw new Error(`Неизвестный источник: ${source}. Допустимо: ${SOURCE_IDS.join(', ')}`);
  yield* collector(query, limit, context, options);
}

export async function readCatalog(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {schemaVersion: 1, records: {}, blobs: {}, lastRun: null}; throw error; }
}

export function duplicateFor(record, catalog) {
  const records = Object.values(catalog.records ?? {});
  return records.find(item => item.source === record.source && (item.sourceId ?? item.source_id) && (item.sourceId ?? item.source_id) === record.sourceId)
    ?? records.find(item => (item.sourceUrl ?? item.source_url) && (item.sourceUrl ?? item.source_url) === record.sourceUrl)
    ?? records.find(item => item.sha256 && record.sha256 && item.sha256 === record.sha256)
    ?? records.find(item => item.phash && record.phash && item.phash === record.phash);
}

export function duplicateAgainstExisting(record, catalog) {
  for (const [key, item] of Object.entries(catalog.records ?? {})) {
    for (const image of item.images ?? []) {
      if ((image.sourceUrl ?? image.source_url) && (image.sourceUrl ?? image.source_url) === record.sourceUrl) return {key, item, match: 'source-url'};
      if (image.sha256 && record.sha256 && image.sha256 === record.sha256) return {key, item, match: 'sha256'};
      if (image.phash && record.phash && image.phash === record.phash) return {key, item, match: 'phash'};
    }
  }
  for (const [key, item] of Object.entries(catalog.blobs ?? {})) {
    if (item.sha256 && record.sha256 && item.sha256 === record.sha256) return {key, item, match: 'sha256'};
    if (item.phash && record.phash && item.phash === record.phash) return {key, item, match: 'phash'};
  }
  return undefined;
}

export async function saveCatalog(file, catalog) {
  await mkdir(join(file, '..'), {recursive: true});
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(temporary, file);
}

export async function storeImage(record, outputDir, options = {}) {
  const response = await fetch(record.imageUrl, {signal: AbortSignal.timeout(options.timeoutMs ?? 60_000), headers: {Accept: 'image/*', ...(options.userAgent ? {'User-Agent': options.userAgent} : {})}});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${record.imageUrl}`);
  const mime = (response.headers.get('content-type') ?? record.imageMime ?? '').split(';')[0].toLowerCase();
  if (!/^image\/(?:jpeg|png|tiff|webp)$/u.test(mime)) throw new Error(`Неподдерживаемый формат ${mime}: ${record.imageUrl}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > (options.maxBytes ?? 80 * 1024 * 1024)) throw new Error(`Недопустимый размер файла: ${bytes.length}`);
  const sha256 = hashBytes(bytes);
  const relativePath = join('originals', `${sha256}.${extForMime(mime)}`);
  const absolutePath = join(outputDir, relativePath);
  if (!existsSync(absolutePath)) { await mkdir(join(outputDir, 'originals'), {recursive: true}); await writeFile(absolutePath, bytes, {flag: 'wx'}).catch(error => { if (error.code !== 'EEXIST') throw error; }); }
  return {path: relativePath.replaceAll('\\', '/'), sha256, bytes: bytes.length, mime, phash: perceptualHash(bytes, mime)};
}

export async function appendLog(file, entry) {
  await mkdir(join(file, '..'), {recursive: true});
  await appendFile(file, `${JSON.stringify({at: new Date().toISOString(), ...entry})}\n`);
}

export function cliArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...parts] = arg.slice(2).split('=');
    result[key] = parts.join('=') || true;
  }
  return result;
}

export function isMain(metaUrl) {
  return metaUrl === pathToFileURL(process.argv[1]).href;
}
