// Finite explanatory labels from XML. This does not add prohibitions or make
// pastoral decisions. No unknown feast/person is translated by substitution.
const CONDITIONS: Record<string, [string,string]> = {
  'в Неделю мясопустную': ['am Sonntag des Fleischverzichts','въ недѣ́лю мѧсопꙋ́стнꙋю'],
  'в течение Сырной седмицы (масленицы)': ['während der Käsewoche (Butterwoche)','въ тече́нїе сы́рныѧ седми́цы (ма́сленицы)'],
  'в Неделю сыропустную': ['am Sonntag des Käseverzichts','въ недѣ́лю сыропꙋ́стнꙋю'],
  'накануне праздника Входа Господня в Иерусалим': ['am Vorabend des Einzugs des Herrn in Jerusalem','въ навече́рїе пра́здника Вхо́да Гдⷭ҇нѧ во І҆ерꙋсали́мъ'],
  'в продолжение Великого поста': ['während der Großen Fastenzeit','въ продолже́нїе Вели́кагѡ поста̀'],
  'накануне Светлого Христова Воскресения (Пасхи)': ['am Vorabend der lichten Auferstehung Christi (Pascha)','въ навече́рїе Свѣ́тлагѡ Хрⷭ҇то́ва Воскрⷭ҇нїѧ (Па́схи)'],
  'в течение Пасхальной (Светлой) седмицы': ['während der Paschawoche (Lichten Woche)','въ тече́нїе Пасха́льныѧ (Свѣ́тлыѧ) седми́цы'],
  'накануне праздника Вознесения Господня': ['am Vorabend der Himmelfahrt des Herrn','въ навече́рїе пра́здника Вознесе́нїѧ Гдⷭ҇нѧ'],
  'накануне праздника Дня Святой Троицы (Пятидесятницы)': ['am Vorabend des Festes der Heiligen Dreifaltigkeit (Pfingsten)','въ навече́рїе пра́здника Днѐ Ст҃ы́ѧ Тро́ицы (Пѧтдесѧ́тницы)'],
  'в продолжение Святок': ['während der heiligen Tage nach Weihnachten','въ продолже́нїе Свѧ́токъ'],
  'накануне праздника Святого Богоявления (Крещения Господа Бога и Спаса нашего Иисуса Христа)': ['am Vorabend der heiligen Theophanie (Taufe unseres Herrn und Gottes und Erlösers Jesus Christus)','въ навече́рїе пра́здника Ст҃а́гѡ Бг҃оѧвле́нїѧ (Кр҃ще́нїѧ Гдⷭ҇а Бг҃а и҆ Сп҃са на́шегѡ І҆и҃са Хрⷭ҇та̀)'],
  'накануне праздника Сретения Господа Нашего Иисуса Христа': ['am Vorabend der Begegnung unseres Herrn Jesus Christus','въ навече́рїе пра́здника Срѣ́тенїѧ Гдⷭ҇а на́шегѡ І҆и҃са Хрⷭ҇та̀'],
  'накануне праздника Благовещения Пресвятой Богородицы': ['am Vorabend der Verkündigung an die allheilige Gottesgebärerin','въ навече́рїе пра́здника Благовѣще́нїѧ Прест҃ы́ѧ Бг҃оро́дицы'],
  'накануне праздника Рождества честного славного Пророка, Предтечи и Крестителя Господня Иоанна': ['am Vorabend der Geburt des ehrwürdigen und ruhmreichen Propheten, Vorläufers und Täufers des Herrn Johannes','въ навече́рїе пра́здника Рождества̀ честна́гѡ сла́внагѡ Прⷪ҇ро́ка, Прⷣте́чи и҆ Крⷭ҇ти́телѧ Гдⷭ҇нѧ І҆ѡа́нна'],
  'в продолжение Петрова (Апостольского) поста': ['während des Petrusfastens (Apostelfastens)','въ продолже́нїе Петро́ва (А҆по́стольскагѡ) поста̀'],
  'накануне праздника Славных и всехвальных первоверховных апостолов Петра и Павла': ['am Vorabend des Festes der ruhmreichen und allgepriesenen Erstapostel Petrus und Paulus','въ навече́рїе пра́здника сла́вныхъ и҆ всехва́льныхъ первоверхо́вныхъ а҆пⷭ҇лъ Петра̀ и҆ Па́ѵла'],
  'накануне праздника Преображения Господа Бога и Спаса нашего Иисуса Христа': ['am Vorabend der Verklärung unseres Herrn und Gottes und Erlösers Jesus Christus','въ навече́рїе пра́здника Преѡбраже́нїѧ Гдⷭ҇а Бг҃а и҆ Сп҃са на́шегѡ І҆и҃са Хрⷭ҇та̀'],
  'в продолжение Успенского поста': ['während der Fastenzeit vor dem Entschlafen der Gottesgebärerin','въ продолже́нїе Оу҆спе́нскагѡ поста̀'],
  'накануне праздника Успения Пресвятой Владычицы нашей Богородицы и Приснодевы Марии': ['am Vorabend des Entschlafens unserer allheiligen Herrin, der Gottesgebärerin und Immerjungfrau Maria','въ навече́рїе пра́здника Оу҆спе́нїѧ Прест҃ы́ѧ Влⷣчцы на́шеѧ Бг҃оро́дицы и҆ Приснодѣ́вы Марі́и'],
  'накануне праздника Усекновения главы Пророка, Предтечи и Крестителя Господня Иоанна': ['am Vorabend der Enthauptung des Propheten, Vorläufers und Täufers des Herrn Johannes','въ навече́рїе пра́здника Оу҆сѣкнове́нїѧ главы̀ Прⷪ҇ро́ка, Прⷣте́чи и҆ Крⷭ҇ти́телѧ Гдⷭ҇нѧ І҆ѡа́нна'],
  'в день Усекновения главы Иоанна Предтечи': ['am Tag der Enthauptung Johannes des Vorläufers','въ де́нь Оу҆сѣкнове́нїѧ главы̀ І҆ѡа́нна Прⷣте́чи'],
  'накануне праздника Рождества Пресвятой Владычицы нашей Богородицы и Приснодевы Марии': ['am Vorabend der Geburt unserer allheiligen Herrin, der Gottesgebärerin und Immerjungfrau Maria','въ навече́рїе пра́здника Рождества̀ Прест҃ы́ѧ Влⷣчцы на́шеѧ Бг҃оро́дицы и҆ Приснодѣ́вы Марі́и'],
  'накануне праздника Воздвижения Честного и Животворящего Креста Господня': ['am Vorabend der Erhöhung des ehrwürdigen und lebenspendenden Kreuzes des Herrn','въ навече́рїе пра́здника Воздвиже́нїѧ Честна́гѡ и҆ Животворѧ́щагѡ Крⷭ҇та̀ Гдⷭ҇нѧ'],
  'в день Воздвижения Креста Господня': ['am Tag der Erhöhung des Kreuzes des Herrn','въ де́нь Воздвиже́нїѧ Крⷭ҇та̀ Гдⷭ҇нѧ'],
  'накануне праздника Покрова Пресвятой Владычицы нашей Богородицы и Приснодевы Марии': ['am Vorabend des Schutzes unserer allheiligen Herrin, der Gottesgebärerin und Immerjungfrau Maria','въ навече́рїе пра́здника Покро́ва Прест҃ы́ѧ Влⷣчцы на́шеѧ Бг҃оро́дицы и҆ Приснодѣ́вы Марі́и'],
  'накануне праздника Введения во храм Пресвятой Владычицы нашей Богородицы и Приснодевы Марии': ['am Vorabend des Einzugs unserer allheiligen Herrin, der Gottesgebärerin und Immerjungfrau Maria, in den Tempel','въ навече́рїе пра́здника Введе́нїѧ во хра́мъ Прест҃ы́ѧ Влⷣчцы на́шеѧ Бг҃оро́дицы и҆ Приснодѣ́вы Марі́и'],
  'в продолжение Рождественского (Филиппова) поста': ['während des Weihnachtsfastens (Philippusfastens)','въ продолже́нїе Рожде́ственскагѡ (Філі́ппова) поста̀'],
  'накануне праздника Рождества Господа и Спаса нашего Иисуса Христа': ['am Vorabend der Geburt unseres Herrn und Erlösers Jesus Christus','въ навече́рїе пра́здника Рождества̀ Гдⷭ҇а и҆ Сп҃са на́шегѡ І҆и҃са Хрⷭ҇та̀'],
  'накануне праздника Обрезания Господня': ['am Vorabend der Beschneidung des Herrn','въ навече́рїе пра́здника Обрѣ́занїѧ Гдⷭ҇нѧ'],
};
export function localizeMarriageTitle(title:string, language:string):string|undefined {
  const prefix = 'Браковенчание не совершается ';
  if ((language!=='de'&&language!=='cu') || !title.startsWith(prefix)) return undefined;
  const key = title.slice(prefix.length);
  if (!Object.hasOwn(CONDITIONS,key)) return undefined;
  return language==='de' ? `Die kirchliche Trauung wird ${CONDITIONS[key]![0]} nicht vollzogen`
    : `Браковѣнча́нїе не соверша́етсѧ ${CONDITIONS[key]![1]}`;
}
