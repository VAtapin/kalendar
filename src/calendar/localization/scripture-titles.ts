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
// Book abbreviations only: the API returns references, not translated Bible verses.
const UK_PL_BOOKS: Record<string, {uk:string;pl:string}> = {
  'Мф': {uk:'Мт.',pl:'Mt'}, 'Мк': {uk:'Мк.',pl:'Mk'}, 'Лк': {uk:'Лк.',pl:'Łk'}, 'Ин': {uk:'Ін.',pl:'J'},
  'Деян': {uk:'Діян.',pl:'Dz'}, 'Рим': {uk:'Рим.',pl:'Rz'},
  '1Кор': {uk:'1 Кор.',pl:'1 Kor'}, '2Кор': {uk:'2 Кор.',pl:'2 Kor'},
  'Гал': {uk:'Гал.',pl:'Ga'}, 'Еф': {uk:'Еф.',pl:'Ef'}, 'Флп': {uk:'Флп.',pl:'Flp'}, 'Кол': {uk:'Кол.',pl:'Kol'},
  '1Сол': {uk:'1 Сол.',pl:'1 Tes'}, '2Сол': {uk:'2 Сол.',pl:'2 Tes'},
  '1Тим': {uk:'1 Тим.',pl:'1 Tm'}, '2Тим': {uk:'2 Тим.',pl:'2 Tm'},
  'Тит': {uk:'Тит.',pl:'Tt'}, 'Евр': {uk:'Євр.',pl:'Hbr'}, 'Иак': {uk:'Як.',pl:'Jk'},
  '1Пет': {uk:'1 Пет.',pl:'1 P'}, '2Пет': {uk:'2 Пет.',pl:'2 P'},
  '1Ин': {uk:'1 Ін.',pl:'1 J'}, '2Ин': {uk:'2 Ін.',pl:'2 J'}, '3Ин': {uk:'3 Ін.',pl:'3 J'},
  'Иуд': {uk:'Юд.',pl:'Jud'}, 'Ис': {uk:'Іс.',pl:'Iz'}, 'Быт': {uk:'Бут.',pl:'Rdz'},
  'Притч': {uk:'Притч.',pl:'Prz'}, 'Пс': {uk:'Пс.',pl:'Ps'},
};
export function localizeScriptureTitle(title:string, language:string): string | undefined {
  if (language !== 'de' && language !== 'cu' && language !== 'uk' && language !== 'pl') return undefined;
  let body = title;
  let prefix = '';
  if (body.startsWith(PASSION_PREFIX)) {
    body = body.slice(PASSION_PREFIX.length);
    prefix = { de: 'Die zwölf Evangelien der heiligen Leiden Jesu Christi: ',
      cu: 'Двана́десѧть є҆ѵⷢ҇лїй ст҃ы́хъ страсте́й і҆и҃са хрⷭ҇та̀: ',
      uk: 'Дванадцять Євангелій святих страстей Ісуса Христа: ',
      pl: 'Dwanaście Ewangelii świętej Męki Jezusa Chrystusa: ' }[language];
  }
  const parts = body.split(';');
  const translated: string[] = [];
  for (const part of parts) {
    const match = /^(\s*)((?:[123]\s*)?[А-ЯЁ][а-яё]+)\.\s*([\d\s:,–—-]+)$/u.exec(part);
    if (!match) return undefined;
    const key = match[2]!.replace(/\s/gu,'');
    if (!Object.hasOwn(BOOKS,key)) return undefined;
    const book = language === 'uk' || language === 'pl' ? UK_PL_BOOKS[key]?.[language] : BOOKS[key]![language];
    if (!book) return undefined;
    translated.push(`${match[1]}${book} ${match[3]}`);
  }
  return prefix + translated.join(';');
}
