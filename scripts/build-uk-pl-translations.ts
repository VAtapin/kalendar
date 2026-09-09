import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
const xml = readFileSync('public/data/MemoryDays.xml', 'utf8');
const batch = JSON.parse(readFileSync('scripts/data/uk-pl-translations.json', 'utf8')) as { xmlSha256: string; entries: [number, string, string][] };
if (createHash('sha256').update(xml).digest('hex') !== batch.xmlSha256) throw new Error('XML changed: review source indexes');
const records = parseMemoryDaysXml(xml).records;
const parts = ['066-900', '901-1730', '1731-2280', '2281-end', '2491-end'];
const entries = [...batch.entries, ...parts.flatMap(part => JSON.parse(readFileSync(`scripts/data/uk-pl-part-${part}.json`, 'utf8')) as [number, string, string][])].sort((a, b) => a[0] - b[0]);
const dictionaries: Record<'uk' | 'pl', Record<string, string>> = { uk: {}, pl: {} };
const seen = new Set<number>();
// The XML spelling «Р.X.» uses Latin X for Christ, not the Roman number ten.
const roman = (text: string) => text.replace(/Р\.X\./gu, '').match(/(?<![\p{L}\p{M}])[IVXLCDM]+(?![\p{L}\p{M}])/gu) ?? [];
for (const [index, uk, pl] of entries) {
  if (seen.has(index)) throw new Error(`Duplicate source index ${index}`);
  seen.add(index);
  const record = records.find(r => r.sourceIndex === index);
  if (!record) throw new Error(`Unknown XML record ${index}`);
  for (const [language, value] of [['uk', uk], ['pl', pl]] as const) {
    if (!value.trim() || JSON.stringify(value.match(/\d+/g) ?? []) !== JSON.stringify(record.title.match(/\d+/g) ?? [])) throw new Error(`Invalid ${language} translation ${index}`);
    if (JSON.stringify(roman(value)) !== JSON.stringify(roman(record.title))) throw new Error(`Changed Roman century in ${language} translation ${index}`);
    if (language === 'pl' && /\p{Script=Cyrillic}/u.test(value)) throw new Error(`Cyrillic in Polish ${index}`);
    // Repeated identical Russian titles share one translation, chosen deterministically
    // from their earliest XML occurrence. All source-index translations remain in the batches.
    if (Object.hasOwn(dictionaries[language], record.title)) continue;
    dictionaries[language][record.title] = value;
  }
}
const missing = records.filter(r => ![10, 20, 100].includes(r.typeCode) && r.typeCode < 200 && !Object.hasOwn(dictionaries.uk, r.title));
if (missing.length) throw new Error(`Missing ${missing.length} commemoration records: ${missing.map(r => r.sourceIndex).join(', ')}`);
for (const language of ['uk', 'pl'] as const) writeFileSync(`src/calendar/localization/${language}-commemorations.json`, JSON.stringify(dictionaries[language], null, 2) + '\n');
console.log(`Generated ${Object.keys(dictionaries.uk).length} Ukrainian and Polish titles`);
