import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { resolveMemoryDayRecord } from "../src/calendar/engine/resolve-record";
import { toIsoDate } from "../src/calendar/date/calendar-date";
import { calculateFastingDay } from "../src/calendar/fasting/fasting-api";
import { churchSlavonicTechnicalIssues, containsFullTitle, evidenceParagraphs, evidenceText } from "../scripts/lib/calendar-source-audit";

describe("independent source audit safeguards", () => {
  it("extracts displayed names, never hidden image alt/title attributes", () => {
    expect(evidenceParagraphs('<P class="DP_TEXT"><img alt="Different name">Свт. <a title="Житие">Кирилла</a> (444).</P>'))
      .toEqual(["Свт. Кирилла (444)."]);
    expect(evidenceText("Павла&nbsp;&amp; &#x41f;&#1072;влы")).toBe("Павла & Павлы");
  });
  it("does not mistake similar names, historical years or partial words for a full title", () => {
    expect(containsFullTitle("Свт. Кирилла (444).", "Свт. Кирилла (444)")).toBe(true);
    expect(containsFullTitle("Свт. Кири́лла (444).", "Свт. Кирилла (444)")).toBe(true);
    expect(containsFullTitle("Свт. Кирилла (444).", "Свт. Кирилла (344)")).toBe(false);
    expect(containsFullTitle("Павлы", "Павла")).toBe(false);
    expect(containsFullTitle("Свт. Кирилла (444).", "Кирилл")).toBe(false);
    expect(containsFullTitle("Свт. Кирилла", "")).toBe(false);
  });
  it("rejects damaged combining-mark sequences without calling a spellchecker a translator", () => {
    expect(churchSlavonicTechnicalIssues("С\u0099т҃о́е")).toContain("control-or-replacement-character");
    expect(churchSlavonicTechnicalIssues("сло́во \u0301")).toContain("detached-combining-mark");
    expect(churchSlavonicTechnicalIssues("а҆нтѡ́нїа (IV)")).toEqual([]);
    expect(churchSlavonicTechnicalIssues("test")).toContain("latin-letters");
    expect(churchSlavonicTechnicalIssues("русский текст")).toContain("no-combining-marks");
  });
});

describe("documented XML title corrections", () => {
  const dataset = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));
  const ledger = JSON.parse(readFileSync("docs/audit-data/xml-corrections-2026-09-08.json", "utf8"));
  it("keeps all source IDs stable and every correction traceable", () => {
    expect(dataset.records).toHaveLength(3811);
    expect(ledger.changes).toHaveLength(12);
    for (const correction of ledger.changes) {
      expect(dataset.records[correction.sourceIndex - 1]?.title).toBe(correction.after);
      expect(correction.before).not.toBe(correction.after);
      expect(correction.sources.length).toBeGreaterThan(0);
    }
  });
  it("keeps reviewed date rules in sync with the correction ledger", () => {
    expect(ledger.dateChanges).toHaveLength(5);
    for (const change of ledger.dateChanges) {
      const record = dataset.records[change.sourceIndex - 1]!;
      expect(record.title).toBe(change.title);
      for (const [field, value] of Object.entries(change.after)) expect(record[field as keyof typeof record]).toBe(value);
    }
  });
  it.each([[2019, "2019-01-26"], [2024, "2024-01-20"], [2026, "2026-01-24"], [2027, "2027-01-23"]] as const)
    ("places Pakhomius on the first Saturday strictly after Theophany in %i", (year, expected) => {
      const spans = resolveMemoryDayRecord(dataset.records[318]!, year);
      expect(spans.map(span => toIsoDate(span.start))).toEqual([expected]);
      expect(spans[0]!.finish).toEqual(spans[0]!.start);
    });
  it("corrects the four fixed dates without rewriting saints or their ranks", () => {
    for (const [index, expected] of [[1652, "2027-07-15"], [2208, "2027-12-29"], [2209, "2027-12-29"], [2210, "2027-12-29"]] as const) {
      expect(resolveMemoryDayRecord(dataset.records[index - 1]!, 2027).map(span => toIsoDate(span.start))).toEqual([expected]);
      expect(dataset.records[index - 1]!.typeCode).toBe(18);
    }
  });
  it("contains no orphaned conjunction or rank-only ending in a commemoration", () => {
    for (const record of dataset.records.filter(record => record.typeCode < 20)) {
      expect(record.title, record.id).not.toMatch(/^и\s|\s(?:мц|мч|мчч|прп|свт)\.$/u);
    }
  });
});

describe("independently identified preparation-week restriction", () => {
  it.each(["typikon-strict", "parish"] as const)("does not invent a Monday fast in %s", profile => {
    for (const date of [{ year: 2026, month: 2, day: 9 }, { year: 2027, month: 3, day: 1 }]) {
      expect(calculateFastingDay({ date }, profile).foodRule.id).toBe("no-fast");
    }
    // The fix must not remove the distinct Wednesday/Friday fast.
    expect(calculateFastingDay({ date: { year: 2026, month: 2, day: 11 } }, profile).foodRule.id).not.toBe("no-fast");
  });
});
