import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { evidenceText } from "./lib/calendar-source-audit";

// Checks the existence and ordering of EVERY Bible chapter/verse reference in
// XML, against an independent Elizabethan Bible text. This does not approve
// the liturgical assignment of the reading to its date or service.
const books: Record<string, string> = { "Гал": "Gal", "Мф": "Mt", "Ин": "Jn", "Лк": "Lk", "Мк": "Mk",
  "1Кор": "I_Cor", "2Кор": "II_Cor", "Рим": "Rom", "Еф": "Eph", "Евр": "Heb", "Кол": "Col", "Иак": "Jas",
  "1Тим": "I_Tim", "2Тим": "II_Tim", "1Пет": "I_Pet", "2Пет": "II_Pet", "1Сол": "I_Thess", "2Сол": "II_Thess",
  "Иуд": "Jude", "Флп": "Philip", "Деян": "Acts", "Тит": "Tit", "Ис": "Isa", "Быт": "Gen", "Притч": "Prov",
  "Пс": "Psalm", "1Ин": "I_Jn", "2Ин": "II_Jn", "3Ин": "III_Jn" };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const bookData = new Map<string, Map<number, Set<number>>>();
const sourceManifest = Object.entries(books).map(([key, id]) => {
  const text = readFileSync(`tmp/ponomar-source/Ponomar/languages/cu/bible/elis/${id}.text`, "utf8");
  const chapters = new Map<number, Set<number>>();
  let chapter = 0;
  for (const line of text.split(/\r?\n/u)) {
    if (/^#\d+/u.test(line)) { chapter = Number(line.slice(1).trim()); chapters.set(chapter, new Set()); }
    const verse = /^(\d+)\|/u.exec(line);
    if (verse) chapters.get(chapter)?.add(Number(verse[1]));
  }
  bookData.set(key, chapters);
  return { key, id, sha256: hash(text), source: `https://github.com/typiconman/ponomar/blob/0af645f438856f45c22026912d2e4a9ce495e531/Ponomar/languages/cu/bible/elis/${id}.text` };
});
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const referenceKey = (text: string) => text.replace(/\s|\./gu, "").replace(/[–—]/gu, "-").replace(/;/gu, ",");
const lections = new Map<string, { source: string; lection: string }[]>();
const lectionarySources = ["apostle", "gospel"].map(id => {
  const source = JSON.parse(readFileSync(`tmp/xml-independent-audit/lectionary/${id}.json`, "utf8"));
  if (hash(source.html) !== source.sha256) throw new Error(`Source checksum mismatch: ${id}`);
  let extractedRows = 0;
  for (const row of source.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/giu)].map(cell => evidenceText(cell[1]!));
    if (!/зачало/iu.test(cells[0] ?? "") || !cells[1]) continue;
    const key = referenceKey(cells[1]);
    lections.set(key, [...(lections.get(key) ?? []), { source: source.url, lection: cells[0]! }]);
    extractedRows++;
  }
  if (extractedRows < 200) throw new Error(`Incomplete lectionary table: ${id}/${extractedRows}`);
  return { id, url: source.url, sha256: source.sha256, fetchedAt: source.fetchedAt, extractedRows };
});
const records = parseMemoryDaysXml(xml).records.filter(r => r.typeCode >= 200);
const rows = records.map(record => {
  const citations: { book: string; reference: string; issues: string[] }[] = [];
  const matches = [...record.title.matchAll(/((?:[123]\s*)?[А-ЯЁ][а-яё]+)\.\s*([\d\s:,–—-]+)/gu)];
  let remaining = record.title;
  for (const match of matches) {
    remaining = remaining.replace(match[0], "");
    const book = match[1]!.replace(/\s/gu, "");
    const reference = match[2]!.replace(/\s/gu, "").replace(/[–—]/gu, "-");
    const chapters = bookData.get(book);
    const issues: string[] = [];
    if (!chapters) issues.push("unknown-book");
    let currentChapter = 0;
    const check = (chapter: number, verse?: number) => {
      if (!chapters?.has(chapter)) issues.push(`missing-chapter:${chapter}`);
      else if (verse !== undefined && !chapters.get(chapter)!.has(verse)) issues.push(`missing-verse:${chapter}:${verse}`);
    };
    for (const segment of reference.split(",")) {
      if (!segment) { issues.push("empty-segment"); continue; }
      if (book === "Пс" && !reference.includes(":")) {
        const range = /^(\d+)(?:-(\d+))?$/u.exec(segment);
        if (!range) issues.push("invalid-psalm-range");
        else {
          const first = Number(range[1]), last = Number(range[2] ?? first);
          if (last < first) issues.push("reversed-psalm-range");
          for (let chapter = first; chapter <= last; chapter++) check(chapter);
        }
        continue;
      }
      const parts = /^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/u.exec(segment);
      if (!parts) { issues.push(`invalid-segment:${segment}`); continue; }
      const startChapter = Number(parts[1] ?? currentChapter), startVerse = Number(parts[2]);
      const endChapter = Number(parts[3] ?? startChapter), endVerse = Number(parts[4] ?? startVerse);
      if (!startChapter) { issues.push(`missing-initial-chapter:${segment}`); continue; }
      check(startChapter, startVerse); check(endChapter, endVerse);
      if (endChapter < startChapter || (endChapter === startChapter && endVerse < startVerse)) issues.push(`reversed-range:${segment}`);
      currentChapter = endChapter;
    }
    citations.push({ book, reference, issues: [...new Set(issues)] });
  }
  remaining = remaining.replace(/^Двенадцать Евангелий святых страстей Иисуса Христа:/u, "").replace(/[\s;,]/gu, "");
  return { sourceIndex: record.sourceIndex, title: record.title, citations,
    lectionaryMatches: lections.get(referenceKey(record.title)) ?? [],
    parseRemainder: remaining, referenceStatus: citations.length && !remaining && citations.every(c=>!c.issues.length) ? "references-exist" : "needs-review",
    liturgicalAssignmentStatus: "not-approved-by-reference-existence-check" };
});
const summary = { xmlSha256: hash(xml), records: rows.length, citations: rows.reduce((n,r)=>n+r.citations.length,0),
  completeReferenceScan: rows.length === records.length, issues: rows.filter(r=>r.referenceStatus!=="references-exist").length,
  fullReferenceFoundInLectionary: rows.filter(r=>r.lectionaryMatches.length).length,
  noLiteralLectionaryMatch: rows.filter(r=>!r.lectionaryMatches.length).length,
  note: "All scripture records checked. Existing verses alone do not validate a lection, chapter separator or service/date assignment." };
writeFileSync("docs/audit-data/scripture-reference-audit-2026-09-08.json", JSON.stringify({ summary, sources: sourceManifest, lectionarySources, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary));
console.log(JSON.stringify(rows.filter(r=>r.referenceStatus!=="references-exist"), null, 2));
