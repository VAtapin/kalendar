import type { CalendarLanguage } from '../../document/types';

// The XML's 138 descriptions contain 41 distinct lection occasion labels.
// These are editorial translations, not the Scripture passages themselves.
const LABELS: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['Навечерие Богоявления', 'Vorabend der Theophanie', 'Навече́рїе бг҃оѧвле́нїѧ', "Навечір'я Богоявлення", "Wigilia Objawienia Pańskiego"],
  ['Навечерие Рождества Христова', 'Vorabend der Geburt Christi', 'Навече́рїе ржⷭ҇тва̀ хрⷭ҇то́ва', "Навечір'я Різдва Христового", "Wigilia Narodzenia Chrystusa"],
  ['Обрезание Господне', 'Beschneidung des Herrn', 'Ѡ҆брѣ́занїе гдⷭ҇не', "Обрізання Господнє", "Obrzezanie Pańskie"],
  ['Богоявление', 'Theophanie', 'Бг҃оѧвле́нїе', "Богоявлення", "Objawienie Pańskie"],
  ['Сретение', 'Begegnung des Herrn', 'Срѣ́тенїе', "Стрітення", "Spotkanie Pańskie"],
  ['Преображение', 'Verklärung des Herrn', 'Преѡбраже́нїе', "Преображення", "Przemienienie Pańskie"],
  ['Воздвижение', 'Kreuzerhöhung', 'Воздви́женїе', "Воздвиження", "Podwyższenie Krzyża"],
  ['Рождество', 'Geburt Christi', 'Ржⷭ҇тво̀', "Різдво", "Narodzenie Chrystusa"],
  ['Благовещение', 'Verkündigung an die Gottesgebärerin', 'Бл҃говѣ́щенїе', "Благовіщення", "Zwiastowanie"],
  ['Успение Богородицы', 'Entschlafen der Gottesgebärerin', 'ᲂу҆спе́нїе бцⷣы', "Успіння Богородиці", "Zaśnięcie Bogurodzicy"],
  ['Рождество Богородицы', 'Geburt der Gottesgebärerin', 'Ржⷭ҇тво̀ бцⷣы', "Різдво Богородиці", "Narodzenie Bogurodzicy"],
  ['Покров', 'Schutz der Gottesgebärerin', 'Покро́въ', "Покров", "Opieka Bogurodzicy"],
  ['Введение', 'Einführung der Gottesgebärerin in den Tempel', 'Введе́нїе', "Введення", "Wprowadzenie Bogurodzicy do świątyni"],
  ['Антония Великого', 'Antonios des Großen', 'А҆нтѡ́нїа вели́кагѡ', "Антонія Великого", "Antoniego Wielkiego"],
  ['Евфимия Великого', 'Euthymios des Großen', 'Є҆ѵѳѵ́мїа вели́кагѡ', "Євфимія Великого", "Eutymiusza Wielkiego"],
  ['Свв. Василия Великого, Григория Богослова и Иоанна Златоустого', 'Der hll. Basileios des Großen, Gregorios des Theologen und Johannes Chrysostomos', 'Ст҃ы́хъ васі́лїа вели́кагѡ, григо́рїа бг҃осло́ва и҆ і҆ѡа́нна златоꙋ́стаго', "Свв. Василія Великого, Григорія Богослова та Іоанна Златоустого", "Świętych Bazylego Wielkiego, Grzegorza Teologa i Jana Złotoustego"],
  ['Георгия Победоносца', 'Georgios des Siegesträgers', 'Геѡ́ргїа побѣдоно́сца', "Георгія Побідоносця", "Jerzego Zwycięzcy"],
  ['Иоанна Богослова', 'Johannes des Theologen', 'І҆ѡа́нна бг҃осло́ва', "Іоанна Богослова", "Jana Teologa"],
  ['Кирилла и Мефодия', 'Kyrillos und Methodios', 'Кѵрі́лла и҆ меѳо́дїа', "Кирила і Мефодія", "Cyryla i Metodego"],
  ['Рожд. Иоанна Предтечи', 'Geburt Johannes des Vorläufers', 'Ржⷭ҇тво̀ і҆ѡа́нна предте́чи', "Різд. Іоанна Предтечі", "Narodzenie Jana Poprzednika"],
  ['Петра и Павла', 'Petros und Paulos', 'Петра̀ и҆ па́вла', "Петра і Павла", "Piotra i Pawła"],
  ['Казанской иконы Богоматери', 'Kasaner Ikone der Gottesmutter', 'Каза́нскїѧ і҆кѡ́ны бг҃ома́тере', "Казанської ікони Богоматері", "Kazańskiej ikony Matki Bożej"],
  ['кн. Владимира', 'Fürst Vladimir', 'Кнѧ́зѧ влади́мїра', "кн. Володимира", "księcia Włodzimierza"],
  ['Серафима Саровского', 'Seraphim von Sarov', 'Серафі́ма саро́вскагѡ', "Серафима Саровського", "Serafina Sarowskiego"],
  ['Усекновение главы Иоанна Предтечи', 'Enthauptung Johannes des Vorläufers', 'ᲂу҆сѣкнове́нїе главы̀ і҆ѡа́нна предте́чи', "Усікновення голови Іоанна Предтечі", "Ścięcie głowy Jana Poprzednika"],
  ['Преставление Иоанна Богослова', 'Heimgang Johannes des Theologen', 'Преставле́нїе і҆ѡа́нна бг҃осло́ва', "Преставлення Іоанна Богослова", "Odejście do Pana Jana Teologa"],
  ['Иоанна Златоустого', 'Johannes Chrysostomos', 'І҆ѡа́нна златоꙋ́стаго', "Іоанна Златоустого", "Jana Złotoustego"],
  ['Саввы Освященного', 'Sabbas des Geheiligten', 'Са́ввы ѡ҆свѧще́ннагѡ', "Сави Освяченого", "Saby Uświęconego"],
  ['Николая Мирликийского', 'Nikolaos von Myra in Lykien', 'Нікола́а мѵрлікі́йскагѡ', "Миколая Мирлікійського", "Mikołaja z Miry Licyjskiej"],
  ['Суббота перед Богоявлением', 'Samstag vor der Theophanie', 'Сꙋббѡ́та пред̾ бг҃оѧвле́нїемъ', "Субота перед Богоявленням", "Sobota przed Objawieniem Pańskim"],
  ['Неделя перед Богоявлением', 'Sonntag vor der Theophanie', 'Недѣ́лѧ пред̾ бг҃оѧвле́нїемъ', "Неділя перед Богоявленням", "Niedziela przed Objawieniem Pańskim"],
  ['Суббота по Богоявлению', 'Samstag nach der Theophanie', 'Сꙋббѡ́та по бг҃оѧвле́нїи', "Субота після Богоявлення", "Sobota po Objawieniu Pańskim"],
  ['Неделя по Богоявлению', 'Sonntag nach der Theophanie', 'Недѣ́лѧ по бг҃оѧвле́нїи', "Неділя після Богоявлення", "Niedziela po Objawieniu Pańskim"],
  ['Суббота перед Воздвижением', 'Samstag vor der Kreuzerhöhung', 'Сꙋббѡ́та пред̾ воздви́женїемъ', "Субота перед Воздвиженням", "Sobota przed Podwyższeniem Krzyża"],
  ['Суббота перед Рождеством', 'Samstag vor der Geburt Christi', 'Сꙋббѡ́та пред̾ ржⷭ҇тво́мъ', "Субота перед Різдвом", "Sobota przed Narodzeniem Chrystusa"],
  ['Неделя перед Рождеством', 'Sonntag vor der Geburt Christi', 'Недѣ́лѧ пред̾ ржⷭ҇тво́мъ', "Неділя перед Різдвом", "Niedziela przed Narodzeniem Chrystusa"],
  ['Суббота по Рождеству', 'Samstag nach der Geburt Christi', 'Сꙋббѡ́та по ржⷭ҇твѣ̀', "Субота після Різдва", "Sobota po Narodzeniu Chrystusa"],
  ['Неделя по Рождеству', 'Sonntag nach der Geburt Christi', 'Недѣ́лѧ по ржⷭ҇твѣ̀', "Неділя після Різдва", "Niedziela po Narodzeniu Chrystusa"],
  ['Неделя перед Воздвижением', 'Sonntag vor der Kreuzerhöhung', 'Недѣ́лѧ пред̾ воздви́женїемъ', "Неділя перед Воздвиженням", "Niedziela przed Podwyższeniem Krzyża"],
  ['Суббота по Воздвижению', 'Samstag nach der Kreuzerhöhung', 'Сꙋббѡ́та по воздви́женїи', "Субота після Воздвиження", "Sobota po Podwyższeniu Krzyża"],
  ['Неделя по Воздвижению', 'Sonntag nach der Kreuzerhöhung', 'Недѣ́лѧ по воздви́женїи', "Неділя після Воздвиження", "Niedziela po Podwyższeniu Krzyża"],
];

const dictionaries = {
  de: new Map(LABELS.map(([ru, de]) => [ru, de])),
  cu: new Map(LABELS.map(([ru, , cu]) => [ru, cu])),
  uk: new Map(LABELS.map(([ru, , , uk]) => [ru, uk])),
  pl: new Map(LABELS.map(([ru, , , , pl]) => [ru, pl])),
};

export function localizedReadingDescription(text: string, language: CalendarLanguage): string {
  return language === 'ru' ? text : dictionaries[language].get(text) ?? text;
}
