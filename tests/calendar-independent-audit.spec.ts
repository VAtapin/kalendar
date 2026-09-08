import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { resolveMemoryDayRecord } from "../src/calendar/engine/resolve-record";
import { addDays, compareDates as compareDatesForAudit, dayOfWeek, gregorianToJulian, julianToGregorian, toIsoDate } from "../src/calendar/date/calendar-date";
import { calculateOrthodoxPascha } from "../src/calendar/pascha/orthodox-pascha";
import { calculateFastingDay } from "../src/calendar/fasting/fasting-api";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { isRedLetterEvent, typikonMarkForEvent } from "../src/calendar/presentation/typikon-style";
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
    expect(dataset.records).toHaveLength(3815);
    expect(ledger.changes).toHaveLength(119);
    for (const correction of ledger.changes) {
      expect(dataset.records[correction.sourceIndex - 1]?.title).toBe(correction.after);
      expect(correction.before).not.toBe(correction.after);
      expect(correction.sources.length).toBeGreaterThan(0);
    }
  });
  it("keeps reviewed date rules in sync with the correction ledger", () => {
    expect(ledger.dateChanges).toHaveLength(45);
    for (const change of ledger.dateChanges) {
      const record = dataset.records[change.sourceIndex - 1]!;
      expect(record.title).toBe(change.title);
      for (const [field, value] of Object.entries(change.after)) expect(record[field as keyof typeof record]).toBe(value);
    }
  });
  it("uses the modern great-feast rank for St Vladimir and retains St John's Nativity rank", () => {
    expect(ledger.rankChanges).toHaveLength(1);
    expect(dataset.records[26]?.typeCode).toBe(2);
    const calendar = buildOrthodoxCalendarYear(2027, dataset);
    const vladimir = calendar.daysByIsoDate["2027-07-28"]!.events.find(event => event.sourceIndex === 27)!;
    expect(typikonMarkForEvent(vladimir)).toBe("great");
    expect(isRedLetterEvent(vladimir)).toBe(true);
    const nativity = calendar.daysByIsoDate["2027-07-07"]!.events.find(event => event.sourceIndex === 15)!;
    expect(typikonMarkForEvent(nativity)).toBe("great");
  });
  it("appends moved commemorations without reassigning any original source ID", () => {
    expect(ledger.addedRecords).toHaveLength(4);
    for (const [offset, addition] of ledger.addedRecords.entries()) {
      expect(addition.sourceIndex).toBe(3812 + offset);
      const record = dataset.records[addition.sourceIndex - 1]!;
      expect(record).toMatchObject({ title: addition.title, typeCode: addition.typeCode,
        startMonth: addition.startMonth, startDate: addition.startDate,
        finishMonth: addition.finishMonth, finishDate: addition.finishDate });
      expect(record.id).toBe(`memory-day-${addition.sourceIndex}`);
    }
    expect(ledger.descriptionChanges).toHaveLength(5);
    for (const change of ledger.descriptionChanges) {
      expect(dataset.records[change.sourceIndex - 1]!.raw.discription).toBe(change.after);
    }
  });
  it("uses source-confirmed modern dates rather than obsolete group dates", () => {
    const calendar = buildOrthodoxCalendarYear(2026, dataset);
    for (const [name, oldDate, correctDate] of [
      ["Михаила Белороссова", "2026-05-24", "2026-02-14"],
      ["Николая Цикуры", "2026-02-06", "2026-02-18"],
      ["Сильвестра, архиеп. Омского", "2026-02-26", "2026-03-10"],
      ["Михаила Околовича", "2026-03-26", "2026-05-20"],
      ["Алексия Введенского", "2026-07-06", "2026-07-13"],
      ["Александра Попова", "2026-07-21", "2026-07-23"],
      ["Димитрия Вознесенского", "2026-10-17", "2026-10-31"],
      ["Петра Косминкова", "2026-11-16", "2026-11-25"],
      ["Симеона Кречкова", "2026-11-16", "2026-11-25"],
      ["Евфимия исп.", "2026-02-01", "2026-02-02"],
      ["Петра Успенского пресвитера (1938)", "2026-03-12", "2026-03-01"],
      ["Сергия Увицкого", "2026-03-13", "2026-03-12"],
    ]) {
      expect(calendar.daysByIsoDate[oldDate!]!.events.some(e => e.title.includes(name!)), name).toBe(false);
      expect(calendar.daysByIsoDate[correctDate!]!.events.some(e => e.title.includes(name!)), name).toBe(true);
    }
  });
  it("handles inclusive and exclusive Sunday boundaries throughout 1900–2199", () => {
    for (let year = 1900; year <= 2199; year++) for (const [index, month, first, last] of [
      [785, 7, 13, 19], [844, 7, 21, 27], [849, 8, 22, 28], [855, 9, 7, 13], [1862, 8, 30, 36],
    ]) {
      const start = julianToGregorian({ year, month: month!, day: first! });
      let expected = start;
      while (dayOfWeek(expected) !== 0) expected = addDays(expected, 1);
      expect(resolveMemoryDayRecord(dataset.records[index! - 1]!, year).map(s => toIsoDate(s.start)), `${index}/${year}`)
        .toEqual([toIsoDate(expected)]);
      expect(compareDatesForAudit(expected, addDays(start, last! - first!))).toBeLessThanOrEqual(0);
    }
  });
  it("retains all Nativity lections in Saturday and Sunday collision years", () => {
    for (let year = 1900; year <= 2199; year++) {
      const christmas = julianToGregorian({ year: year - 1, month: 12, day: 25 });
      let sunday = addDays(christmas, 1);
      if (dayOfWeek(christmas) !== 0) while (dayOfWeek(sunday) !== 0) sunday = addDays(sunday, 1);
      for (const index of [3561, 3570]) expect(resolveMemoryDayRecord(dataset.records[index - 1]!, year).map(s => toIsoDate(s.start)))
        .toContain(toIsoDate(sunday));
      let saturday = addDays(christmas, 1);
      while (dayOfWeek(saturday) !== 6) saturday = addDays(saturday, 1);
      if (dayOfWeek(christmas) === 6) saturday = addDays(saturday, -1);
      for (const index of [3560, 3569]) expect(resolveMemoryDayRecord(dataset.records[index - 1]!, year).map(s => toIsoDate(s.start)))
        .toContain(toIsoDate(saturday));
      if (dayOfWeek(christmas) === 6) for (const index of [3553, 3562]) {
        expect(resolveMemoryDayRecord(dataset.records[index - 1]!, year).map(s => toIsoDate(s.start))).toContain(toIsoDate(saturday));
      }
    }
    for (const index of [3553, 3560, 3562, 3569]) {
      expect(resolveMemoryDayRecord(dataset.records[index - 1]!, 2023).map(s => toIsoDate(s.start))).toEqual(["2023-01-13"]);
    }
    for (const index of [3561, 3570]) {
      expect(resolveMemoryDayRecord(dataset.records[index - 1]!, 2024).map(s => toIsoDate(s.start))).toEqual(["2024-01-08"]);
    }
    expect(resolveMemoryDayRecord(dataset.records[796]!, 2024)).toEqual([]);
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
  it("keeps the two Sundays before Nativity in their independent Typikon date windows", () => {
    for (let year = 1900; year <= 2199; year++) {
      for (const [index, first, last] of [[793, 11, 17], [795, 18, 24], [3559, 18, 24], [3568, 18, 24]] as const) {
        // A civil year can contain two occurrences of a pre-Nativity Sunday.
        // Check each occurrence's actual Julian date, not a hardcoded +13 days.
        const spans = resolveMemoryDayRecord(dataset.records[index - 1]!, year);
        for (const span of spans) {
          const oldStyle = gregorianToJulian(span.start);
          expect(oldStyle.month, `${index}/${year}`).toBe(12);
          expect(oldStyle.day).toBeGreaterThanOrEqual(first);
          expect(oldStyle.day).toBeLessThanOrEqual(last);
          expect(dayOfWeek(span.start)).toBe(0);
        }
      }
    }
    expect(resolveMemoryDayRecord(dataset.records[792]!, 2023).map(s => toIsoDate(s.start))).toContain("2023-12-24");
    expect(resolveMemoryDayRecord(dataset.records[794]!, 2023).map(s => toIsoDate(s.start))).toContain("2023-12-31");
  });
  it("does not lose Sundays before or Saturdays after a coinciding fixed feast", () => {
    const groups = [
      { ids: [775, 3554, 3563], month: 1, day: 6, step: -1, weekday: 0 },
      { ids: [788, 3571, 3574], month: 9, day: 14, step: -1, weekday: 0 },
      { ids: [776, 3555, 3564], month: 1, day: 6, step: 1, weekday: 6 },
      { ids: [789, 3572, 3575], month: 9, day: 14, step: 1, weekday: 6 },
    ];
    for (let year = 1900; year <= 2199; year++) for (const group of groups) {
      const anchor = julianToGregorian({ year, month: group.month, day: group.day });
      // Independent brute-force weekday search, unlike the XML resolver's formula.
      let expected = addDays(anchor, group.step);
      while (dayOfWeek(expected) !== group.weekday) expected = addDays(expected, group.step);
      for (const id of group.ids) {
        expect(resolveMemoryDayRecord(dataset.records[id - 1]!, year).map(s => toIsoDate(s.start)), `${id}/${year}`)
          .toEqual([toIsoDate(expected)]);
      }
    }
  });
  it("resolves the restored movable commemorations against Pascha throughout 1900–2199", () => {
    for (let year = 1900; year <= 2199; year++) {
      const pascha = calculateOrthodoxPascha(year);
      for (const [index, offset, weekday] of [[885, -42, 0], [1141, -52, 4]] as const) {
        const spans = resolveMemoryDayRecord(dataset.records[index - 1]!, year);
        expect(spans.map(span => toIsoDate(span.start)), `${index}/${year}`).toEqual([toIsoDate(addDays(pascha, offset))]);
        expect(dayOfWeek(spans[0]!.start)).toBe(weekday);
      }
    }
  });
  it("celebrates the Holy Kinsmen once, including the Sunday-Nativity exception", () => {
    for (let year = 1900; year <= 2199; year++) {
      // Use the actual Julian anchor below rather than assuming the civil offset.
      const christmas = resolveMemoryDayRecord(dataset.records.find(r => r.title === "Рождество Господа и Спаса нашего Иисуса Христа")!, year)[0]!.start;
      const weekday = dayOfWeek(christmas);
      const expected = addDays(christmas, weekday === 0 ? 1 : 7 - weekday);
      const spans = [733, 735].flatMap(index => resolveMemoryDayRecord(dataset.records[index - 1]!, year));
      expect(spans.map(span => toIsoDate(span.start)), String(year)).toEqual([toIsoDate(expected)]);
    }
  });
  it.each([[2022, "2022-07-10"], [2026, "2026-07-12"], [2027, "2027-07-11"], [2028, "2028-07-16"]] as const)
    ("uses the inclusive Sunday window for the Lipsi martyrs in %i", (year, expected) => {
      expect(resolveMemoryDayRecord(dataset.records[1661]!, year).map(span => toIsoDate(span.start))).toEqual([expected]);
      expect(dataset.records[2392]!.title).toBe("Сщмч. Антония, архиеп. Архангельского (1931)");
    });
});

