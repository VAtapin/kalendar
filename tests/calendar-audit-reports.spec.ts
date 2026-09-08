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
    "typikon-rank-comparison", "church-slavonic-coverage", "official-trapeza",
    "fasting-adjudications", "official-reverse", "reading-assignments", "weekday-gospel-cycle"]) {
    expect(read(name).summary.xmlSha256, name).toBe(hash);
  }
});

it("binds the whole-year weekday Gospel comparison to the actual selection engine", () => {
  const report = read("weekday-gospel-cycle");
  for (const [path, hash] of Object.entries(report.summary.engineSha256)) {
    expect(createHash("sha256").update(readFileSync(path, "utf8").replace(/\r\n/gu, "\n")).digest("hex"), path).toBe(hash);
  }
  expect(report.rows).toHaveLength(261);
  expect(new Set(report.rows.map((r: { date: string }) => r.date)).size).toBe(261);
  expect(report.rows.every((r: { selected: unknown[]; serviceAssignmentApproved: boolean }) =>
    r.selected.length <= 1 && !r.serviceAssignmentApproved)).toBe(true);
});

it("invalidates fasting evidence when the calculation engine changes", () => {
  const engineHash = createHash("sha256").update(readFileSync("src/calendar/fasting/fasting-api.ts")).digest("hex");
  for (const name of ["fasting-independent", "official-trapeza", "fasting-adjudications"]) {
    expect(read(name).summary.fastingEngineSha256, name).toBe(engineHash);
  }
});

it("retains every original fasting difference without claiming unconditional approval", () => {
  const report = read("fasting-adjudications");
  expect(report.summary.originalDatesAccountedFor).toBe(77);
  expect(new Set(report.rows.map((r: { isoDate: string }) => r.isoDate)).size).toBe(report.rows.length);
  expect(report.rows.filter((r: { originalDiscrepancy: boolean }) => r.originalDiscrepancy)).toHaveLength(77);
  for (const row of report.rows) {
    expect(row.sources.length).toBeGreaterThan(0);
    expect(row.unconditionalApproval).toBe(false);
  }
});

it("keeps all scripture records and reverse paragraphs visible without blanket approval", () => {
  const readings = read("reading-assignments"), reverse = read("official-reverse");
  expect(readings.rows.map((r: { sourceIndex: number }) => r.sourceIndex))
    .toEqual(records.filter(r => r.typeCode >= 200).map(r => r.sourceIndex));
  expect(readings.rows.every((r: { assignmentApproved: boolean }) => !r.assignmentApproved)).toBe(true);
  expect(reverse.rows).toHaveLength(1761);
  expect(new Set(reverse.rows.map((r: { isoDate: string }) => r.isoDate)).size).toBe(365);
  expect(reverse.rows.every((r: { editorialApproval: boolean }) => !r.editorialApproval)).toBe(true);
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
