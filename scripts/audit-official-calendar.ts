import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { parseOfficialCalendar, officialTitleMatches, officialTokens } from "./lib/official-calendar-evidence";

const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const sourcePath = "tmp/xml-independent-audit/calendar_2026_0";
const source = { publisher: "Издательство Московской Патриархии", year: 2026,
  publicationUrl: "https://rop.ru/novosti/article_post/opublikovana-oficialnaya-kalendarnaya-setka-na-2026-god-dlya-obschecerkovnogo-ispolzovaniya",
  url: "https://rop.ru/d/3000/d/calendar_2026_0.doc", retrievedDate: "2026-09-08",
  sha256: hash(readFileSync(`${sourcePath}.doc`)), textSha256: hash(readFileSync(`${sourcePath}.txt`)),
  footnotesSha256: hash(readFileSync(`${sourcePath}.txt.footnotes.json`)),
  reuse: "Publisher permits calendar-base reuse with attribution to the Patriarchal Calendar. This report stores comparison results, not the full source publication." };
const days = parseOfficialCalendar(readFileSync(`${sourcePath}.txt`, "utf8"));
const dayMap = new Map(days.map(d => [`${d.oldMonth}-${d.oldDay}`, d]));
if (dayMap.size !== 365 || days.length !== 365) throw new Error("Official 2026 calendar must contain 365 distinct Julian days");
for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(Date.UTC(2026, m, 0)).getUTCDate(); d++) {
  if (!dayMap.has(`${m}-${d}`)) throw new Error(`Missing official date ${m}-${d}`);
}
const rows = parseMemoryDaysXml(xml).records.filter(r => r.typeCode < 200).map(record => {
  const fixed = record.startMonth > 0 && record.startMonth === record.finishMonth && record.startDate === record.finishDate;
  const day = fixed ? dayMap.get(`${record.startMonth}-${record.startDate}`) : undefined;
  const exact = day?.paragraphs.flatMap((p, i) => officialTitleMatches(p, record.title) ? [i + 1] : []) ?? [];
  const own = officialTokens(record.title);
  const candidates = day?.paragraphs.map((p, i) => {
    const counts = new Map<string, number>();
    for (const w of officialTokens(p)) counts.set(w, (counts.get(w) ?? 0) + 1);
    const missing = own.filter(w => { const n = counts.get(w) ?? 0; if (n) counts.set(w, n - 1); return !n; });
    return { paragraph: i + 1, missingTokens: missing, score: 1 - missing.length / own.length };
  }).sort((a, b) => b.score - a.score) ?? [];
  return { sourceIndex: record.sourceIndex, title: record.title,
    oldStyleDate: fixed ? `${record.startMonth}-${record.startDate}` : null,
    status: !fixed ? "requires-rule-evidence" : !day ? "leap-day-not-in-2026-source" : exact.length ? "complete-title-on-same-date" : "requires-editorial-review",
    sourceParagraphs: exact, reviewCandidate: !exact.length ? candidates[0] ?? null : null,
    editorialApproval: false };
});
const summary = { xmlSha256: hash(xml), officialDays: days.length, records: rows.length,
  statuses: rows.reduce((c, r) => { c[r.status] = (c[r.status] ?? 0) + 1; return c; }, {} as Record<string, number>),
  note: "Exact normalized full-title occurrence in a same-Julian-date official publication is textual evidence. Approximate alignment is only a review aid, never an approval. Font-encoded service symbols are not verified by plain-text extraction." };
writeFileSync("docs/audit-data/official-calendar-comparison-2026-09-08.json", JSON.stringify({ summary, source, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
