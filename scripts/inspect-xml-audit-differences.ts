import { readFileSync } from "node:fs";
import { compareIdentityParagraph } from "./lib/commemoration-identity-evidence";
import { evidenceText, normalizeEvidence } from "./lib/calendar-source-audit";

// Human review aid only. Approximate alignment is NEVER an approval decision.
const rows = JSON.parse(readFileSync("docs/audit-data/commemoration-identity-evidence-2026-09-08.json", "utf8")).rows;
const records = JSON.parse(readFileSync("tmp/xml-independent-audit/ledger.json", "utf8")).rows;
const offset = Number(process.argv[2] ?? 0), limit = Number(process.argv[3] ?? 50);
for (const row of rows.filter((r: any) => r.status === "requires-editorial-review").slice(offset, offset + limit)) {
  const record = records[row.sourceIndex - 1];
  const year = record.rule.startMonth === 2 && record.rule.startDate === 29 ? 2024 : 2026;
  const date = `${year}${String(record.rule.startMonth).padStart(2, "0")}${String(record.rule.startDate).padStart(2, "0")}`;
  const day = JSON.parse(readFileSync(`tmp/xml-independent-audit/pravoslavie-days/${date}.json`, "utf8"));
  const candidates = [...day.memoriesHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/giu)].map((m: any) => {
    const own = compareIdentityParagraph(row.title, m[1]).titleWithoutVerifiedSurnames.split(" ");
    const source = normalizeEvidence(evidenceText(m[1]).replace(/\bC(?=щмч)/gu, "С")).split(" ");
    const counts = new Map<string, number>();
    for (const w of source) counts.set(w, (counts.get(w) ?? 0) + 1);
    const missing: string[] = [];
    for (const w of own) { const n = counts.get(w) ?? 0; if (!n) missing.push(w); else counts.set(w, n - 1); }
    return { source: evidenceText(m[1]), missing, score: 1 - missing.length / own.length };
  }).sort((a: any, b: any) => b.score - a.score);
  console.log(`${row.sourceIndex} ${record.rule.startMonth}/${record.rule.startDate} ${row.title}`);
  console.log(`  NOT FOUND: ${candidates[0]?.missing.join(" ")}`);
  if (process.argv.includes("--source")) console.log(`  SOURCE: ${candidates[0]?.source}`);
}
