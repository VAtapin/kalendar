const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/Пресвят(?:ой|ую|ая) Владычиц(?:ы|у|а) нашей Богородиц(?:ы|у|а) и Приснодев(?:ы|у|а) Марии/giu, "Пресвятой Богородицы"],
  [/Господа Бога и Спаса нашего Иисуса Христа/giu, "Господа Иисуса Христа"],
  [/Иконы Божией Матери/giu, "иконы Божией Матери"],
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
  [/Патриарх(?:а|у|ом|е)?/giu, "патр."],
  [/Чудотворц(?:а|ев|у|ем|е|ы|ам|ами|ах)/giu, "чудотв."],
  [/равноапостольн(?:ого|ой|ых|ые|ая|ый)/giu, "равноап."],
];

const VERY_SHORT_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\s*\((?:ок\.\s*)?\d{1,4}(?:[—–-]\d{1,4})?(?:\s*гг?\.?)?\)/giu, ""],
  [/\s*\([^)]*(?:век|вв?\.|год|лет|обретен|перенес)[^)]*\)/giu, ""],
  [/,?\s+(?:архиеп\.|еп\.|митр\.|патр\.)\s+[^,;]+(?:ской|ского|ский|ской и [^,;]+)?(?=,|;|$)/giu, ""],
  [/,?\s+(?:учителя|настоятельницы?|игумении?|диакона|пресвитера|архимандрита|инокини?|монаха)\s+[^,;]+/giu, ""],
  [/,?\s+(?:и\s+)?всея\s+России\s+чудотв\./giu, ""],
  [/,?\s+чудотв\./giu, ""],
  [/Собор\s+(?:новомучеников и исповедников|святых)\s+/giu, "Собор "],
  [/Собора\s+(?:новомучеников и исповедников|святых)\s+/giu, "Собора "],
  [/сорока\s+мучеников,?\s+в\s+Севастийском\s+озере\s+мучившихся/giu, "40 мучеников Севастийских"],
];

function cleanPunctuation(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,{2,}/g, ",")
    .replace(/,\s*([;.]|$)/g, "$1")
    .trim();
}

export function createShortCalendarTitle(title: string): string {
  return cleanPunctuation(REPLACEMENTS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    title,
  ));
}

export function createVeryShortCalendarTitle(title: string): string {
  const short = cleanPunctuation(VERY_SHORT_REPLACEMENTS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    createShortCalendarTitle(title),
  ));
  const clauses = short.split(/;\s*/).filter(Boolean);
  const semantic = clauses.length > 2 ? `${clauses.slice(0, 2).join("; ")}; и др.` : short;
  if (semantic.length <= 72) return semantic;
  const clipped = semantic.slice(0, 69).replace(/\s+\S*$/u, "").replace(/[.,;:!?\s]+$/u, "");
  return `${clipped}…`;
}
