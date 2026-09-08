import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { slavonicSourceKey, type SlavonicCorpusEntry } from "../src/calendar/localization/slavonic-corpus";
import { churchSlavonicTechnicalIssues } from "./lib/calendar-source-audit";

// Text-data extraction, NOT a translation algorithm or a scholarly approval.
// Modified source catalogue is distributed under its upstream GPL-3.0-or-later.
// Exact parallel titles only. Russian fallbacks and damaged forms are excluded.
const revision = "0af645f438856f45c22026912d2e4a9ce495e531";
const root = resolve(process.argv[2] ?? "tmp/ponomar-source");
const output = resolve("public/data/church-slavonic");
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseAttributeValue: false });
interface Name { text: string; condition?: string }
interface Source { cid: string; ru: Name[]; cu: Name[]; cuUrl?: string; cuSha256?: string }
const sources: Source[] = JSON.parse(readFileSync("tmp/xml-independent-audit/source-names.json", "utf8"));
const editorial = JSON.parse(readFileSync(join(output, "editorial-corrections.json"), "utf8")) as {
  corrections: { sourceId: string; before: string; after: string }[];
};
for (const correction of editorial.corrections) {
  const source = sources.find(s => s.cid === correction.sourceId);
  const matches = source?.cu.filter(name => name.text === correction.before) ?? [];
  if (matches.length !== 1) throw new Error(`Editorial source drift: ${correction.sourceId}`);
  matches[0]!.text = correction.after;
}
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const titles = new Set(parseMemoryDaysXml(xml).records.filter(r => r.typeCode < 200 && ![10, 20, 100].includes(r.typeCode)).map(r => r.title));
const byRussian = new Map<string, { source: Source; cu: Name }[]>();
const excluded: { sourceId: string; reason: string; words?: string[] }[] = [];
for (const source of sources) {
  for (const ru of source.ru) {
    const paired = source.cu.filter(cu => cu.condition === ru.condition);
    if (paired.length !== 1 || !source.cuUrl) continue;
    const cu = paired[0]!;
    const issues = churchSlavonicTechnicalIssues(cu.text);
    // Any long unmarked lexical word may be an untranslated Russian fragment.
    // Do not repair it by automatic letter substitution or guessed stress.
    const unmarked = (cu.text.match(/[\p{L}\p{M}]+/gu) ?? []).filter(word =>
      word.length >= 4 && /[аеёиоуыэюяѣѧѫѡꙋєіїѵѳ]/iu.test(word) && !/\p{M}/u.test(word)
      && !/^[IVXLCDM]+$/u.test(word));
    if (issues.length || unmarked.length) {
      excluded.push({ sourceId: source.cid, reason: issues.join(",") || "unmarked-lexical-word", ...(unmarked.length ? { words: unmarked } : {}) });
      continue;
    }
    // Arabic historical years and group sizes must not disappear or change.
    if (JSON.stringify(ru.text.match(/\d+/gu) ?? []) !== JSON.stringify(cu.text.match(/\d+/gu) ?? [])) {
      excluded.push({ sourceId: source.cid, reason: "numeric-annotation-disagreement" }); continue;
    }
    const key = slavonicSourceKey(ru.text);
    byRussian.set(key, [...(byRussian.get(key) ?? []), { source, cu }]);
  }
}
const entries: SlavonicCorpusEntry[] = [];
const missing: string[] = [];
for (const ru of titles) {
  const candidates = byRussian.get(slavonicSourceKey(ru)) ?? [];
  const forms = new Set(candidates.map(c => c.cu.text));
  if (forms.size !== 1) { missing.push(ru); continue; }
  const chosen = candidates[0]!;
  entries.push({ ru, cu: chosen.cu.text, sourceId: chosen.source.cid, sourceUrl: chosen.source.cuUrl! });
}
entries.sort((a, b) => a.ru.localeCompare(b.ru, "ru"));
const catalogue = {
  schemaVersion: 1, language: "cu", license: "GPL-3.0-or-later",
  copyright: "Copyright 2006–2018 Aleksandr Andreev and others. Source: Ponomar.",
  sourceRevision: revision, modified: "2026-09-08",
  modificationNotice: "Selected exact Russian/Church Slavonic parallel NAME fields; incomplete, unmarked and damaged candidates excluded. Explicit grammatical corrections documented separately. No upstream source code included. This catalogue is not a complete or independently philologically certified translation.",
  licenseFile: "COPYING", sourceFile: "sources.json", correctionFile: "editorial-corrections.json", entries,
};
const used = new Set(entries.map(e => e.sourceId));
// Preferred editable source includes the parallel NAME records and provenance,
// not whole lives, liturgical services or executable upstream program code.
const sourceRecords = [...used].sort().map(cid => {
  const fields = (lang: string) => {
    const text = readFileSync(join(root, `Ponomar/languages/${lang}/xml/lives/${cid}.xml`), "utf8");
    return { sha256: createHash("sha256").update(text).digest("hex"), names: [...text.matchAll(/<NAME\b(?:[^>"']|"[^"]*"|'[^']*')*>/gu)].map(m => parser.parse(m[0]).NAME) };
  };
  return { cid, ru: fields("cu/ru"), cu: fields("cu") };
});
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "catalogue.json"), JSON.stringify(catalogue, null, 2) + "\n");
writeFileSync(join(output, "sources.json"), JSON.stringify({ license: catalogue.license, copyright: catalogue.copyright,
  sourceRevision: revision, modified: catalogue.modified, records: sourceRecords }, null, 2) + "\n");
writeFileSync(join(output, "COPYING"), readFileSync(join(root, "LICENSE")));
writeFileSync("docs/audit-data/slavonic-catalogue-selection-2026-09-08.json", JSON.stringify({
  xmlSha256: createHash("sha256").update(xml).digest("hex"), included: entries.length, missing: missing.length,
  method: "exact-parallel-source-selection-with-technical-filters", philologicallyCertified: false, excluded, missingTitles: missing,
}, null, 2) + "\n");
console.log(JSON.stringify({ included: entries.length, missing: missing.length, excludedSourceCandidates: excluded.length }));
