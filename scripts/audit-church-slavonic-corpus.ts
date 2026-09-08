import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import fontkit from "@pdf-lib/fontkit";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { buildGeneratedLiturgicalEvents } from "../src/calendar/engine/liturgical-cycle";
import { createShortCalendarTitle, createVeryShortCalendarTitle } from "../src/calendar/presentation/title-variants";
import { calendarMonthName, calendarWeekdayLabels, calendarFoodRuleLabel, calendarOldStylePrefix,
  calendarMonasteryEventLabel, localizeCalendarEventTitleWithStatus } from "../src/calendar/localization/calendar-language";
import { FOOD_RULES, type FoodRuleId } from "../src/calendar/fasting/fasting-api";
import { churchSlavonicTechnicalIssues } from "./lib/calendar-source-audit";
import { installSlavonicCorpus } from "../src/calendar/localization/slavonic-corpus";
import { calendarCoverHeading } from "../src/calendar/localization/calendar-language";

installSlavonicCorpus(JSON.parse(readFileSync("public/data/church-slavonic/catalogue.json", "utf8")));

const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const dataset = parseMemoryDaysXml(xml);
const font = fontkit.create(readFileSync("public/fonts/MonomakhUnicode.ttf"));
const missingGlyphs = (text: string) => [...new Set([...text])].filter(character => !/\s/u.test(character)
  && !font.hasGlyphForCodePoint(character.codePointAt(0)!)).map(character => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
const entries = new Map<string, Set<string>>();
const add = (text: string, origin: string) => {
  if (!text.trim()) return;
  const origins = entries.get(text) ?? new Set<string>(); origins.add(origin); entries.set(text, origins);
};
for (const record of dataset.records) {
  add(record.title, `${record.id}:title`);
  add(createShortCalendarTitle(record.title), `${record.id}:shortTitle`);
  add(createVeryShortCalendarTitle(record.title), `${record.id}:veryShortTitle`);
  if (record.description) add(record.description, `${record.id}:description-not-currently-printed-by-grid`);
}
// Enumerate dynamic names too, including short/very-short layout alternatives.
// This range is explicit, not a claim about unbounded future changes to the engine.
for (let year = 1900; year <= 2199; year++) {
  for (const event of buildGeneratedLiturgicalEvents(year)) {
    add(event.title, "liturgical-cycle:title:1900-2199");
    if (event.shortTitle) add(event.shortTitle, "liturgical-cycle:shortTitle:1900-2199");
    if (event.veryShortTitle) add(event.veryShortTitle, "liturgical-cycle:veryShortTitle:1900-2199");
  }
}
const rows = [...entries].map(([source, origins]) => {
  const localized = localizeCalendarEventTitleWithStatus(source, "cu");
  return { source, origins: [...origins], currentCu: localized.title, localizationStatus: localized.status,
    technicalIssues: churchSlavonicTechnicalIssues(localized.title), missingGlyphs: missingGlyphs(localized.title),
    independentPhilologicalApproval: false };
});
const vocabulary: { origin: string; source: string; currentCu: string }[] = [];
for (let month = 1; month <= 12; month++) vocabulary.push({ origin: `month:${month}`, source: calendarMonthName(month, "ru"), currentCu: calendarMonthName(month, "cu") });
for (const short of [false, true]) calendarWeekdayLabels("ru", short).forEach((source, index) => vocabulary.push({
  origin: `weekday:${short ? "short" : "full"}:${index}`, source, currentCu: calendarWeekdayLabels("cu", short)[index]!,
}));
for (const rule of Object.keys(FOOD_RULES) as FoodRuleId[]) vocabulary.push({ origin: `food:${rule}`, source: calendarFoodRuleLabel(rule, "ru"), currentCu: calendarFoodRuleLabel(rule, "cu") });
vocabulary.push({ origin: "old-style-prefix", source: calendarOldStylePrefix("ru"), currentCu: calendarOldStylePrefix("cu") },
  { origin: "monastery-event-legend", source: calendarMonasteryEventLabel("ru"), currentCu: calendarMonasteryEventLabel("cu") },
  { origin: "cover-template:localized", source: calendarCoverHeading("ru"), currentCu: calendarCoverHeading("cu") },
  { origin: "new-text-element:editable-placeholder", source: "Новый текст", currentCu: "Новый текст" });
interface SourceName { text: string; condition?: string }
interface SourceRecord { cid: string; ru: SourceName[]; cu: SourceName[]; cuShort: SourceName[]; cuUrl?: string; cuSha256?: string }
const external: SourceRecord[] = JSON.parse(readFileSync("tmp/xml-independent-audit/source-names.json", "utf8"));
const externalIssues = external.flatMap(record => [
  ...record.cu.map((name, index) => ({ field: `Nominative:${index}`, name })),
  ...record.cuShort.map((name, index) => ({ field: `Short:${index}`, name })),
].flatMap(({ field, name }) => {
  const issues = churchSlavonicTechnicalIssues(name.text);
  const missing = missingGlyphs(name.text);
  if (record.ru.some(ru => ru.text === name.text)) issues.push("identical-to-russian-name");
  if (!issues.length && !missing.length) return [];
  // This diagnostic lists IDs/hashes rather than duplicating external text fields.
  return [{ cid: record.cid, field, url: record.cuUrl, sha256: record.cuSha256,
    conditional: Boolean(name.condition), issues, missingGlyphs: missing }];
}));
const summary = {
  date: "2026-09-08", xmlSha256: createHash("sha256").update(xml).digest("hex"),
  uniqueTextPayloads: rows.length, xmlRecords: dataset.records.length, generatedYearRange: [1900, 2199],
  localizationStatuses: rows.reduce((counts, row) => { counts[row.localizationStatus] = (counts[row.localizationStatus] ?? 0) + 1; return counts; }, {} as Record<string, number>),
  commemorationFullTitles: [...new Set(dataset.records.filter(record => record.typeCode < 200 && ![10, 20, 100].includes(record.typeCode)).map(record => record.title))]
    .reduce((counts, title) => { const status = localizeCalendarEventTitleWithStatus(title, "cu").status; counts[status] = (counts[status] ?? 0) + 1; return counts; }, {} as Record<string, number>),
  currentPayloadsWithMissingGlyphs: rows.filter(row => row.missingGlyphs.length).length,
  externalRecords: external.length, externalFieldsWithTechnicalIssues: externalIssues.length,
  completeChurchSlavonicTranslation: false,
  notes: [
    "Coverage includes raw XML rules/readings/descriptions as a superset; not every such entry is printed by the current grid.",
    "Short variants are audited even when currently suppressed for missing translation; a full title alone is insufficient.",
    "Technical success (cmap/combining marks) is not proof of correct accents, titla, grammar, saint identity or complete group membership.",
    "Selected exact source-parallel titles are loaded from a separately distributed GPL-3.0-or-later text catalogue with authorship, editable source fields and full license. No whole-application license change.",
    "Free text, publisher name, monastery events and text baked into uploaded/branding images are separate author-supplied content, not automatically translated.",
    "The cover title is localized; the editable new-text placeholder is explicitly recorded, not silently excluded from coverage.",
  ],
};
mkdirSync("docs/audit-data", { recursive: true });
writeFileSync("docs/audit-data/church-slavonic-coverage-2026-09-08.json", JSON.stringify({ summary,
  vocabulary: vocabulary.map(row => ({ ...row, technicalIssues: churchSlavonicTechnicalIssues(row.currentCu), missingGlyphs: missingGlyphs(row.currentCu) })),
  externalIssues, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
