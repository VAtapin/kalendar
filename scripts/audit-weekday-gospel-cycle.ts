import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { weekdayGospelSourceOffset } from "../src/calendar/engine/weekday-gospel-cycle";
import { dayOfWeek, julianToGregorian, toIsoDate } from "../src/calendar/date/calendar-date";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { parseOfficialCalendar } from "./lib/official-calendar-evidence";
import { officialReadingReferences, referenceKey } from "./lib/official-reading-evidence";

const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const source = readFileSync("tmp/xml-independent-audit/calendar_2026_0.txt", "utf8");
const dataset = parseMemoryDaysXml(xml);
const calendars = new Map([2026, 2027].map(year => [year, buildOrthodoxCalendarYear(year, dataset)]));
const rows = parseOfficialCalendar(source).flatMap(day => {
  const date = julianToGregorian({ year: 2026, month: day.oldMonth, day: day.oldDay });
  if ([0, 6].includes(dayOfWeek(date))) return [];
  const isoDate = toIsoDate(date);
  const readings = calendars.get(date.year)!.daysByIsoDate[isoDate]!.events.filter(e => e.typeCode === 207);
  const evidence = day.paragraphs.flatMap(officialReadingReferences)
    .filter(r => r.service === "liturgy" && /^(?:Мф|Мк|Лк|Ин)/u.test(r.key));
  const selected = readings.map(e => ({ sourceIndex: e.sourceIndex, title: e.title, keys: e.title.split(";").map(referenceKey) }));
  const allPresent = selected.length > 0 && selected.every(r => r.keys.every(key => evidence.some(e => e.key === key)));
  return [{ date: isoDate, sourceOffset: weekdayGospelSourceOffset(date), selected, evidence,
    status: selected.length === 0 ? "no-ordinary-weekday-gospel" : allPresent
      ? "reference-present-in-annual-grid" : "requires-service-transfer-or-source-review",
    serviceAssignmentApproved: false }];
});
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const enginePaths = ["src/calendar/engine/weekday-gospel-cycle.ts", "src/calendar/engine/royal-hours.ts", "src/calendar/engine/build-calendar-year.ts"];
const summary = {
  sourceUrl: "https://rop.ru/d/3000/d/calendar_2026_0.doc", sourceYear: "Julian 2026",
  sourceTextSha256: sha256(source), xmlSha256: sha256(xml),
  engineSha256: Object.fromEntries(enginePaths.map(path => [path, sha256(readFileSync(path, "utf8").replace(/\r\n/gu, "\n"))])),
  weekdays: rows.length, ordinarySlots: rows.reduce((n, r) => n + r.selected.length, 0),
  statuses: Object.fromEntries([...new Set(rows.map(r => r.status))].map(s => [s, rows.filter(r => r.status === s).length])),
  note: "Actual engine output for EVERY weekday in the reference year. Presence is not approval of a service: optional feast readings, suppressions and transfers require their own rubrics. This report does not attest Apostol, weekend, hourly or Psalter assignments.",
};
if (rows.length !== 261 || rows.some(r => r.selected.length > 1)) throw new Error("Incomplete weekday audit or duplicate ordinary Gospel");
writeFileSync("docs/audit-data/weekday-gospel-cycle-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
