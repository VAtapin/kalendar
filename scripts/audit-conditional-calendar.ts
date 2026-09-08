import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { resolveMemoryDayRecord } from "../src/calendar/engine/resolve-record";
import { gregorianToJulian, julianToGregorian, toIsoDate } from "../src/calendar/date/calendar-date";
import { parseOfficialCalendar, officialTitleMatches, officialTokens } from "./lib/official-calendar-evidence";

const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const official = parseOfficialCalendar(readFileSync("tmp/xml-independent-audit/calendar_2026_0.txt", "utf8"));
const dateOf = (d: typeof official[number]) => toIsoDate(julianToGregorian({ year: 2026, month: d.oldMonth, day: d.oldDay }));
const rows = parseMemoryDaysXml(xml).records.filter(r => r.typeCode < 200 &&
  !(r.startMonth > 0 && r.startMonth === r.finishMonth && r.startDate === r.finishDate)).map(record => {
  const spans = [2026, 2027].flatMap(year => resolveMemoryDayRecord(record, year)).filter(s =>
    gregorianToJulian(s.start).year === 2026 || gregorianToJulian(s.finish).year === 2026);
  const exact = official.filter(d => d.paragraphs.some(p => officialTitleMatches(p, record.title)));
  const all = official.flatMap(d => d.paragraphs.map((p, index) => {
    const sourceWords = new Set(officialTokens(p));
    const ownWords = officialTokens(record.title);
    return { date: dateOf(d), oldStyleDate: `${d.oldMonth}-${d.oldDay}`, paragraph: index + 1,
      score: ownWords.filter(w => sourceWords.has(w)).length / ownWords.length };
  })).sort((a,b) => b.score - a.score);
  const engineSpans = spans.map(s => ({ start: toIsoDate(s.start), finish: toIsoDate(s.finish) }));
  const exactDates = exact.map(dateOf);
  return { sourceIndex: record.sourceIndex, title: record.title,
    rule: { startMonth: record.startMonth, startDate: record.startDate, finishMonth: record.finishMonth, finishDate: record.finishDate },
    engineSpans, sourceDatesWithFullTitle: exactDates,
    status: !engineSpans.length ? "not-active-in-source-year-requires-rule-review" : !exactDates.length ? "requires-editorial-rule-review" : exactDates.some(d => engineSpans.some(s => d >= s.start && d <= s.finish))
      ? "2026-occurrence-matches-not-all-years-proof" : "date-disagreement-requires-review",
    reviewCandidates: !exactDates.length ? all.slice(0, 2) : [], editorialApproval: false };
});
const summary = { xmlSha256: createHash("sha256").update(xml).digest("hex"), records: rows.length,
  statuses: rows.reduce((c,r) => { c[r.status] = (c[r.status] ?? 0) + 1; return c; }, {} as Record<string, number>),
  note: "All conditional/range non-scripture records included. One annual source is not proof of a rule in all years. Approximate candidates are never approval." };
writeFileSync("docs/audit-data/conditional-calendar-comparison-2026-09-08.json", JSON.stringify({ summary,
  source: "https://rop.ru/d/3000/d/calendar_2026_0.doc", rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(JSON.stringify(rows.filter(r => r.status === "date-disagreement-requires-review"), null, 2));
