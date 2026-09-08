import { readFileSync } from "node:fs";
import { parseOfficialCalendar, officialText } from "./lib/official-calendar-evidence";
const report = JSON.parse(readFileSync("docs/audit-data/official-calendar-comparison-2026-09-08.json", "utf8"));
const identity = JSON.parse(readFileSync("docs/audit-data/commemoration-identity-evidence-2026-09-08.json", "utf8"));
const days = new Map(parseOfficialCalendar(readFileSync("tmp/xml-independent-audit/calendar_2026_0.txt", "utf8")).map(d => [`${d.oldMonth}-${d.oldDay}`, d]));
const offset = Number(process.argv[2] ?? 0), limit = Number(process.argv[3] ?? 40);
const ids = process.argv.find(a => a.startsWith("--ids="))?.slice(6).split(",").map(Number);
const rows = report.rows.filter((r: any) => ids ? ids.includes(r.sourceIndex) : r.status === "requires-editorial-review"
  && (!process.argv.includes("--both") || identity.rows.find((i: any) => i.sourceIndex === r.sourceIndex)?.status === "requires-editorial-review")
  && (!process.argv.includes("--numbers") || r.reviewCandidate?.missingTokens.some((w: string) => /^\d{3,4}$/u.test(w))));
console.log(`${rows.length} records in review subset`);
for (const r of rows.slice(offset, offset + limit)) {
  console.log(`${r.sourceIndex} ${r.oldStyleDate} OUR: ${r.title}`);
  console.log(`  MISSING: ${r.reviewCandidate?.missingTokens.join(" ")}`);
  if (process.argv.includes("--source")) console.log(`  SOURCE: ${officialText(days.get(r.oldStyleDate)?.paragraphs[(r.reviewCandidate?.paragraph ?? r.sourceParagraphs[0]) - 1] ?? "")}`);
}
