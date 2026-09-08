import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { containsFullTitle, evidenceParagraphs, historicalNumbers } from "./lib/calendar-source-audit";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const dataset = parseMemoryDaysXml(xml);
const work = "tmp/xml-independent-audit";
const ponomar = JSON.parse(readFileSync(join(work, "ledger.json"), "utf8"));
if (ponomar.summary.xmlSha256 !== hash(xml)) throw new Error("Stale ledger: rerun build-xml-source-ledger.ts after XML changes");
const corrections = JSON.parse(readFileSync("docs/audit-data/xml-corrections-2026-09-08.json", "utf8"));
interface DayEvidence { url: string; oldStyle: string; fetchedAt: string; pageSha256: string; memoriesHtml: string }
const days = new Map<string, DayEvidence & { paragraphs: string[] }>();
for (const file of readdirSync(join(work, "pravoslavie-days")).filter(file => /^\d{8}\.json$/u.test(file))) {
  const source: DayEvidence = JSON.parse(readFileSync(join(work, "pravoslavie-days", file), "utf8"));
  if (source.url !== `https://days.pravoslavie.ru/Days/${source.oldStyle}.html` || file !== `${source.oldStyle}.json`
    || !/^[a-f\d]{64}$/u.test(source.pageSha256)) throw new Error(`Invalid source identity: ${file}`);
  const key = `${Number(source.oldStyle.slice(4, 6))}-${Number(source.oldStyle.slice(6, 8))}`;
  if (days.has(key)) throw new Error(`Ambiguous date snapshot: ${key}`);
  days.set(key, { ...source, paragraphs: evidenceParagraphs(source.memoriesHtml) });
}
for (let month = 1; month <= 12; month++) {
  for (let day = 1; day <= new Date(Date.UTC(2024, month, 0)).getUTCDate(); day++) {
    if (!days.get(`${month}-${day}`)?.paragraphs.length) throw new Error(`Missing independent day ${month}-${day}`);
  }
}
const rows = dataset.records.map((record, index) => {
  const previous = ponomar.rows[index];
  if (previous.recordId !== record.id || previous.title !== record.title) throw new Error(`Stale record ${record.id}`);
  const single = record.startMonth > 0 && record.startMonth === record.finishMonth && record.startDate === record.finishDate;
  const day = single ? days.get(`${record.startMonth}-${record.startDate}`) : undefined;
  const paragraphIndexes = day?.paragraphs.flatMap((paragraph, index) => containsFullTitle(paragraph, record.title) ? [index + 1] : []) ?? [];
  const fullTitle = paragraphIndexes.length > 0;
  const correction = corrections.changes.find((change: { sourceIndex: number }) => change.sourceIndex === record.sourceIndex);
  if (correction && correction.after !== record.title) throw new Error(`Correction drift ${record.id}`);
  const dateCorrection = corrections.dateChanges.find((change: { sourceIndex: number }) => change.sourceIndex === record.sourceIndex);
  const rankCorrection = corrections.rankChanges?.find((change: { sourceIndex: number }) => change.sourceIndex === record.sourceIndex);
  const descriptionCorrection = corrections.descriptionChanges?.find((change: { sourceIndex: number }) => change.sourceIndex === record.sourceIndex);
  const addition = corrections.addedRecords?.find((change: { sourceIndex: number }) => change.sourceIndex === record.sourceIndex);
  if (rankCorrection && rankCorrection.after !== record.typeCode) throw new Error(`Rank correction drift ${record.id}`);
  if (dateCorrection && Object.entries(dateCorrection.after).some(([key, value]) => record[key as keyof typeof record] !== value)) {
    throw new Error(`Date correction drift ${record.id}`);
  }
  return {
    recordId: record.id, sourceIndex: record.sourceIndex, title: record.title,
    rule: previous.rule,
    descriptionPresent: Boolean(record.description),
    structuralDiagnostics: dataset.diagnostics.filter(diagnostic => diagnostic.recordIndex === record.sourceIndex),
    pravoslavie: {
      status: !single ? "conditional-or-range-not-compared" : !day ? "date-not-found" : fullTitle ? "full-title-found-on-same-old-style-date" : "full-title-not-found-needs-review",
      ...(day ? { url: day.url, sourceDate: day.oldStyle, fetchedAt: day.fetchedAt, pageSha256: day.pageSha256, paragraphIndexes } : {}),
      historicalNumbersPresentInMatchedTitle: fullTitle && historicalNumbers(record.title).length > 0,
      rankStatus: "not-independently-adjudicated",
    },
    ponomar: {
      correspondence: previous.correspondence,
      candidates: previous.candidates.map((candidate: any) => ({
        cid: candidate.cid, exactNormalizedTitle: candidate.exactNormalizedTitle, sameFixedDate: candidate.sameFixedDate,
        unconditionalExact: candidate.unconditionalExact, sources: candidate.sources, hashes: candidate.hashes,
        titleNumberSequencesAgree: candidate.ru.some((name: { text: string }) =>
          JSON.stringify(historicalNumbers(name.text)) === JSON.stringify(historicalNumbers(record.title))),
        conditionalNames: candidate.ru.some((name: { condition?: string }) => Boolean(name.condition)),
      })),
    },
    correctionStatus: correction ? "title-correction-reviewed-see-change-ledger" : "unchanged",
    dateCorrectionStatus: dateCorrection ? "date-rule-correction-reviewed-see-change-ledger" : "unchanged",
    rankCorrectionStatus: rankCorrection ? "rank-correction-reviewed-see-change-ledger" : "unchanged",
    descriptionCorrectionStatus: descriptionCorrection ? "description-correction-reviewed-see-change-ledger" : "unchanged",
    addedRecordStatus: addition ? "documented-split-from-existing-group" : "original-record",
    editorialApproval: false,
  };
});
const count = (key: (row: typeof rows[number]) => string) => rows.reduce((result, row) => {
  const value = key(row); result[value] = (result[value] ?? 0) + 1; return result;
}, {} as Record<string, number>);
const summary = {
  date: "2026-09-08", xmlSha256: hash(xml), totalRecords: rows.length, independentDaySnapshots: days.size,
  pravoslavie: count(row => row.pravoslavie.status), ponomar: count(row => row.ponomar.correspondence),
  correctedTitles: corrections.changes.length,
  correctedDateRules: corrections.dateChanges.length,
  correctedRanks: corrections.rankChanges?.length ?? 0,
  correctedDescriptions: corrections.descriptionChanges?.length ?? 0,
  addedRecords: corrections.addedRecords?.length ?? 0,
  completeIndependentEditorialAudit: false,
  limitations: [
    "Every XML record has a row; automated textual coverage is not independent historical/philological approval.",
    "Different websites may share earlier sources and errors. Their agreement is not proof of independent editorial origin.",
    "Fixed old-style dates use snapshots for 2026 except February 29 (2024). Transfers in other years are not verified by these snapshots.",
    "No omission, rank, year or spelling is automatically corrected from fuzzy similarity or absence in another calendar.",
    "Readings, conditional/range rules, descriptions and disputed rank/year differences still require dedicated source adjudication.",
    "A full-title occurrence can be part of a larger group; it is not proof that every member of that group is represented in our XML.",
  ],
};
mkdirSync("docs/audit-data", { recursive: true });
writeFileSync("docs/audit-data/xml-independent-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
