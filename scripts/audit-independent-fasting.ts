import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { calculateFastingDay } from "../src/calendar/fasting/fasting-api";
import { julianToGregorian, toIsoDate } from "../src/calendar/date/calendar-date";
import { evidenceText } from "./lib/calendar-source-audit";

const dataset = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));
const calendars = new Map<number, ReturnType<typeof buildOrthodoxCalendarYear>>();
const rules: Record<string, string> = {
  "Из трапезы исключается мясо.": "dairy-eggs", "Поста нет.": "no-fast",
  "Пища с растительным маслом.": "oil", "Разрешается рыба.": "fish",
  "По монастырскому уставу - полное воздержание от пищи.": "total-abstinence-not-a-distinct-app-rule",
  "Монастырский устав: cухоядение (хлеб, овощи, фрукты).": "dry-eating",
  "Монастырский устав: сухоядение (хлеб, овощи, фрукты).": "dry-eating",
  "Разрешается рыбная икра.": "caviar-not-a-distinct-app-rule",
  "Монастырский устав: горячая пища без масла.": "boiled-no-oil",
};
const directory = "tmp/xml-independent-audit/pravoslavie-days";
const rows = readdirSync(directory).filter(file => /^\d{8}\.json$/u.test(file)).sort().map(file => {
  const source = JSON.parse(readFileSync(`${directory}/${file}`, "utf8"));
  const julian = { year: Number(source.oldStyle.slice(0, 4)), month: Number(source.oldStyle.slice(4, 6)), day: Number(source.oldStyle.slice(6, 8)) };
  const date = julianToGregorian(julian);
  const isoDate = toIsoDate(date);
  if (!calendars.has(date.year)) calendars.set(date.year, buildOrthodoxCalendarYear(date.year, dataset));
  const day = calendars.get(date.year)!.daysByIsoDate[isoDate]!;
  const label = evidenceText(source.fastingHtml ?? "");
  const observed = rules[label];
  const strict = calculateFastingDay(day, "typikon-strict");
  const parish = calculateFastingDay(day, "parish");
  return { isoDate, oldStyle: source.oldStyle, url: source.url, pageSha256: source.pageSha256,
    externalLabel: label || null, observedRule: observed ?? "not-classified",
    strict: strict.foodRule.id, parish: parish.foodRule.id,
    strictComparison: !observed ? "no-reference-rule" : observed === strict.foodRule.id ? "same-food-category" : "difference-needs-editorial-adjudication",
    parishComparison: !observed ? "no-reference-rule" : observed === parish.foodRule.id ? "same-food-category" : "different-profile-or-rule-needs-review",
    adjudicated: false };
});
if (rows.length !== 366) throw new Error(`Incomplete snapshot set (${rows.length}/366)`);
const hashFile = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const summary = { dates: rows.length,
  xmlSha256: hashFile("public/data/MemoryDays.xml"),
  fastingEngineSha256: hashFile("src/calendar/fasting/fasting-api.ts"),
  strict: rows.reduce((counts, row) => { counts[row.strictComparison] = (counts[row.strictComparison] ?? 0) + 1; return counts; }, {} as Record<string, number>),
  notes: ["Read-only comparison, not a decision to replace a Typikon or parish rule with a web-calendar's rule.",
    "Source old-style 2026 spans civil 2026/2027; February 29 uses 2024. This is not a complete civil-year 2027 audit.",
    "Caviar and complete abstinence are reported explicitly, never silently equated to fish, oil or dry eating."] };
writeFileSync("docs/audit-data/fasting-independent-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
