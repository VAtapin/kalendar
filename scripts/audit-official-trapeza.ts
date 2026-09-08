import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseOfficialTrapeza, compareTrapezaCategory, type TrapezaExtraction } from "./lib/official-trapeza-evidence";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { calculateFastingDay } from "../src/calendar/fasting/fasting-api";
const hashFile = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const extraction: TrapezaExtraction = JSON.parse(readFileSync("tmp/xml-independent-audit/trapeza_2026.cells.json", "utf8"));
if (extraction.sha256 !== hashFile("tmp/xml-independent-audit/trapeza_2026.doc")) throw new Error("Source hash mismatch");
const calendar = buildOrthodoxCalendarYear(2026, parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8")));
const rows = parseOfficialTrapeza(extraction).map(row => {
  const day = calendar.daysByIsoDate[row.isoDate]!;
  const strict = calculateFastingDay(day, "typikon-strict"), parish = calculateFastingDay(day, "parish");
  return { ...row, strict: strict.foodRule.id, parish: parish.foodRule.id,
    strictComparison: compareTrapezaCategory(row.category, strict.foodRule.id),
    parishComparison: compareTrapezaCategory(row.category, parish.foodRule.id),
    strictReason: strict.reason, parishReason: parish.reason };
});
const summary = { civilYear: 2026, dates: rows.length, source: extraction.source,
  sourceSha256: extraction.sha256, xmlSha256: hashFile("public/data/MemoryDays.xml"),
  fastingEngineSha256: hashFile("src/calendar/fasting/fasting-api.ts"),
  strict: Object.fromEntries([...new Set(rows.map(r => r.strictComparison))].map(k => [k, rows.filter(r => r.strictComparison === k).length])),
  parish: Object.fromEntries([...new Set(rows.map(r => r.parishComparison))].map(k => [k, rows.filter(r => r.parishComparison === k).length])),
  scope: "All 365 civil dates. Colour legend and printed letters are independent evidence, not a replacement of the named profiles. Footnotes remain explicit. бм is not evidence of cooked food specifically." };
writeFileSync("docs/audit-data/official-trapeza-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
