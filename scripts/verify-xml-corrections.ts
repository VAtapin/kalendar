import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";

// Pipe the unmodified XML from git into stdin; never rewrites source files.
const before = parseMemoryDaysXml(readFileSync(0, "utf8"));
const after = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));
const ledger = JSON.parse(readFileSync("docs/audit-data/xml-corrections-2026-09-08.json", "utf8"));
assert.equal(after.records.length, before.records.length);
const dateFields = { startMonth: "s_month", startDate: "s_date", finishMonth: "f_month", finishDate: "f_date" } as const;
let changed = 0;
for (let index = 0; index < before.records.length; index++) {
  const original = before.records[index]!;
  const current = after.records[index]!;
  const expected = { ...original.raw };
  const title = ledger.changes.find((row: { sourceIndex: number }) => row.sourceIndex === original.sourceIndex);
  const date = ledger.dateChanges.find((row: { sourceIndex: number }) => row.sourceIndex === original.sourceIndex);
  if (title) {
    assert.equal(original.title, title.before, `${original.id}: wrong before-title`);
    expected.name = title.after;
  }
  if (date) for (const [field, rawField] of Object.entries(dateFields)) {
    assert.equal(Number(original.raw[rawField]), date.before[field], `${original.id}: wrong before-date`);
    expected[rawField] = String(date.after[field]);
  }
  assert.deepEqual(current.raw, expected, `${original.id}: undocumented raw-field change`);
  if (title || date) changed++;
}
console.log(`Verified ${after.records.length} records: ${changed} documented changes, all other raw fields unchanged.`);
