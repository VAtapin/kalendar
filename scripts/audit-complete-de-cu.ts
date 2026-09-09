import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from '../src/calendar';
import { localizeCalendarEvent, localizeCalendarEventTitleWithStatus } from '../src/calendar/localization/calendar-language';
import { localizedReadingDescription } from '../src/calendar/localization/reading-descriptions';
import { installSlavonicCorpus } from '../src/calendar/localization/slavonic-corpus';
import type { ResolvedCalendarEvent } from '../src/calendar/types';

// Exhaustive code-path coverage, not an independent philological attestation.
// npx tsx scripts/audit-complete-de-cu.ts
const xml = readFileSync('public/data/MemoryDays.xml', 'utf8');
const dataset = parseMemoryDaysXml(xml);
installSlavonicCorpus(JSON.parse(readFileSync('public/data/church-slavonic/catalogue.json', 'utf8')));
const runtime = new Map<string, ResolvedCalendarEvent>();
let days = 0;
for (let year = 1900; year <= 2200; year++) {
  const calendar = buildOrthodoxCalendarYear(year, dataset);
  days += calendar.days.length;
  for (const day of calendar.days) for (const event of day.events) {
    runtime.set(JSON.stringify([event.title, event.shortTitle, event.veryShortTitle, event.description]), event);
  }
}
const commemorations = dataset.records.filter(r => ![10, 20, 100].includes(r.typeCode) && r.typeCode < 200);
const languages = (['de', 'cu'] as const).map(language => {
  const missingXml = dataset.records.filter(r => localizeCalendarEventTitleWithStatus(r.title, language).status === 'source-fallback').map(r => r.sourceIndex);
  const missingRuntime: string[] = [];
  const missingVariants: string[] = [];
  const missingDescriptions = [...new Set(dataset.records.flatMap(r => r.description && localizedReadingDescription(r.description, language) === r.description ? [r.description] : []))];
  for (const event of runtime.values()) {
    if (localizeCalendarEventTitleWithStatus(event.title, language).status === 'source-fallback') missingRuntime.push(event.title);
    const display = localizeCalendarEvent(event, language);
    for (const key of ['shortTitle', 'veryShortTitle'] as const) {
      if (event[key] && !display[key]) missingVariants.push(`${event.title}: ${key}`);
    }
  }
  return { language, missingXml, missingRuntime: [...new Set(missingRuntime)], missingVariants: [...new Set(missingVariants)], missingDescriptions };
});
const report = {
  scope: 'Technical translation coverage for all XML titles, all generated calendar years 1900–2200, display variants and lection occasion descriptions. Not independent certification of names, accents, dates or lection rules.',
  xmlSha256: createHash('sha256').update(xml).digest('hex'),
  xmlRecords: dataset.records.length,
  commemorationRecords: commemorations.length,
  uniqueFullCommemorationTitles: new Set(commemorations.map(r => r.title)).size,
  descriptions: dataset.records.filter(r => r.description).length,
  uniqueDescriptions: new Set(dataset.records.flatMap(r => r.description ? [r.description] : [])).size,
  years: { min: 1900, max: 2200, count: 301, days },
  runtimeTextCombinations: runtime.size,
  languages,
};
writeFileSync('docs/audit-data/translation-coverage-2026-09-09.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (languages.some(l => l.missingXml.length || l.missingRuntime.length || l.missingVariants.length || l.missingDescriptions.length)) process.exitCode = 1;
