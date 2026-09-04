const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/Священномученик(?:а|ов|и|ам|ами|ах)?/giu, "Сщмч."],
  [/Преподобномученик(?:а|ов|и|ам|ами|ах)?/giu, "Прмч."],
  [/Преподобн(?:ый|ого|ому|ым|ом|ые|ых|ыми|ая|ой|ую|ою|ые)?/giu, "Прп."],
  [/Святител(?:ь|я|ю|ем|е|и|ей|ям|ями|ях)/giu, "Свт."],
  [/Мученик(?:а|ов|и|ам|ами|ах)?/giu, "Мч."],
  [/Апостол(?:а|ов|у|ом|е|ы|ам|ами|ах)?/giu, "Ап."],
  [/Благоверн(?:ого|ых) княз(?:я|ей)/giu, "Блгв. кн."],
  [/Праведн(?:ый|ого|ому|ым|ом|ые|ых|ыми|ая|ой|ую|ою)?/giu, "Прав."],
  [/Блаженн(?:ый|ого|ому|ым|ом|ые|ых|ыми|ая|ой|ую|ою)?/giu, "Блж."],
  [/Исповедник(?:а|ов|и|ам|ами|ах)?/giu, "Исп."],
  [/Новомученик(?:а|ов|и|ам|ами|ах)?/giu, "Новомч."],
  [/Священноисповедник(?:а|ов|и|ам|ами|ах)?/giu, "Сщисп."],
  [/Архиепископа/giu, "архиеп."],
  [/Епископа/giu, "еп."],
  [/Митрополита/giu, "митр."],
];

export function createShortCalendarTitle(title: string): string {
  return REPLACEMENTS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    title,
  ).replace(/\s+/g, " ").trim();
}

export function createVeryShortCalendarTitle(title: string): string {
  const short = createShortCalendarTitle(title);
  const clauses = short.split(/;\s*/).filter(Boolean);
  const semantic = clauses.length > 2 ? `${clauses.slice(0, 2).join("; ")}; и др.` : short;
  if (semantic.length <= 96) return semantic;
  const clipped = semantic.slice(0, 93).replace(/\s+\S*$/u, "").replace(/[.,;:!?\s]+$/u, "");
  return `${clipped}…`;
}
