import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";

// Pipe the unmodified XML from git into stdin; never rewrites source files.
const before = parseMemoryDaysXml(readFileSync(0, "utf8"));
const after = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));
const ledger = JSON.parse(readFileSync("docs/audit-data/xml-corrections-2026-09-08.json", "utf8"));
const addedRecords = ledger.addedRecords ?? [];
assert.equal(after.records.length, before.records.length + addedRecords.length);
const dateFields = { startMonth: "s_month", startDate: "s_date", finishMonth: "f_month", finishDate: "f_date" } as const;
let changed = 0;
for (let index = 0; index < before.records.length; index++) {
  const original = before.records[index]!;
  const current = after.records[index]!;
  const expected = { ...original.raw };
  const title = ledger.changes.find((row: { sourceIndex: number }) => row.sourceIndex === original.sourceIndex);
  const date = ledger.dateChanges.find((row: { sourceIndex: number }) => row.sourceIndex === original.sourceIndex);
  const rank = ledger.rankChanges?.find((row: { sourceIndex: number }) => row.sourceIndex === original.sourceIndex);
  const description = ledger.descriptionChanges?.find((row: { sourceIndex: number }) => row.sourceIndex === original.sourceIndex);
  if (title) {
    assert.equal(original.title, title.before, `${original.id}: wrong before-title`);
    expected.name = title.after;
  }
  if (date) for (const [field, rawField] of Object.entries(dateFields)) {
    assert.equal(Number(original.raw[rawField]), date.before[field], `${original.id}: wrong before-date`);
    expected[rawField] = String(date.after[field]);
  }
  if (rank) {
    assert.equal(original.typeCode, rank.before, `${original.id}: wrong before-rank`);
    expected.type = String(rank.after);
  }
  if (description) {
    assert.equal(original.raw.discription, description.before, `${original.id}: wrong before-description`);
    expected.discription = description.after;
  }
  assert.deepEqual(current.raw, expected, `${original.id}: undocumented raw-field change`);
  if (title || date || rank || description) changed++;
}
for (const [offset, addition] of addedRecords.entries()) {
  const record = after.records[before.records.length + offset]!;
  assert.equal(record.sourceIndex, addition.sourceIndex);
  assert.equal(record.title, addition.title);
  assert.equal(record.typeCode, addition.typeCode);
  for (const field of Object.keys(dateFields)) assert.equal(record[field as keyof typeof record], addition[field]);
  assert.ok(addition.sources.length > 0);
}
console.log(`Verified ${after.records.length} records: ${changed} documented original-record changes, ${addedRecords.length} documented appended records, all other raw fields unchanged.`);
