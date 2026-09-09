#!/usr/bin/env node
// Offline review queue only. Never modifies the catalog or publishes an image.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'data/icon-library/catalog.json');
const xmlPath = path.join(root, 'public/data/MemoryDays.xml');
const outputPath = path.join(root, 'data/icon-library/mapping-candidates.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
export const normalize = value => String(value ?? '').normalize('NFC')
  .replace(/[\u0300\u0301\u0340\u0341]/gu, '').toLocaleLowerCase('ru').replace(/ё/gu, 'е')
  .replace(/[^а-яa-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ');
const stop = new Set(('икона иконы икон иконе иконой богородицы богородица богородице божией божьей матери матерь пресвятой пречистой святой святых святая святого прп прпп прмч прмчч мч мчч мц мцц сщмч сщмчч свт свтт ап апп св блаж блгв прав еп архиеп митр пресвитер пресвитера пресвитеров диакон диакона диаконов преподобный святитель мученик мученица священномученик новомученик царь императрица князь княгиня епископ архиепископ митрополит патриарх игумен иерей иеромонах инок пророк сын дочь именуемой празднование честь память обретение перенесение мощей собор списки чтимые ок после до в на с со и или у от по во из').split(' '));
const tokens = title => [...new Set(normalize(title).split(' ').filter(word => word.length >= 3 && !stop.has(word) && !/^\d+$/.test(word)))];
// Intentionally approximate Russian case endings: this creates suggestions, not identity assertions.
const stem = word => word.length < 5 ? word : word.replace(/(?:ского|скому|ским|ской|ских|ская|ский|ское|ские|ого|ему|ому|ыми|ими|ого|ая|яя|ый|ий|ой|ам|ям|ом|ем|ов|ев|а|я|ы|и|у|ю)$/u, '');
const isIconMemory = title => /икон[а-яё]*\s+(?:(?:Пресвятой|Пречистой)\s+)?(?:Богородиц[а-яё]*|Богоматер[а-яё]*|(?:Божией|Божьей)\s+Матери)/iu.test(title);

async function main() {
  const [catalogBytes, xmlBytes] = await Promise.all([fs.readFile(catalogPath), fs.readFile(xmlPath)]);
  const catalog = JSON.parse(catalogBytes);
  const xml = xmlBytes.toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid or unsupported XML');
  const parsed = new XMLParser({ parseTagValue: false, trimValues: true }).parse(xml);
  if (!Array.isArray(parsed.MemoryDays?.event)) throw new Error('No calendar records');
  const memories = parsed.MemoryDays.event.map((event, index) => ({
    sourceId: `memory-day-${String(index + 1).padStart(4, '0')}`,
    title: String(event.name),
    normalizedTitle: normalize(event.name),
    tokens: tokens(event.name),
    iconMemory: isIconMemory(event.name),
    rawCalendarRule: Object.fromEntries(['s_month', 's_date', 'f_month', 'f_date', 'type'].map(key => [key, event[key]])),
  }));
  const inverted = new Map();
  for (const memory of memories) {
    for (const token of new Set(memory.tokens.map(stem))) {
      if (!inverted.has(token)) inverted.set(token, []);
      inverted.get(token).push(memory);
    }
  }
  const records = Object.values(catalog.records).map(record => {
    const words = tokens(record.title);
    const pool = new Set(words.flatMap(word => inverted.get(stem(word)) ?? []));
    const matches = [];
    for (const memory of pool) {
      if ((record.kind === 'mother-of-god') !== memory.iconMemory) continue;
      const evidence = words.map(token => {
        const match = memory.tokens.find(candidate => candidate === token) ?? memory.tokens.find(candidate => stem(candidate) === stem(token));
        return match ? { sourceToken: token, calendarToken: match, method: token === match ? 'normalized-token-exact' : 'approximate-case-stem' } : null;
      }).filter(Boolean);
      const coverage = words.length ? evidence.length / words.length : 0;
      const exactTitle = normalize(record.title) === memory.normalizedTitle;
      // Shared epithets (e.g. Великий, Египетский) alone must not suggest another saint.
      if (record.kind !== 'mother-of-god' && !evidence.some(e => e.sourceToken === words[0])) continue;
      // Bare personal names can identify many different people. Preserve only rare exact names for review.
      const bareName = words.length === 1 && record.kind !== 'mother-of-god';
      const rareExactName = bareName && evidence.some(e => e.method === 'normalized-token-exact') && (inverted.get(stem(words[0]))?.length ?? 0) <= 3;
      if (!exactTitle && !(record.kind === 'mother-of-god' && evidence.length >= 1 && coverage >= 0.5)
        && !(evidence.length >= 2 && coverage >= 0.5) && !rareExactName) continue;
      const score = exactTitle ? 100 : Math.round(60 * coverage + 20 * evidence.filter(e => e.method === 'normalized-token-exact').length / Math.max(1, words.length) + Math.min(15, evidence.length * 3));
      matches.push({
        sourceId: memory.sourceId, sourceTitle: memory.title, rawCalendarRule: memory.rawCalendarRule,
        score, matchKind: exactTitle ? 'normalized-title-exact' : 'lexical-suggestion', evidence,
        warnings: [
          'Identity, image subject, calendar rule and publication rights require human review.',
          ...(bareName ? ['Personal name has no identifying epithet in source title.'] : []),
          ...(evidence.some(e => e.method === 'approximate-case-stem') ? ['Approximate case stemming can merge unrelated words.'] : []),
          ...(memory.tokens.length > words.length + 4 ? ['Calendar record may combine several commemorations.'] : []),
        ],
      });
    }
    matches.sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId));
    return {
      url: record.url, title: record.title, kind: record.kind, mappingStatus: 'unreviewed',
      publicationAllowed: false, rightsStatus: record.rightsStatus ?? 'unverified',
      candidateCount: matches.length, ambiguity: matches.length === 0 ? 'no-candidate' : matches.length === 1 ? 'single-unreviewed-candidate' : 'multiple-candidates',
      candidatesTruncated: matches.length > 8, candidates: matches.slice(0, 8),
    };
  });
  const summary = {
    indexedCards: records.length, calendarRecords: memories.length,
    withCandidates: records.filter(r => r.candidateCount > 0).length,
    singleCandidate: records.filter(r => r.candidateCount === 1).length,
    multipleCandidates: records.filter(r => r.candidateCount > 1).length,
    noCandidate: records.filter(r => r.candidateCount === 0).length,
    reviewedMappings: 0, publicationApproved: 0,
  };
  await fs.writeFile(outputPath, JSON.stringify({
    schemaVersion: 1, generatedAt: new Date().toISOString(), mode: 'offline-review-suggestions-only',
    sources: { catalog: 'data/icon-library/catalog.json', catalogSha256: sha256(catalogBytes), memoryDays: 'public/data/MemoryDays.xml', memoryDaysSha256: sha256(xmlBytes) },
    algorithm: 'Normalized titles/tokens; approximate Russian case suffixes; no fuzzy result is reviewed. IDs are 1-based XML positions and must always be checked with sourceTitle and XML hash. Raw calendar rules are not Gregorian dates. Candidate count includes all matches; at most eight shown.',
    summary, records,
  }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
