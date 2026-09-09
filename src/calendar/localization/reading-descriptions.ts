import type { CalendarLanguage } from '../../document/types';

// The XML's 138 descriptions contain 41 distinct lection occasion labels.
// These are editorial translations, not the Scripture passages themselves.
const LABELS: ReadonlyArray<readonly [string, string, string]> = [
  ['Навечерие Богоявления', 'Vorabend der Theophanie', 'Навече́рїе бг҃оѧвле́нїѧ'],
  ['Навечерие Рождества Христова', 'Vorabend der Geburt Christi', 'Навече́рїе ржⷭ҇тва̀ хрⷭ҇то́ва'],
  ['Обрезание Господне', 'Beschneidung des Herrn', 'Ѡ҆брѣ́занїе гдⷭ҇не'],
  ['Богоявление', 'Theophanie', 'Бг҃оѧвле́нїе'],
  ['Сретение', 'Begegnung des Herrn', 'Срѣ́тенїе'],
  ['Преображение', 'Verklärung des Herrn', 'Преѡбраже́нїе'],
  ['Воздвижение', 'Kreuzerhöhung', 'Воздви́женїе'],
  ['Рождество', 'Geburt Christi', 'Ржⷭ҇тво̀'],
  ['Благовещение', 'Verkündigung an die Gottesgebärerin', 'Бл҃говѣ́щенїе'],
  ['Успение Богородицы', 'Entschlafen der Gottesgebärerin', 'ᲂу҆спе́нїе бцⷣы'],
  ['Рождество Богородицы', 'Geburt der Gottesgebärerin', 'Ржⷭ҇тво̀ бцⷣы'],
  ['Покров', 'Schutz der Gottesgebärerin', 'Покро́въ'],
  ['Введение', 'Einführung der Gottesgebärerin in den Tempel', 'Введе́нїе'],
  ['Антония Великого', 'Antonios des Großen', 'А҆нтѡ́нїа вели́кагѡ'],
  ['Евфимия Великого', 'Euthymios des Großen', 'Є҆ѵѳѵ́мїа вели́кагѡ'],
  ['Свв. Василия Великого, Григория Богослова и Иоанна Златоустого', 'Der hll. Basileios des Großen, Gregorios des Theologen und Johannes Chrysostomos', 'Ст҃ы́хъ васі́лїа вели́кагѡ, григо́рїа бг҃осло́ва и҆ і҆ѡа́нна златоꙋ́стаго'],
  ['Георгия Победоносца', 'Georgios des Siegesträgers', 'Геѡ́ргїа побѣдоно́сца'],
  ['Иоанна Богослова', 'Johannes des Theologen', 'І҆ѡа́нна бг҃осло́ва'],
  ['Кирилла и Мефодия', 'Kyrillos und Methodios', 'Кѵрі́лла и҆ меѳо́дїа'],
  ['Рожд. Иоанна Предтечи', 'Geburt Johannes des Vorläufers', 'Ржⷭ҇тво̀ і҆ѡа́нна предте́чи'],
  ['Петра и Павла', 'Petros und Paulos', 'Петра̀ и҆ па́вла'],
  ['Казанской иконы Богоматери', 'Kasaner Ikone der Gottesmutter', 'Каза́нскїѧ і҆кѡ́ны бг҃ома́тере'],
  ['кн. Владимира', 'Fürst Vladimir', 'Кнѧ́зѧ влади́мїра'],
  ['Серафима Саровского', 'Seraphim von Sarov', 'Серафі́ма саро́вскагѡ'],
  ['Усекновение главы Иоанна Предтечи', 'Enthauptung Johannes des Vorläufers', 'ᲂу҆сѣкнове́нїе главы̀ і҆ѡа́нна предте́чи'],
  ['Преставление Иоанна Богослова', 'Heimgang Johannes des Theologen', 'Преставле́нїе і҆ѡа́нна бг҃осло́ва'],
  ['Иоанна Златоустого', 'Johannes Chrysostomos', 'І҆ѡа́нна златоꙋ́стаго'],
  ['Саввы Освященного', 'Sabbas des Geheiligten', 'Са́ввы ѡ҆свѧще́ннагѡ'],
  ['Николая Мирликийского', 'Nikolaos von Myra in Lykien', 'Нікола́а мѵрлікі́йскагѡ'],
  ['Суббота перед Богоявлением', 'Samstag vor der Theophanie', 'Сꙋббѡ́та пред̾ бг҃оѧвле́нїемъ'],
  ['Неделя перед Богоявлением', 'Sonntag vor der Theophanie', 'Недѣ́лѧ пред̾ бг҃оѧвле́нїемъ'],
  ['Суббота по Богоявлению', 'Samstag nach der Theophanie', 'Сꙋббѡ́та по бг҃оѧвле́нїи'],
  ['Неделя по Богоявлению', 'Sonntag nach der Theophanie', 'Недѣ́лѧ по бг҃оѧвле́нїи'],
  ['Суббота перед Воздвижением', 'Samstag vor der Kreuzerhöhung', 'Сꙋббѡ́та пред̾ воздви́женїемъ'],
  ['Суббота перед Рождеством', 'Samstag vor der Geburt Christi', 'Сꙋббѡ́та пред̾ ржⷭ҇тво́мъ'],
  ['Неделя перед Рождеством', 'Sonntag vor der Geburt Christi', 'Недѣ́лѧ пред̾ ржⷭ҇тво́мъ'],
  ['Суббота по Рождеству', 'Samstag nach der Geburt Christi', 'Сꙋббѡ́та по ржⷭ҇твѣ̀'],
  ['Неделя по Рождеству', 'Sonntag nach der Geburt Christi', 'Недѣ́лѧ по ржⷭ҇твѣ̀'],
  ['Неделя перед Воздвижением', 'Sonntag vor der Kreuzerhöhung', 'Недѣ́лѧ пред̾ воздви́женїемъ'],
  ['Суббота по Воздвижению', 'Samstag nach der Kreuzerhöhung', 'Сꙋббѡ́та по воздви́женїи'],
  ['Неделя по Воздвижению', 'Sonntag nach der Kreuzerhöhung', 'Недѣ́лѧ по воздви́женїи'],
];

const dictionaries = {
  de: new Map(LABELS.map(([ru, de]) => [ru, de])),
  cu: new Map(LABELS.map(([ru, , cu]) => [ru, cu])),
};

export function localizedReadingDescription(text: string, language: CalendarLanguage): string {
  return language === 'de' || language === 'cu' ? dictionaries[language].get(text) ?? text : text;
}
