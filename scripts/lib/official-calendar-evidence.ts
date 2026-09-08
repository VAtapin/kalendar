import { containsFullTitle, normalizeEvidence } from "./calendar-source-audit";

const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export interface OfficialCalendarDay { oldMonth: number; oldDay: number; newDay: number; header: string; paragraphs: string[] }

export function parseOfficialCalendar(text: string): OfficialCalendarDay[] {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const headers = [...normalized.matchAll(/^\s*(\d{1,2})\((\d{1,2})\) ([а-я]+), ([а-я]+)[^\n]*/gmu)];
  return headers.map((header, index) => {
    const oldMonth = months.indexOf(header[3]!) + 1;
    if (!oldMonth) throw new Error(`Unknown official calendar month: ${header[0]}`);
    const body = normalized.slice(header.index! + header[0].length, headers[index + 1]?.index ?? normalized.length);
    return { oldMonth, oldDay: Number(header[1]), newDay: Number(header[2]), header: header[0].trim(),
      paragraphs: body.split("\n").map(p => p.trim()).filter(Boolean) };
  });
}

// The publisher explicitly encodes stress with ASCII apostrophes. These are
// not word boundaries ("обре'тение" is one word), unlike arbitrary punctuation.
export const officialText = (text: string) => text.replace(/(?<=[а-яё])'/giu, "").replace(/\u0002/gu, "");
export const officialTitleMatches = (paragraph: string, title: string) => containsFullTitle(officialText(paragraph), title);
export const officialTokens = (text: string) => normalizeEvidence(officialText(text)).split(" ");
