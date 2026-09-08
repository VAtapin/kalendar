/** Exact translations of the finite XML fasting labels. These labels neither
 * calculate the fasting rule nor alter the user's selected fasting profile.
 */
const TITLES: Record<string, {de:string;cu:string}> = {
  'Великий пост': {de:'Große Fastenzeit',cu:'Вели́кїй по́стъ'},
  'Пост (Крещенский сочельник - Навечерие Богоявления)': {de:'Fasten (Vorabend der Theophanie – Vorabend der Taufe des Herrn)',cu:'По́стъ (Креще́нскій соче́льникъ — Навече́рїе Бг҃оѧвле́нїѧ)'},
  'Петров (Апостольский) пост': {de:'Petrusfasten (Apostelfasten)',cu:'Петро́въ (А҆по́стольскїй) по́стъ'},
  'Успенский пост': {de:'Fastenzeit vor dem Entschlafen der Gottesgebärerin',cu:'Оу҆спе́нскїй по́стъ'},
  'Пост (Усекновение главы Иоанна Предтечи)': {de:'Fasten (Enthauptung Johannes des Vorläufers)',cu:'По́стъ (Оу҆сѣкнове́нїе главы̀ І҆ѡа́нна Прⷣте́чи)'},
  'Пост (Воздвижение Креста Господня)': {de:'Fasten (Erhöhung des Kreuzes des Herrn)',cu:'По́стъ (Воздвиже́нїе Крⷭ҇та̀ Гдⷭ҇нѧ)'},
  'Рождественский (Филиппов) пост': {de:'Weihnachtsfasten (Philippusfasten)',cu:'Рожде́ственскїй (Філі́пповъ) по́стъ'},
  'Седмица о мытаре и фарисее - сплошная': {de:'Woche des Zöllners und Pharisäers – fastenfrei',cu:'Седми́ца ѡ҆ мытарѣ̀ и҆ фарісе́и — сплошна́ѧ'},
  'Сырная седмица (масленица) - сплошная': {de:'Käsewoche (Butterwoche) – ohne das übliche Mittwochs- und Freitagsfasten',cu:'Сы́рнаѧ седми́ца (ма́сленица) — сплошна́ѧ'},
  'Пасхальная (Светлая) седмица - сплошная': {de:'Paschawoche (Lichte Woche) – fastenfrei',cu:'Пасха́льнаѧ (Свѣ́тлаѧ) седми́ца — сплошна́ѧ'},
  'Троицкая седмица - сплошная': {de:'Woche nach Pfingsten – fastenfrei',cu:'Тро́ицкаѧ седми́ца — сплошна́ѧ'},
  'Святки': {de:'Heilige Tage nach Weihnachten',cu:'Свѧ́тки'},
  'на Богоявление в среду поста нет': {de:'An Theophanie entfällt das Mittwochsfasten',cu:'Въ Бг҃оѧвле́нїе въ сре́дꙋ поста̀ нѣ́сть'},
  'на Богоявление в пятницу поста нет': {de:'An Theophanie entfällt das Freitagsfasten',cu:'Въ Бг҃оѧвле́нїе въ пѧто́къ поста̀ нѣ́сть'},
  'на Рождество в среду поста нет': {de:'An Weihnachten entfällt das Mittwochsfasten',cu:'Въ Рождество̀ въ сре́дꙋ поста̀ нѣ́сть'},
  'на Рождество в пятницу поста нет': {de:'An Weihnachten entfällt das Freitagsfasten',cu:'Въ Рождество̀ въ пѧто́къ поста̀ нѣ́сть'},
};
export function localizeFastingTitle(title:string, language:string):string|undefined {
  return (language==='de'||language==='cu') && Object.hasOwn(TITLES,title) ? TITLES[title]![language] : undefined;
}
