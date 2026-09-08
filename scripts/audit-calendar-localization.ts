import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import { calendarContentCategory } from "../src/calendar/presentation/calendar-content-policy";
import { calendarEventTitleLocalizationStatus, type CalendarTitleLocalizationStatus } from "../src/calendar/localization/calendar-language";
import type { CalendarLanguage } from "../src/document/types";
import { installSlavonicCorpus } from "../src/calendar/localization/slavonic-corpus";
installSlavonicCorpus(JSON.parse(readFileSync("public/data/church-slavonic/catalogue.json", "utf8")));

// Reproducible code-path coverage, NOT a claim that every translated name was checked against a source.
// Usage: npx tsx scripts/audit-calendar-localization.ts
const xml = readFileSync(new URL("../public/data/MemoryDays.xml", import.meta.url), "utf8");
const dataset = parseMemoryDaysXml(xml);
const commemorations = dataset.records.filter((record) => ![10, 20, 100].includes(record.typeCode) && record.typeCode < 200);
const counts = (titles: string[], language: CalendarLanguage) => titles.reduce((summary, title) => {
  summary[calendarEventTitleLocalizationStatus(title, language)]++;
  return summary;
}, { source: 0, exact: 0, structured: 0, "source-fallback": 0 } as Record<CalendarTitleLocalizationStatus, number>);
const years = [2026, 2027].map((year) => {
  const calendar = buildOrthodoxCalendarYear(year, dataset);
  const titles = [...new Set(calendar.days.flatMap((day) => day.events.filter((event) => calendarContentCategory(event) === "commemoration").map((event) => event.title)))];
  return { year, titles };
});
console.log(JSON.stringify({
  xmlSha256: createHash("sha256").update(xml).digest("hex"),
  recordCount: dataset.records.length,
  commemorationRecordCount: commemorations.length,
  excludedRuleOrReadingRecords: dataset.records.length - commemorations.length,
  meaning: "exact/structured identify dictionary/template coverage only; source-fallback preserves Russian records without pretending to translate names",
  languages: (["cu", "de", "uk", "pl"] as const).map((language) => ({
    language,
    allRecords: counts(dataset.records.map((record) => record.title), language),
    commemorationRecords: counts(commemorations.map((record) => record.title), language),
    uniqueCommemorationTitles: counts([...new Set(commemorations.map((record) => record.title))], language),
    runtimeUniqueCommemorationTitles: years.map(({ year, titles }) => ({ year, total: titles.length, ...counts(titles, language) })),
    examplesWithoutTranslation: commemorations.filter((record) => calendarEventTitleLocalizationStatus(record.title, language) === "source-fallback").slice(0, 5).map((record) => ({ sourceIndex: record.sourceIndex, title: record.title })),
  })),
}, null, 2));
