/** Names of biblical books, not a translation of the biblical verses themselves.
 * Chapter/verse delimiters and numbering are intentionally retained exactly.
 * German ecclesiastical reference usage: orthodoxe-kirche.de Heiligenkalender.
 * CU names follow the Elizabethan Bible tradition. Arabic reference numbers
 * remain machine-readable; this does not convert them to Slavonic numerals.
 */
const BOOKS: Record<string, {de:string;cu:string}> = {
  'Мф': {de:'Mt',cu:'Ѿ Матѳе́а'},
  'Мк': {de:'Mk',cu:'Ѿ Ма́рка'},
  'Лк': {de:'Lk',cu:'Ѿ Лꙋкѝ'},
  'Ин': {de:'Joh',cu:'Ѿ І҆ѡа́нна'},
  'Деян': {de:'Apg',cu:'Дѣѧ̑нїѧ'},
  'Рим': {de:'Röm',cu:'Къ Ри́млѧнѡмъ'},
  '1Кор': {de:'1 Kor',cu:'1 Къ Корі́нѳѧнѡмъ'},
  '2Кор': {de:'2 Kor',cu:'2 Къ Корі́нѳѧнѡмъ'},
  'Гал': {de:'Gal',cu:'Къ Гала́тѡмъ'},
  'Еф': {de:'Eph',cu:'Ко Є҆фесе́ємъ'},
  'Флп': {de:'Phil',cu:'Къ Філіппі́сіємъ'},
  'Кол': {de:'Kol',cu:'Къ Коло́ссаємъ'},
  '1Сол': {de:'1 Thess',cu:'1 Къ Солꙋнѧ́нѡмъ'},
  '2Сол': {de:'2 Thess',cu:'2 Къ Солꙋнѧ́нѡмъ'},
  '1Тим': {de:'1 Tim',cu:'1 Къ Тімоѳе́ю'},
  '2Тим': {de:'2 Tim',cu:'2 Къ Тімоѳе́ю'},
  'Тит': {de:'Tit',cu:'Къ Ті́тꙋ'},
  'Евр': {de:'Hebr',cu:'Ко Є҆вре́ємъ'},
  'Иак': {de:'Jak',cu:'І҆а́кѡва'},
  '1Пет': {de:'1 Petr',cu:'1 Петра̀'},
  '2Пет': {de:'2 Petr',cu:'2 Петра̀'},
  '1Ин': {de:'1 Joh',cu:'1 І҆ѡа́нна'},
  '2Ин': {de:'2 Joh',cu:'2 І҆ѡа́нна'},
  '3Ин': {de:'3 Joh',cu:'3 І҆ѡа́нна'},
  'Иуд': {de:'Jud',cu:'І҆ꙋ́ды'},
  'Ис': {de:'Jes',cu:'И҆са́їи'},
  'Быт': {de:'Gen',cu:'Бытїѐ'},
  'Притч': {de:'Spr',cu:'При́тчи'},
  'Пс': {de:'Ps',cu:'Ѱалмы̀'},
};
const PASSION_PREFIX = 'Двенадцать Евангелий святых страстей Иисуса Христа: ';
export function localizeScriptureTitle(title:string, language:string): string | undefined {
  if (language !== 'de' && language !== 'cu') return undefined;
  let body = title;
  let prefix = '';
  if (body.startsWith(PASSION_PREFIX)) {
    body = body.slice(PASSION_PREFIX.length);
    prefix = language === 'de' ? 'Die zwölf Evangelien der heiligen Leiden Jesu Christi: '
      : 'Двана́десѧть є҆ѵⷢ҇лїй ст҃ы́хъ страсте́й і҆и҃са хрⷭ҇та̀: ';
  }
  const parts = body.split(';');
  const translated: string[] = [];
  for (const part of parts) {
    const match = /^(\s*)((?:[123]\s*)?[А-ЯЁ][а-яё]+)\.\s*([\d\s:,–—-]+)$/u.exec(part);
    if (!match) return undefined;
    const key = match[2]!.replace(/\s/gu,'');
    if (!Object.hasOwn(BOOKS,key)) return undefined;
    translated.push(`${match[1]}${BOOKS[key]![language]} ${match[3]}`);
  }
  return prefix + translated.join(';');
}
