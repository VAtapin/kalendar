/** Exact translations of the finite XML fasting labels. These labels neither
 * calculate the fasting rule nor alter the user's selected fasting profile.
 */
const TITLES: Record<string, {de:string;cu:string;uk:string;pl:string}> = {
  'Великий пост': {de:'Große Fastenzeit',cu:'Вели́кїй по́стъ',uk:"Великий піст",pl:"Wielki Post"},
  'Пост (Крещенский сочельник - Навечерие Богоявления)': {de:'Fasten (Vorabend der Theophanie – Vorabend der Taufe des Herrn)',cu:'По́стъ (Креще́нскій соче́льникъ — Навече́рїе Бг҃оѧвле́нїѧ)',uk:"Піст (Хрещенський святвечір — Навечір'я Богоявлення)",pl:"Post (Wigilia Chrztu Pańskiego — Wigilia Objawienia Pańskiego)"},
  'Петров (Апостольский) пост': {de:'Petrusfasten (Apostelfasten)',cu:'Петро́въ (А҆по́стольскїй) по́стъ',uk:"Петрів (Апостольський) піст",pl:"Post Piotrowy (Apostolski)"},
  'Успенский пост': {de:'Fastenzeit vor dem Entschlafen der Gottesgebärerin',cu:'Оу҆спе́нскїй по́стъ',uk:"Успенський піст",pl:"Post przed Zaśnięciem Bogurodzicy"},
  'Пост (Усекновение главы Иоанна Предтечи)': {de:'Fasten (Enthauptung Johannes des Vorläufers)',cu:'По́стъ (Оу҆сѣкнове́нїе главы̀ І҆ѡа́нна Прⷣте́чи)',uk:"Піст (Усікновення голови Іоанна Предтечі)",pl:"Post (Ścięcie głowy Jana Poprzednika)"},
  'Пост (Воздвижение Креста Господня)': {de:'Fasten (Erhöhung des Kreuzes des Herrn)',cu:'По́стъ (Воздвиже́нїе Крⷭ҇та̀ Гдⷭ҇нѧ)',uk:"Піст (Воздвиження Хреста Господнього)",pl:"Post (Podwyższenie Krzyża Pańskiego)"},
  'Рождественский (Филиппов) пост': {de:'Weihnachtsfasten (Philippusfasten)',cu:'Рожде́ственскїй (Філі́пповъ) по́стъ',uk:"Різдвяний (Пилипів) піст",pl:"Post Bożonarodzeniowy (Filipowy)"},
  'Седмица о мытаре и фарисее - сплошная': {de:'Woche des Zöllners und Pharisäers – fastenfrei',cu:'Седми́ца ѡ҆ мытарѣ̀ и҆ фарісе́и — сплошна́ѧ',uk:"Седмиця про митаря і фарисея — суцільна",pl:"Tydzień o celniku i faryzeuszu — bez postu"},
  'Сырная седмица (масленица) - сплошная': {de:'Käsewoche (Butterwoche) – ohne das übliche Mittwochs- und Freitagsfasten',cu:'Сы́рнаѧ седми́ца (ма́сленица) — сплошна́ѧ',uk:"Сирна седмиця (масниця) — суцільна",pl:"Tydzień serowy (maslenica) — bez zwykłego postu w środy i piątki"},
  'Пасхальная (Светлая) седмица - сплошная': {de:'Paschawoche (Lichte Woche) – fastenfrei',cu:'Пасха́льнаѧ (Свѣ́тлаѧ) седми́ца — сплошна́ѧ',uk:"Пасхальна (Світла) седмиця — суцільна",pl:"Tydzień Paschalny (Świetlisty) — bez postu"},
  'Троицкая седмица - сплошная': {de:'Woche nach Pfingsten – fastenfrei',cu:'Тро́ицкаѧ седми́ца — сплошна́ѧ',uk:"Троїцька седмиця — суцільна",pl:"Tydzień Trójcy Świętej — bez postu"},
  'Святки': {de:'Heilige Tage nach Weihnachten',cu:'Свѧ́тки',uk:"Святки",pl:"Święte dni po Bożym Narodzeniu"},
  'на Богоявление в среду поста нет': {de:'An Theophanie entfällt das Mittwochsfasten',cu:'Въ Бг҃оѧвле́нїе въ сре́дꙋ поста̀ нѣ́сть',uk:"на Богоявлення в середу посту немає",pl:"w Objawienie Pańskie w środę nie ma postu"},
  'на Богоявление в пятницу поста нет': {de:'An Theophanie entfällt das Freitagsfasten',cu:'Въ Бг҃оѧвле́нїе въ пѧто́къ поста̀ нѣ́сть',uk:"на Богоявлення в п'ятницю посту немає",pl:"w Objawienie Pańskie w piątek nie ma postu"},
  'на Рождество в среду поста нет': {de:'An Weihnachten entfällt das Mittwochsfasten',cu:'Въ Рождество̀ въ сре́дꙋ поста̀ нѣ́сть',uk:"на Різдво в середу посту немає",pl:"w Boże Narodzenie w środę nie ma postu"},
  'на Рождество в пятницу поста нет': {de:'An Weihnachten entfällt das Freitagsfasten',cu:'Въ Рождество̀ въ пѧто́къ поста̀ нѣ́сть',uk:"на Різдво в п'ятницю посту немає",pl:"w Boże Narodzenie w piątek nie ma postu"},
};
export function localizeFastingTitle(title:string, language:string):string|undefined {
  return (language==='de'||language==='cu'||language==='uk'||language==='pl') && Object.hasOwn(TITLES,title) ? TITLES[title]![language] : undefined;
}
