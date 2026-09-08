export interface ScripturePassage {
  book: string;
  start: { chapter: number; verse: number | null };
  end: { chapter: number; verse: number | null };
}

export interface ScriptureReading {
  schemaVersion: 1;
  parseStatus: 'parsed' | 'partial' | 'unparsed';
  numbering: 'unknown';
  passages: ScripturePassage[];
  issues: { code: string; sourceFragment: string; message: string }[];
}

const BOOK_ALIASES: Record<string, string[]> = {
  Gen: ['Быт', 'Бытие'], Exod: ['Исх', 'Исход'], Lev: ['Лев', 'Левит'], Num: ['Чис', 'Числ', 'Числа'],
  Deut: ['Втор', 'Второзаконие'], Josh: ['Нав'], Judg: ['Суд'], Ruth: ['Руф', 'Руфь'],
  '1Sam': ['1Цар'], '2Sam': ['2Цар'], '1Kgs': ['3Цар'], '2Kgs': ['4Цар'],
  '1Chr': ['1Пар'], '2Chr': ['2Пар'], Ezra: ['Езд', '1Езд'], Neh: ['Неем'], Esth: ['Есф'],
  Job: ['Иов'], Ps: ['Пс', 'Псалом', 'Псалмы', 'Псалтирь'], Prov: ['Притч', 'Притчи'],
  Eccl: ['Еккл'], Song: ['Песн'], Isa: ['Ис', 'Исаия'], Jer: ['Иер'], Lam: ['Плач'],
  Ezek: ['Иез'], Dan: ['Дан'], Hos: ['Ос'], Joel: ['Иоил'], Amos: ['Ам'], Obad: ['Авд'],
  Jonah: ['Ион'], Mic: ['Мих'], Nah: ['Наум'], Hab: ['Авв'], Zeph: ['Соф'], Hag: ['Агг'],
  Zech: ['Зах'], Mal: ['Мал'], Matt: ['Мф', 'Матфей'], Mark: ['Мк', 'Марк'],
  Luke: ['Лк', 'Лука'], John: ['Ин', 'Иоанн'], Acts: ['Деян', 'Деяния'], Rom: ['Рим'],
  '1Cor': ['1Кор'], '2Cor': ['2Кор'], Gal: ['Гал'], Eph: ['Еф'], Phil: ['Флп'], Col: ['Кол'],
  '1Thess': ['1Сол', '1Фес'], '2Thess': ['2Сол', '2Фес'], '1Tim': ['1Тим'], '2Tim': ['2Тим'],
  Titus: ['Тит'], Phlm: ['Флм'], Heb: ['Евр'], Jas: ['Иак'], '1Pet': ['1Пет'], '2Pet': ['2Пет'],
  '1John': ['1Ин'], '2John': ['2Ин'], '3John': ['3Ин'], Jude: ['Иуд'], Rev: ['Откр', 'Апок'],
};
const books = new Map(Object.entries(BOOK_ALIASES).flatMap(([osis, aliases]) =>
  [...aliases, osis].map(alias => [alias.toLowerCase(), osis] as const)));
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;

/** Syntactic ranges only: source numbering and verse existence are not certified. */
export function parseScriptureReading(sourceTitle: string): ScriptureReading {
  const passages: ScripturePassage[] = [];
  const issues: ScriptureReading['issues'] = [];
  const issue = (code: string, sourceFragment: string, message: string) => issues.push({ code, sourceFragment, message });
  const body = sourceTitle.trim().replace(/^Двенадцать Евангелий святых страстей Иисуса Христа:\s*/u, '');
  for (const rawCitation of body.split(';')) {
    const citation = rawCitation.trim();
    const match = /^((?:[1-4]\s*)?[\p{L}]+)\.?\s*(.*)$/u.exec(citation);
    const book = match ? books.get(match[1]!.replace(/\s/gu, '').toLowerCase()) : undefined;
    if (!match || !book) {
      issue('unknown-book', rawCitation, 'Book or citation could not be identified.');
      continue;
    }
    let currentChapter: number | undefined;
    // A citation without colons denotes whole chapters, never an invented verse bound.
    const wholeChapters = !match[2]!.includes(':');
    for (const rawSegment of match[2]!.split(',')) {
      const segment = rawSegment.replace(/\s/gu, '').replace(/[–—−]/gu, '-');
      const parts = wholeChapters ? /^(\d+)(?:-(\d+))?$/u.exec(segment)
        : /^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/u.exec(segment);
      if (!parts) {
        issue('invalid-segment', rawSegment, 'Expected chapter/verse coordinates or a chapter range.');
        currentChapter = undefined;
        continue;
      }
      const start = wholeChapters
        ? { chapter: Number(parts[1]), verse: null }
        : { chapter: parts[1] ? Number(parts[1]) : currentChapter ?? 0, verse: Number(parts[2]) };
      const end = wholeChapters
        ? { chapter: Number(parts[2] ?? parts[1]), verse: null }
        : { chapter: parts[3] ? Number(parts[3]) : start.chapter, verse: Number(parts[4] ?? parts[2]) };
      if (![start.chapter, end.chapter, ...(start.verse === null ? [] : [start.verse, end.verse!])].every(positive)) {
        issue('invalid-coordinate', rawSegment, 'Coordinates must be positive safe integers with an explicit initial chapter.');
        currentChapter = undefined;
        continue;
      }
      if (end.chapter < start.chapter || (end.chapter === start.chapter && end.verse !== null && start.verse !== null && end.verse < start.verse)) {
        issue('reversed-range', rawSegment, 'End precedes start.');
        currentChapter = undefined;
        continue;
      }
      passages.push({ book, start, end });
      currentChapter = end.chapter;
    }
  }
  return { schemaVersion: 1, parseStatus: passages.length ? (issues.length ? 'partial' : 'parsed') : 'unparsed',
    numbering: 'unknown', passages, issues };
}
