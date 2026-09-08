import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { createShortCalendarTitle } from "../src/calendar/presentation/title-variants";

// Independent source discovery, NOT automatic editorial approval or a corpus import.
// All source-derived working material remains in ignored tmp/. Every XML record
// gets an explicit row, including unmatched rules/readings and conditional dates.
const sourceRoot = resolve(process.argv[2] ?? "tmp/ponomar-source/Ponomar/languages");
const target = resolve(process.argv[3] ?? "tmp/xml-independent-audit");
const revision = "0af645f438856f45c22026912d2e4a9ce495e531";
const baseUrl = `https://github.com/typiconman/ponomar/blob/${revision}/Ponomar/languages/`;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseAttributeValue: false });
const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const normalized = (text: string) => text.normalize("NFD")
  .replace(/\p{M}/gu, "").toLocaleLowerCase("ru").replace(/ё/gu, "е").replace(/[^\p{L}\p{N}]/gu, "");
const tokens = (text: string) => new Set(createShortCalendarTitle(text).normalize("NFD")
  .replace(/\p{M}/gu, "").toLocaleLowerCase("ru").replace(/ё/gu, "е")
  .match(/[а-я]{4,}|\d{3,4}/gu) ?? []);
const similarity = (a: Set<string>, b: Set<string>) => 2 * [...a].filter(token => b.has(token)).length / Math.max(1, a.size + b.size);
const tags = (text: string, tag: string): Record<string, string>[] =>
  [...text.matchAll(new RegExp(`<${tag}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, "gu"))]
    .map(match => parser.parse(match[0])[tag] as Record<string, string>);
interface SourceName { text: string; condition?: string }
interface SourceRecord {
  cid: string; ru: SourceName[]; cu: SourceName[]; cuShort: SourceName[];
  ruUrl: string; cuUrl?: string; ruSha256: string; cuSha256?: string;
  dates: { month: number; day: number; condition?: string; source: string }[];
  services: Record<string, string>[];
}
const sources = new Map<string, SourceRecord>();
const xmlRoot = join(sourceRoot, "cu/xml");
const ruRoot = join(sourceRoot, "cu/ru/xml");
for (const file of readdirSync(join(ruRoot, "lives")).filter(file => file.endsWith(".xml")).sort()) {
  const ruXml = readFileSync(join(ruRoot, "lives", file), "utf8");
  const cuPath = join(xmlRoot, "lives", file);
  const cuXml = existsSync(cuPath) ? readFileSync(cuPath, "utf8") : undefined;
  const names = (text: string, field: string) => tags(text, "NAME").filter(tag => tag[field])
    .map(tag => ({ text: tag[field]!, ...(tag.Cmd ? { condition: tag.Cmd } : {}) }));
  sources.set(file.slice(0, -4), {
    cid: file.slice(0, -4), ru: names(ruXml, "Nominative"), cu: names(cuXml ?? "", "Nominative"),
    cuShort: names(cuXml ?? "", "Short"), ruUrl: `${baseUrl}cu/ru/xml/lives/${file}`,
    ...(cuXml ? { cuUrl: `${baseUrl}cu/xml/lives/${file}`, cuSha256: hash(cuXml) } : {}),
    ruSha256: hash(ruXml), dates: [], services: tags(cuXml ?? "", "SERVICE"),
  });
}
const indexIssues: string[] = [];
for (let month = 1; month <= 12; month++) {
  const folder = String(month).padStart(2, "0");
  for (const file of readdirSync(join(xmlRoot, folder)).filter(file => /^\d{2}\.xml$/u.test(file)).sort()) {
    const text = readFileSync(join(xmlRoot, folder, file), "utf8");
    for (const entry of tags(text, "SAINT")) {
      for (const cid of (entry.CId ?? "").split(",").map(value => value.trim()).filter(Boolean)) {
        const record = sources.get(cid);
        if (!record) { indexIssues.push(`${folder}/${file}: no Russian name record ${cid}`); continue; }
        record.dates.push({ month, day: Number(file.slice(0, 2)),
          ...(entry.Cmd ? { condition: entry.Cmd } : {}), source: `${baseUrl}cu/xml/${folder}/${file}` });
      }
    }
  }
}
const byDate = new Map<string, SourceRecord[]>();
const byTitle = new Map<string, SourceRecord[]>();
for (const record of sources.values()) {
  for (const date of record.dates) {
    const key = `${date.month}-${date.day}`;
    byDate.set(key, [...(byDate.get(key) ?? []), record]);
  }
  for (const name of record.ru) {
    const key = normalized(name.text);
    byTitle.set(key, [...(byTitle.get(key) ?? []), record]);
  }
}
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const dataset = parseMemoryDaysXml(xml);
const rows = dataset.records.map(record => {
  const fixedSingleDay = record.startMonth > 0 && record.startMonth <= 12
    && record.startDate > 0 && record.startDate <= 31
    && record.startMonth === record.finishMonth && record.startDate === record.finishDate;
  const titleKey = normalized(record.title);
  const ownTokens = tokens(record.title);
  const sameDate = fixedSingleDay ? byDate.get(`${record.startMonth}-${record.startDate}`) ?? [] : [];
  const exactAnywhere = byTitle.get(titleKey) ?? [];
  const candidates = [...new Map([...sameDate, ...exactAnywhere].map(source => [source.cid, source])).values()]
    .map(source => {
      const exactNames = source.ru.filter(name => normalized(name.text) === titleKey);
      const exactDates = source.dates.filter(date => date.month === record.startMonth && date.day === record.startDate);
      const score = Math.max(0, ...source.ru.map(name => similarity(ownTokens, tokens(name.text))));
      return { cid: source.cid, ru: source.ru, cu: source.cu, cuShort: source.cuShort,
        exactNormalizedTitle: exactNames.length > 0,
        sameFixedDate: fixedSingleDay && exactDates.length > 0,
        unconditionalExact: fixedSingleDay && exactNames.some(name => !name.condition) && exactDates.some(date => !date.condition),
        score, sources: { ru: source.ruUrl, cu: source.cuUrl },
        hashes: { ru: source.ruSha256, cu: source.cuSha256 }, dates: source.dates,
        serviceTypes: source.services,
        cuHasCombiningMarks: source.cu.some(name => /\p{M}/u.test(name.text)),
        cuIdenticalToRussian: source.cu.some(name => source.ru.some(ru => name.text === ru.text)),
      };
    }).filter(candidate => candidate.exactNormalizedTitle || candidate.score >= 0.2)
    .sort((a, b) => Number(b.exactNormalizedTitle) - Number(a.exactNormalizedTitle) || b.score - a.score).slice(0, 4);
  const exact = candidates.filter(candidate => candidate.exactNormalizedTitle && candidate.unconditionalExact);
  return {
    sourceIndex: record.sourceIndex, recordId: record.id, recordSha256: hash(JSON.stringify(record.raw)),
    title: record.title, description: record.description,
    rule: { startMonth: record.startMonth, startDate: record.startDate, finishMonth: record.finishMonth, finishDate: record.finishDate, type: record.typeCode },
    correspondence: exact.length === 1 ? "literal-title-and-fixed-date" : exact.length > 1 ? "ambiguous-literal-correspondence"
      : candidates.length ? "candidate-needs-review" : fixedSingleDay ? "no-candidate-in-this-source" : "rule-needs-independent-reference",
    editorialStatus: "not-approved", rankStatus: "not-verified", historicalYearsStatus: "not-verified", candidates,
  };
});
const summary = {
  xmlSha256: hash(xml), totalRecords: rows.length, externalNameFiles: sources.size,
  externalRecordsWithRussianTitle: [...sources.values()].filter(record => record.ru.length).length,
  externalRecordsWithCuTitle: [...sources.values()].filter(record => record.cu.length).length,
  externalRecordsWithMarkedCuTitle: [...sources.values()].filter(record => record.cu.some(name => /\p{M}/u.test(name.text))).length,
  correspondence: rows.reduce((count, row) => { count[row.correspondence] = (count[row.correspondence] ?? 0) + 1; return count; }, {} as Record<string, number>),
  allEditoriallyApproved: false, sourceRevision: revision,
  notice: "Source discovery only: literal correspondence is not independent editorial approval. Conditions are not evaluated; ranks are not assumed equivalent. Source translations are working references, not shipped data.",
};
mkdirSync(target, { recursive: true });
writeFileSync(join(target, "ledger.json"), JSON.stringify({ summary, indexIssues, rows }, null, 2));
writeFileSync(join(target, "source-names.json"), JSON.stringify([...sources.values()], null, 2));
console.log(JSON.stringify(summary, null, 2));
