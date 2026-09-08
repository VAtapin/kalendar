import { describe, expect, it } from "vitest";
import { dayOfWeek } from "../src/calendar/date/calendar-date";
import { compareTrapezaCategory, parseOfficialTrapeza, type TrapezaExtraction } from "../scripts/lib/official-trapeza-evidence";
import { officialReadingReferences, referenceKey, xmlReadingService } from "../scripts/lib/official-reading-evidence";

function tableFixture(): TrapezaExtraction {
  const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  return { source: "fixture", sha256: "fixture", tables: [
    ...months.map((name, i) => ({ table: i + 1, contextBefore: name,
      cells: Array.from({ length: new Date(Date.UTC(2026, i + 1, 0)).getUTCDate() }, (_, d) => ({
        row: dayOfWeek({ year: 2026, month: i + 1, day: d + 1 }) || 7,
        column: 2 + Math.floor(d / 7), text: String(d + 1), backgroundColor: -16777216,
      })),
    })),
    ...[-16777216, 16776960, 65280, 65535, -16777216].map((backgroundColor, i) => ({
      table: 13 + i, contextBefore: "legend", cells: [{ row: 1, column: 1, text: "legend", backgroundColor }],
    })),
  ] };
}

describe("independent source evidence parsers (not liturgical approval)", () => {
  it("preserves letters, background colours and optional-service footnotes", () => {
    const data = tableFixture();
    const cells = data.tables[0]!.cells;
    for (const [index, code] of ["бм", "и", "х", "в"].entries()) {
      cells[index]!.text += ` ${code}${index === 3 ? "**" : ""}`;
      cells[index]!.backgroundColor = 16776960;
    }
    cells[4]!.backgroundColor = 65535;
    cells[5]!.backgroundColor = 65280;
    const rows = parseOfficialTrapeza(data);
    expect(rows).toHaveLength(365);
    expect(rows.slice(0, 6).map(r => r.category)).toEqual([
      "without-oil-unspecified", "caviar", "total-abstinence", "wine-only-allowance", "dairy-eggs", "no-fast",
    ]);
    expect(rows[3]!.footnote).toBe("**");
    expect(rows[5]!.fastFreeWeek).toBe(true);
    expect(compareTrapezaCategory("without-oil-unspecified", "boiled-no-oil")).toContain("does-not-distinguish");
    expect(compareTrapezaCategory("without-oil-unspecified", "dry-eating")).toContain("does-not-distinguish");
    expect(compareTrapezaCategory("wine-only-allowance", "dry-eating")).toBe("requires-food-and-wine-rubric");
    expect(compareTrapezaCategory("caviar", "fish")).toBe("different-category");
  });

  it("fails closed on an unknown colour, code, incomplete month or shifted weekday", () => {
    const color = tableFixture(); color.tables[0]!.cells[0]!.backgroundColor = 42;
    expect(() => parseOfficialTrapeza(color)).toThrow("colour");
    const code = tableFixture(); code.tables[0]!.cells[0]!.text += " я";
    expect(() => parseOfficialTrapeza(code)).toThrow("Unclassified");
    const missing = tableFixture(); missing.tables[0]!.cells.pop();
    expect(() => parseOfficialTrapeza(missing)).toThrow("Incomplete");
    const weekday = tableFixture(); weekday.tables[0]!.cells[0]!.row = 1;
    expect(() => parseOfficialTrapeza(weekday)).toThrow("Weekday");
  });

  it("distinguishes explicit services and preserves the scripture verse boundaries", () => {
    const refs = officialReadingReferences("Утр. – Ин., 67 зач., XXI, 15–25. Лит. – 1 Пет., 59 зач., II, 21 – III, 9. На 6-м часе – Ис. I, 1–20.");
    expect(refs.map(r => [r.service, r.key])).toEqual([
      ["matins", referenceKey("Ин.21:15-25")],
      ["liturgy", referenceKey("1Пет.2:21-3:9")],
      ["hour-6", referenceKey("Ис.1:1-20")],
    ]);
    expect(refs[0]!.lection).toBe("67");
    expect(xmlReadingService(207)).toBe("liturgy");
    expect(xmlReadingService(302)).toBe("matins");
    expect(xmlReadingService(208)).toBe("vespers");
    expect(xmlReadingService(4)).toBeUndefined();
  });

  it("does not append rubric punctuation to a reference or turn a verse list into a range", () => {
    const refs = officialReadingReferences("Мк., 57 зач., XII, 38–44, и за пятницу – Мк., 58 зач., XIII, 1–8. Мк., 68 зач., XV, 22, 25, 33–41.");
    expect(refs.map(r => r.key)).toEqual(["Мк12:38-44", "Мк13:1-8", "Мк15:22,25,33-41"]);
  });

  it("never accepts water-blessing or foot-washing readings as evidence for the liturgy", () => {
    const refs = officialReadingReferences("Лит. – Мф., 6 зач., III, 13–17. На освящении воды: 1 Кор., 143 зач., X, 1–4. Мк., 2 зач., I, 9–11. На омовении ног: Ин., 44 зач., XIII, 1–11.");
    expect(refs.map(r => r.service)).toEqual(["liturgy", "water-blessing", "water-blessing", "foot-washing"]);
    expect(officialReadingReferences("На водоосвящении: Ин., 14 зач., V, 1–4.")[0]?.service).toBe("water-blessing");
  });
});