describe("independently identified preparation-week restriction", () => {
  it("omits the Annunciation forefeast and leave-taking during excluded Triodion days", () => {
    const parsed = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));
    const minimal = { ...parsed, records: parsed.records.filter(r => r.sourceIndex === 779) };
    for (let year = 1900; year <= 2199; year++) {
      const calendar = buildOrthodoxCalendarYear(year, minimal);
      const pascha = calculateOrthodoxPascha(year);
      const feast = julianToGregorian({ year, month: 3, day: 25 });
      for (const [dayDelta, title] of [[-1, "Предпразднство Благовещения"], [1, "Отдание праздника Благовещения"]] as const) {
        const date = addDays(feast, dayDelta);
        const offset = compareDatesForAudit(date, pascha);
        expect(calendar.daysByIsoDate[toIsoDate(date)]!.events.some(e => e.title.startsWith(title)), `${year}/${title}`)
          .toBe(offset < -8 || offset > 6);
      }
    }
    const calendar2026 = buildOrthodoxCalendarYear(2026, parsed);
    expect(calendar2026.daysByIsoDate["2026-04-06"]!.events.some(e => e.sourceIndex === 779)).toBe(false);
    expect(calendar2026.daysByIsoDate["2026-04-07"]!.events.some(e => e.title.startsWith("Благовещение"))).toBe(true);
    // April 7, 2023 is Friday of week 6: its leave-taking would fall on Lazarus Saturday.
    expect(buildOrthodoxCalendarYear(2023, minimal).daysByIsoDate["2023-04-08"]!.events
      .some(e => e.title.startsWith("Отдание праздника Благовещения"))).toBe(false);
  });
  it.each(["typikon-strict", "parish"] as const)("does not invent a Monday fast in %s", profile => {
    for (const date of [{ year: 2026, month: 2, day: 9 }, { year: 2027, month: 3, day: 1 }]) {
      expect(calculateFastingDay({ date }, profile).foodRule.id).toBe("no-fast");
    }
    // The fix must not remove the distinct Wednesday/Friday fast.
    expect(calculateFastingDay({ date: { year: 2026, month: 2, day: 11 } }, profile).foodRule.id).not.toBe("no-fast");
  });
});
