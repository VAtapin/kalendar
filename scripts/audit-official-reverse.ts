import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { julianToGregorian, toIsoDate } from "../src/calendar/date/calendar-date";
import { parseOfficialCalendar, officialTokens, officialText } from "./lib/official-calendar-evidence";

const sourcePath = "tmp/xml-independent-audit/calendar_2026_0.txt";
const source = readFileSync(sourcePath, "utf8"), xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const dataset = parseMemoryDaysXml(xml);
const years = new Map([2026, 2027].map(year => [year, buildOrthodoxCalendarYear(year, dataset)]));
const sourceDays = parseOfficialCalendar(source);
if (sourceDays.length !== 365) throw new Error("Incomplete official year");
const rows = sourceDays.flatMap(day => {
  const date = julianToGregorian({ year: 2026, month: day.oldMonth, day: day.oldDay });
  const isoDate = toIsoDate(date);
  const events = years.get(date.year)!.daysByIsoDate[isoDate]!.events.filter(e => e.typeCode < 200);
  return day.paragraphs.map((paragraph, index) => {
    const text = officialText(paragraph);
    // Keep ALL paragraphs in the ledger, including guidance and readings.
    // Excluding a paragraph from memory matching never deletes it from review.
    const section = /\bзач\.|(?:[IVXLC]+,\s*\d+)|^Утр\.|^Лит\. /u.test(text) ? "readings" :
      /^(?:Литургия |На (?:утрен|литурги|трапез)|После |Вечером |Совершается |В этот день |Венчание |Примечание)/u.test(text) ? "rubric" : "commemorations-or-heading";
    const words = officialTokens(text), covered = words.map(() => false);
    const matches: { sourceIndex: number; title: string; startToken: number; tokenCount: number }[] = [];
    if (section === "commemorations-or-heading") for (const event of events) {
      const title = officialTokens(event.title);
      for (let i = 0; i <= words.length - title.length; i++) {
        if (title.length && title.every((word, j) => words[i + j] === word)) {
          matches.push({ sourceIndex: event.sourceIndex, title: event.title, startToken: i, tokenCount: title.length });
          title.forEach((_, j) => { covered[i + j] = true; });
        }
      }
    }
    // A matched leading saint does not attest unnamed members or dates later
    // in that same paragraph. Residual text stays visible, without fuzzy approval.
    const residual = words.filter((_, i) => !covered[i]);
    return { isoDate, oldStyle: `${day.oldMonth}-${day.oldDay}`, paragraph: index + 1,
      section, text, matches, uncoveredTokens: residual,
      status: section !== "commemorations-or-heading" ? "separate-rubric-or-reading-review" :
        !residual.length ? "full-literal-coverage" : matches.length ? "partial-coverage-review-residual" : "no-full-title-match-review-required",
      editorialApproval: false };
  });
});
const summary = { sourceUrl: "https://rop.ru/d/3000/d/calendar_2026_0.doc", sourceYear: "Julian 2026",
  attribution: "Официальная календарная сетка: Издательство Московской Патриархии Русской Православной Церкви",
  sourceTextSha256: createHash("sha256").update(source).digest("hex"),
  xmlSha256: createHash("sha256").update(xml).digest("hex"), dates: sourceDays.length, paragraphs: rows.length,
  statuses: Object.fromEntries([...new Set(rows.map(r => r.status))].map(s => [s, rows.filter(r => r.status === s).length])),
  note: "Reverse exhaustive paragraph inventory, not editorial certification. Nonmatches include abbreviations, group structure, and genuine omissions. Every group residual must be reviewed; no inference from a single matched member." };
writeFileSync("docs/audit-data/official-reverse-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
