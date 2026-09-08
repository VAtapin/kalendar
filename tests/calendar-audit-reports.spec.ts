import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";

const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const records = parseMemoryDaysXml(xml).records;
const hash = createHash("sha256").update(xml).digest("hex");
const read = (name: string) => JSON.parse(readFileSync(`docs/audit-data/${name}-2026-09-08.json`, "utf8"));

it("ties every independent report to this exact XML revision", () => {
  for (const name of ["xml-independent", "commemoration-identity-evidence", "official-calendar-comparison",
    "conditional-calendar-comparison", "scripture-reference-audit", "fasting-independent",
    "typikon-rank-comparison", "church-slavonic-coverage"]) {
    expect(read(name).summary.xmlSha256, name).toBe(hash);
  }
});

it("includes each XML record exactly once in the whole-file and rank reports", () => {
  for (const name of ["xml-independent", "typikon-rank-comparison"]) {
    expect(read(name).rows.map((row: { sourceIndex: number }) => row.sourceIndex))
      .toEqual(records.map(r => r.sourceIndex));
  }
  for (const name of ["commemoration-identity-evidence", "official-calendar-comparison"]) {
    expect(read(name).rows.map((row: { sourceIndex: number }) => row.sourceIndex))
      .toEqual(records.filter(r => r.typeCode < 200).map(r => r.sourceIndex));
  }
});

it("has exactly the conditional and range records, not just chosen sample dates", () => {
  expect(read("conditional-calendar-comparison").rows.map((row: { sourceIndex: number }) => row.sourceIndex))
    .toEqual(records.filter(r => r.typeCode < 200 && !(r.startMonth > 0 && r.startMonth === r.finishMonth
      && r.startDate === r.finishDate)).map(r => r.sourceIndex));
});

it("has unique documented changes whose before/after values really differ", () => {
  const changes = read("xml-corrections");
  for (const field of ["changes", "dateChanges", "rankChanges", "descriptionChanges"]) {
    const rows = changes[field];
    expect(new Set(rows.map((r: { sourceIndex: number }) => r.sourceIndex)).size, field).toBe(rows.length);
    for (const row of rows) {
      expect(JSON.stringify(row.before), `${field}/${row.sourceIndex}`).not.toBe(JSON.stringify(row.after));
      expect(row.sources.length).toBeGreaterThan(0);
      expect(records[row.sourceIndex - 1]?.sourceIndex).toBe(row.sourceIndex);
    }
  }
});
