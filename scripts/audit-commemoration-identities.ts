import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { compareIdentityParagraph } from "./lib/commemoration-identity-evidence";

const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const days = new Map<string, { url: string; oldStyle: string; pageSha256: string; memoriesHtml: string }>();
for (const file of readdirSync("tmp/xml-independent-audit/pravoslavie-days").filter(f => /^\d{8}\.json$/u.test(f))) {
  const day = JSON.parse(readFileSync(`tmp/xml-independent-audit/pravoslavie-days/${file}`, "utf8"));
  if (day.url !== `https://days.pravoslavie.ru/Days/${day.oldStyle}.html` || file !== `${day.oldStyle}.json`) throw new Error(`Bad source ${file}`);
  days.set(`${Number(day.oldStyle.slice(4, 6))}-${Number(day.oldStyle.slice(6))}`, day);
}
const rows = parseMemoryDaysXml(xml).records.filter(r => r.typeCode < 200).map(record => {
  const fixed = record.startMonth > 0 && record.startMonth === record.finishMonth && record.startDate === record.finishDate;
  const day = fixed ? days.get(`${record.startMonth}-${record.startDate}`) : undefined;
  const comparisons = [...(day?.memoriesHtml ?? "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/giu)]
    .map((p, i) => ({ paragraph: i + 1, ...compareIdentityParagraph(record.title, p[1]!) }));
  const exact = comparisons.filter(p => p.completeTextMatch);
  return { sourceIndex: record.sourceIndex, title: record.title,
    status: !fixed ? "requires-rule-evidence" : exact.length ? "complete-text-with-source-linked-identities" : "requires-editorial-review",
    evidence: (exact.length ? exact : comparisons.filter(p => p.identities.length)).map(p => ({
      sourceUrl: day!.url, pageSha256: day!.pageSha256, paragraph: p.paragraph,
      completeTextMatch: p.completeTextMatch, identities: p.identities,
    })), editorialApproval: false };
});
const summary = { xmlSha256: createHash("sha256").update(xml).digest("hex"), records: rows.length,
  statuses: rows.reduce((c, r) => { c[r.status] = (c[r.status] ?? 0) + 1; return c; }, {} as Record<string, number>),
  note: "Uses the named saint link's canonical label to verify civil surnames before comparing the entire displayed title and its numbers on the same Julian date. No fuzzy match, omitted year, image tooltip or cross-date candidate is accepted. This is additional textual identity evidence, not historical/philological certification." };
writeFileSync("docs/audit-data/commemoration-identity-evidence-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
