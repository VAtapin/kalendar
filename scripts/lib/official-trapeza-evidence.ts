import { dayOfWeek, toIsoDate } from "../../src/calendar/date/calendar-date";

export interface TrapezaCell {
  row: number;
  column: number;
  text: string;
  backgroundColor: number;
}
export interface TrapezaExtraction {
  source: string;
  sha256: string;
  tables: { table: number; contextBefore: string; cells: TrapezaCell[] }[];
}
export type TrapezaCategory = "no-fast" | "dairy-eggs" | "oil" | "fish" |
  "without-oil-unspecified" | "caviar" | "total-abstinence" | "wine-only-allowance";
const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const codes: Record<string, TrapezaCategory> = {
  м: "oil", р: "fish", бм: "without-oil-unspecified", и: "caviar",
  х: "total-abstinence", в: "wine-only-allowance",
};

/** Transcribes the publisher's letters AND shading; never invents a finer diet. */
export function parseOfficialTrapeza(extraction: TrapezaExtraction, year = 2026) {
  if (extraction.tables.length !== 17) throw new Error("Expected 12 month tables and 5 legend tables");
  const colors = extraction.tables.slice(13, 16).map(t => t.cells[0]?.backgroundColor);
  if (colors.join() !== "16776960,65280,65535") throw new Error("Unrecognised table colour legend");
  const rows = extraction.tables.slice(0, 12).flatMap((table, monthIndex) => {
    if (!table.contextBefore.trim().endsWith(months[monthIndex]!)) throw new Error(`Wrong month: ${table.table}`);
    const days = table.cells.filter(c => c.column > 1 && c.text.trim()).map(cell => {
      const match = /^(\d{1,2})(\*{0,2})\s*([а-я]*)\s*(\*{0,2})$/u.exec(cell.text.trim());
      if (!match) throw new Error(`Unrecognised cell: ${monthIndex + 1}/${cell.text}`);
      const date = { year, month: monthIndex + 1, day: Number(match[1]) };
      if (date.day < 1) throw new Error(`Invalid day: ${cell.text}`);
      if (![16776960, 65280, 65535, -16777216].includes(cell.backgroundColor)) {
        throw new Error(`Unrecognised day colour: ${cell.backgroundColor}`);
      }
      if (dayOfWeek(date) !== cell.row % 7) throw new Error(`Weekday mismatch: ${toIsoDate(date)}`);
      const code = match[3]!;
      const category = code ? codes[code] : cell.backgroundColor === 65535 ? "dairy-eggs" : "no-fast";
      if (!category || (!code && cell.backgroundColor === 16776960)) throw new Error(`Unclassified fast: ${toIsoDate(date)}`);
      if (code && cell.backgroundColor !== 16776960) throw new Error(`Code without fast colour: ${toIsoDate(date)}`);
      return { isoDate: toIsoDate(date), category: category as TrapezaCategory,
        printedCode: code, footnote: match[2] || match[4] || null, backgroundColor: cell.backgroundColor,
        fastFreeWeek: cell.backgroundColor === 65280 };
    });
    const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    if (days.length !== count || new Set(days.map(d => d.isoDate)).size !== count ||
        days.some(d => Number(d.isoDate.slice(-2)) > count)) throw new Error(`Incomplete month ${monthIndex + 1}`);
    return days;
  }).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return rows;
}

export function compareTrapezaCategory(observed: TrapezaCategory, actual: string) {
  if (observed === actual) return "same-category";
  if (observed === "without-oil-unspecified" && ["dry-eating", "boiled-no-oil"].includes(actual)) {
    return "compatible-but-source-does-not-distinguish-dry-from-cooked";
  }
  // Wine is a permission, not an assertion that no other food is eaten.
  if (observed === "wine-only-allowance") return "requires-food-and-wine-rubric";
  return "different-category";
}
