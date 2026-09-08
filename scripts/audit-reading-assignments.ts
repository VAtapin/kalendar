import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { resolveMemoryDayRecord } from "../src/calendar/engine/resolve-record";
import { enumerateDates, gregorianToJulian, julianToGregorian, toIsoDate } from "../src/calendar/date/calendar-date";
import { parseOfficialCalendar } from "./lib/official-calendar-evidence";
import { xmlReadingService, officialReadingReferences, referenceKey } from "./lib/official-reading-evidence";

const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const sourceText = readFileSync("tmp/xml-independent-audit/calendar_2026_0.txt", "utf8");
const official = parseOfficialCalendar(sourceText).map(day => ({
  date: toIsoDate(julianToGregorian({ year: 2026, month: day.oldMonth, day: day.oldDay })),
  references: day.paragraphs.flatMap(officialReadingReferences),
}));
const records = parseMemoryDaysXml(xml).records.filter(r => r.typeCode >= 200);
const rows = records.map(record => {
  const service = xmlReadingService(record.typeCode);
  if (!service) throw new Error(`Unmapped service ${record.sourceIndex}/${record.typeCode}`);
  const engineDates = [...new Set([2026, 2027].flatMap(year => resolveMemoryDayRecord(record, year))
    .flatMap(span => enumerateDates(span.start, span.finish)).filter(date => gregorianToJulian(date).year === 2026).map(toIsoDate))].sort();
  const keys = record.title.split(";").map(referenceKey);
  const evidence = official.filter(day => engineDates.includes(day.date)).map(day => ({
    date: day.date, matches: keys.map(key => ({ key, references: day.references.filter(r => r.key === key && r.service === service) })),
  }));
  const complete = evidence.filter(day => day.matches.length > 0 && day.matches.every(m => m.references.length > 0));
  return { sourceIndex: record.sourceIndex, title: record.title, description: record.description ?? null,
    typeCode: record.typeCode, service, serviceMappingBasis: "XML type final digit; convention inferred from explicit feast/hour records, not editorial attestation",
    cycle: record.typeCode >= 300 ? "psalter" : record.typeCode < 210 ? "ordinary-or-triodion" : "feast-or-special",
    rule: { startMonth: record.startMonth, startDate: record.startDate, finishMonth: record.finishMonth, finishDate: record.finishDate },
    engineDates, evidence, status: !engineDates.length ? "not-active-in-reference-year" : complete.length === engineDates.length
      ? "same-date-and-service-text-evidence" : "requires-liturgical-assignment-review",
    assignmentApproved: false };
});
if (rows.length !== 1205) throw new Error("Reading inventory changed");
const summary = { records: rows.length, xmlSha256: createHash("sha256").update(xml).digest("hex"),
  sourceUrl: "https://rop.ru/d/3000/d/calendar_2026_0.doc", sourceTextSha256: createHash("sha256").update(sourceText).digest("hex"),
  sourceYear: "Julian 2026", parsedSourceReferences: official.reduce((n,d) => n + d.references.length, 0),
  statuses: Object.fromEntries([...new Set(rows.map(r => r.status))].map(s => [s, rows.filter(r => r.status === s).length])),
  note: "All 1205 records inventoried by service and engine date. Matching is reference evidence only; optional readings, transfers, ordering, omissions, and all-year Lukan/annual jumps are NOT approved by this report. The annual grid does not print the entire Psalter schedule." };
writeFileSync("docs/audit-data/reading-assignments-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
