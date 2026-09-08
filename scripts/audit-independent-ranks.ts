import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { evidenceText, normalizeEvidence } from "./lib/calendar-source-audit";

// Source images are identified by both file and alt text. No rank is inferred
// from font colour, paragraph class, feast name or a missing source image.
const sourceSigns: Record<number, { typeCodes: number[]; alt: string }> = {
  1: { typeCodes: [7], alt: "Cовершается служба, не отмеченная в Типиконе никаким знаком" },
  2: { typeCodes: [6], alt: "Совершается служба на шесть" },
  3: { typeCodes: [5], alt: "Совершается служба со славословием" },
  4: { typeCodes: [4], alt: "Совершается служба с полиелеем" },
  5: { typeCodes: [3], alt: "Совершается всенощное бдение" },
  6: { typeCodes: [1, 2], alt: "Совершается служба великому празднику" },
};
interface Evidence { url: string; oldStyle: string; pageSha256: string; memoriesHtml: string }
interface Sign { icon: number; alt: string; text: string; paragraph: number }
const snapshots = new Map<string, Evidence & { signs: Sign[] }>();
const directory = "tmp/xml-independent-audit/pravoslavie-days";
for (const file of readdirSync(directory).filter(file => /^\d{8}\.json$/u.test(file))) {
  const source: Evidence = JSON.parse(readFileSync(`${directory}/${file}`, "utf8"));
  if (source.url !== `https://days.pravoslavie.ru/Days/${source.oldStyle}.html` || file !== `${source.oldStyle}.json`) {
    throw new Error(`Invalid source identity: ${file}`);
  }
  const signs: Sign[] = [];
  const paragraphs = [...source.memoriesHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/giu)];
  paragraphs.forEach((paragraph, index) => {
    const html = paragraph[1]!;
    const icons = [...html.matchAll(/<img\b[^>]*src="https:\/\/days\.pravoslavie\.ru\/cmn\/T(\d+)\.gif"[^>]*>/giu)];
    icons.forEach((icon, iconIndex) => {
      const number = Number(icon[1]);
      const alt = icon[0].match(/\balt="([^"]*)"/iu)?.[1] ?? "";
      if (!sourceSigns[number] || alt !== sourceSigns[number]!.alt) throw new Error(`Source sign changed: ${source.url}: T${number}/${alt}`);
      const start = icon.index! + icon[0].length;
      const end = icons[iconIndex + 1]?.index ?? html.length;
      signs.push({ icon: number, alt, text: evidenceText(html.slice(start, end)), paragraph: index + 1 });
    });
  });
  const key = `${Number(source.oldStyle.slice(4, 6))}-${Number(source.oldStyle.slice(6, 8))}`;
  if (snapshots.has(key)) throw new Error(`Duplicate date ${key}`);
  snapshots.set(key, { ...source, signs });
}
if (snapshots.size !== 366) throw new Error("Incomplete independent date snapshots");
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const dataset = parseMemoryDaysXml(xml);
const adjudications = JSON.parse(readFileSync("docs/audit-data/xml-source-adjudications-2026-09-08.json", "utf8")) as {
  decisions: { sourceIndex: number; currentTypeCode?: number; decision: string; source: string }[];
};
const rows = dataset.records.map(record => {
  const fixed = record.startMonth > 0 && record.startMonth === record.finishMonth && record.startDate === record.finishDate;
  const day = fixed ? snapshots.get(`${record.startMonth}-${record.startDate}`) : undefined;
  // Only a complete title at the START of a sign's text qualifies. A sign may
  // precede several unrelated commemorations; it must not leak to later names.
  const key = normalizeEvidence(record.title);
  const candidates = record.typeCode >= 1 && record.typeCode <= 7
    ? day?.signs.filter(sign => ` ${normalizeEvidence(sign.text)} `.startsWith(` ${key} `)) ?? []
    : [];
  const observed = [...new Set(candidates.map(candidate => candidate.icon))];
  const status = record.typeCode < 1 || record.typeCode > 7 ? "not-a-service-rank"
    : !fixed ? "conditional-or-range-needs-service-context"
      : !candidates.length ? "no-explicit-leading-sign-match"
        : observed.length !== 1 ? "ambiguous-source-signs"
          : sourceSigns[observed[0]!]!.typeCodes.includes(record.typeCode) ? "same-explicit-source-rank"
            : "explicit-rank-difference-needs-adjudication";
  const decision = adjudications.decisions.find(decision => decision.sourceIndex === record.sourceIndex && decision.currentTypeCode !== undefined);
  if (decision && decision.currentTypeCode !== record.typeCode) throw new Error(`Rank adjudication drift ${record.id}`);
  return { recordId: record.id, sourceIndex: record.sourceIndex, title: record.title, typeCode: record.typeCode, status,
    ...(decision ? { rankAdjudication: { decision: decision.decision, source: decision.source, journal: "xml-source-adjudications-2026-09-08.json" } } : {}),
    evidence: candidates.map(candidate => ({ sourceUrl: day!.url, pageSha256: day!.pageSha256,
      paragraph: candidate.paragraph, sourceIcon: `T${candidate.icon}`, sourceAlt: candidate.alt })),
    editorialApproval: false };
});
const summary = { xmlSha256: createHash("sha256").update(xml).digest("hex"), totalRecords: rows.length,
  statuses: rows.reduce((counts, row) => { counts[row.status] = (counts[row.status] ?? 0) + 1; return counts; }, {} as Record<string, number>),
  notes: [
    "Explicit source icons only, paired with the complete leading title. Absence of an icon is not proof of an ordinary service.",
    "A year-specific calendar's service sign may reflect a feast coincidence or local practice; no XML rank is changed automatically.",
    "T6 denotes a great feast without distinguishing the application's ranks 1 and 2. Equal icon is not full service-rank certification.",
    "The source also uses T1 as an explicit placeholder for no Typikon sign; it is not a six-stichera sign.",
  ] };
writeFileSync("docs/audit-data/typikon-rank-comparison-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
