import { officialText } from "./official-calendar-evidence";

export type ReadingService = "hour-1" | "matins" | "hour-3" | "liturgy" | "hour-6" | "vespers" | "hour-9";
export function xmlReadingService(typeCode: number): ReadingService | undefined {
  if (typeCode < 200 || typeCode >= 400) return undefined;
  return ({ 1: "hour-1", 2: "matins", 3: "hour-3", 4: "liturgy", 6: "hour-6",
    7: "liturgy", 8: "vespers", 9: "hour-9" } as Record<number, ReadingService>)[typeCode % 10];
}
function roman(value: string): number {
  const digits: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  return [...value].reduce((sum, digit, i) => sum + ((digits[digit] ?? 0) < (digits[value[i + 1]!] ?? 0) ? -1 : 1) * (digits[digit] ?? 0), 0);
}
export function referenceKey(value: string): string {
  return value.replace(/\s|\./gu, "").replace(/[–—−]/gu, "-").replace(/;/gu, ",");
}

/** An evidence parser only: lection numbers and optional rubrics remain as
 * evidence, and a textual match never proves that a service should be sung. */
export function officialReadingReferences(paragraph: string) {
  const text = officialText(paragraph);
  const markers = [...text.matchAll(/(Утр\.|Лит\.|Веч\.|На ([1369])-м часе)\s*[:–—-]/gu)].map(m => ({
    index: m.index!, service: (m[2] ? `hour-${m[2]}` : m[1] === "Утр." ? "matins" : m[1] === "Веч." ? "vespers" : "liturgy") as ReadingService,
  }));
  const references = [...text.matchAll(/((?:[123]\s*)?(?:Гал|Мф|Ин|Лк|Мк|Кор|Рим|Еф|Евр|Кол|Иак|Тим|Пет|Сол|Иуд|Флп|Деян|Тит|Ис|Быт|Притч|Пс))\.,?\s*(?:(\d+(?:[–—-]\d+)?)\s*зач\.(?:\s*\(от полу\))?,?\s*)?([IVXLCDM]+\s*,\s*\d[IVXLCDM\d,;\s–—−-]*)/gu)];
  return references.map(m => {
    const service = markers.filter(marker => marker.index < m.index!).at(-1)?.service ?? "liturgy";
    const reference = m[3]!.trim().replace(/([IVXLCDM]+)\s*,\s*/gu, (_, numeral: string) => `${roman(numeral)}:`);
    return { service, key: referenceKey(`${m[1]}.${reference}`), printed: m[0].trim(), lection: m[2] ?? null,
      index: m.index!, paragraph: text };
  });
}
