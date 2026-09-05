import type { CalendarLanguage, PageModel, TextElement } from "../../document/types";
import type { ResolvedCalendarEvent } from "../types";
import type { FoodRuleId } from "../fasting/fasting-api";

/**
 * Editorial sources for ecclesiastical terminology (checked 2026-09-05):
 * - cu: Ponomar language packs, https://github.com/typiconman/ponomar
 * - de: Orthodoxer Kirchenkalender and Menaion, orthodox-verlag.de / orthodoxe-kirche.de
 * - uk: Православний церковний календар ПЦУ, pomisna.info
 * - pl: Kalendarz Prawosławny and Horologion, liturgia.cerkiew.pl
 * Russian source records remain immutable; localization is presentation-only.
 */

export interface CalendarLanguageOption {
  id: CalendarLanguage;
  label: string;
}

export const CALENDAR_LANGUAGE_OPTIONS: readonly CalendarLanguageOption[] = [
  { id: "ru", label: "Русский" },
  { id: "cu", label: "Церковнославянский" },
  { id: "de", label: "Deutsch" },
  { id: "uk", label: "Українська" },
  { id: "pl", label: "Polski" },
] as const;

const MONTHS: Record<CalendarLanguage, readonly string[]> = {
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  cu: ["і҆аннꙋарїй", "феѵрꙋа́лїй", "ма́ртъ", "а҆прі́ллїй", "ма́їй", "і҆ꙋ́нїй", "і҆ꙋ́лїй", "а҆́ѵгꙋстъ", "септе́мврїй", "о҆ктѡ́врїй", "ное́мврїй", "деке́мврїй"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  uk: ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"],
  pl: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
};

const WEEKDAYS: Record<CalendarLanguage, { full: readonly string[]; short: readonly string[] }> = {
  ru: { full: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"], short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] },
  cu: { full: ["понедѣ́льникъ", "вто́рникъ", "сре́да", "четверто́къ", "пѧто́къ", "сꙋббѡ́та", "недѣ́лѧ"], short: ["пн҃", "вт҃", "ср҃", "чт҃", "пт҃", "сб҃", "нд҃"] },
  de: { full: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"], short: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] },
  uk: { full: ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"], short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] },
  pl: { full: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"], short: ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"] },
};

const FOOD_LABELS: Record<CalendarLanguage, Record<FoodRuleId, string>> = {
  ru: { "no-fast": "", fast: "постный день", fish: "разрешается рыба", oil: "пища с маслом", "boiled-no-oil": "пища без масла", "dry-eating": "сухоядение", "strict-fast": "строгий пост", "dairy-eggs": "молочное и яйца", memorial: "поминовение усопших" },
  cu: { "no-fast": "", fast: "де́нь по́стный", fish: "ры́ба разреша́етсѧ", oil: "пи́ща съ є҆ле́емъ", "boiled-no-oil": "варе́нїе безъ є҆ле́а", "dry-eating": "сꙋхояде́нїе", "strict-fast": "стро́гїй по́стъ", "dairy-eggs": "мле́чнаѧ пи́ща и҆ ѧ҆́йца", memorial: "помина́нїе ѹ҆со́пшихъ" },
  de: { "no-fast": "", fast: "Fasttag", fish: "Fisch erlaubt", oil: "Speise mit Öl", "boiled-no-oil": "gekochte Speise ohne Öl", "dry-eating": "Trockenkost", "strict-fast": "strenges Fasten", "dairy-eggs": "Milchprodukte und Eier", memorial: "Totengedenken" },
  uk: { "no-fast": "", fast: "пісний день", fish: "дозволяється риба", oil: "їжа з олією", "boiled-no-oil": "варена їжа без олії", "dry-eating": "сухоїдіння", "strict-fast": "суворий піст", "dairy-eggs": "молочні продукти та яйця", memorial: "поминання спочилих" },
  pl: { "no-fast": "", fast: "dzień postny", fish: "ryba dozwolona", oil: "pokarm z olejem", "boiled-no-oil": "potrawa gotowana bez oleju", "dry-eating": "suche pokarmy", "strict-fast": "ścisły post", "dairy-eggs": "nabiał i jajka", memorial: "wspomnienie zmarłych" },
};

const CORE_EVENTS: Record<Exclude<CalendarLanguage, "ru">, Record<string, string>> = {
  cu: {
    "Светлое Христово Воскресение. Пасха": "Свѣ́тлое хрⷭ҇то́во воскрⷭ҇нїе. Па́сха",
    "Вход Господень в Иерусалим": "Вхо́дъ гдⷭ҇ень во і҆ерꙋсали́мъ",
    "Вознесение Господне": "Вознесе́нїе гдⷭ҇не",
    "День Святой Троицы. Пятидесятница": "Де́нь ст҃ыѧ трⷪ҇цы. Пѧтдесѧ́тница",
    "Святое Богоявление. Крещение Господа Бога и Спаса нашего Иисуса Христа": "Ст҃о́е бг҃оѧвле́нїе. Кр҃ще́нїе гдⷭ҇а бг҃а и҆ сп҃са на́шегѡ і҆и҃са хрⷭ҇та̀",
    "Сретение Господа Нашего Иисуса Христа": "Срѣ́тенїе гдⷭ҇а на́шегѡ і҆и҃са хрⷭ҇та̀",
    "Благовещение Пресвятой Богородицы": "Бл҃говѣ́щенїе прест҃ы́ѧ бцⷣы",
    "Преображение Господа Бога и Спаса нашего Иисуса Христа": "Преѡбраже́нїе гдⷭ҇а бг҃а и҆ сп҃са на́шегѡ і҆и҃са хрⷭ҇та̀",
    "Успение Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Оу҆спе́нїе прест҃ы́ѧ влⷣчцы на́шеѧ бцⷣы и҆ приснодв҃ы мр҃їи",
    "Рождество Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Ржⷭ҇тво̀ прест҃ы́ѧ влⷣчцы на́шеѧ бцⷣы и҆ приснодв҃ы мр҃їи",
    "Воздвижение Честного и Животворящего Креста Господня": "Воздви́женїе честна́гѡ и҆ животворѧ́щагѡ крⷭ҇та̀ гдⷭ҇нѧ",
    "Введение во храм Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Введе́нїе во хра́мъ прест҃ы́ѧ влⷣчцы на́шеѧ бцⷣы и҆ приснодв҃ы мр҃їи",
    "Рождество Господа и Спаса нашего Иисуса Христа": "Ржⷭ҇тво̀ гдⷭ҇а и҆ сп҃са на́шегѡ і҆и҃са хрⷭ҇та̀",
    "Обрезание Господне": "Ѡ҆брѣ́занїе гдⷭ҇не",
    "Рождество Христово": "Ржⷭ҇тво̀ хрⷭ҇то́во",
    "Богоявление": "Бг҃оѧвле́нїе",
    "Неделя о Закхее": "Недѣ́лѧ ѡ҆ Закхе́и",
    "Неделя о мытаре и фарисее": "Недѣ́лѧ мытарѧ̀ и҆ фарїсе́а",
    "Неделя о блудном сыне": "Недѣ́лѧ ѡ҆ блꙋ́днѣмъ сы́нѣ",
    "Лазарева суббота": "Ла́зарева сꙋббѡ́та",
    "Великий Понедельник": "Вели́кїй понедѣ́льникъ",
    "Великий Вторник": "Вели́кїй вто́рникъ",
    "Великая Среда": "Вели́каѧ сре́да",
    "Великий Четверток": "Вели́кїй четверто́къ",
    "Великий Пяток": "Вели́кїй пѧто́къ",
    "Великая Суббота": "Вели́каѧ сꙋббѡ́та",
    "Торжество Православия": "Торжество̀ правосла́вїѧ",
    "Прощеное воскресенье": "Прощено́е воскрⷭ҇нїе",
    "Преполовение Пятидесятницы": "Преполове́нїе пѧтдесѧ́тницы",
    "День Святого Духа": "Де́нь ст҃а́гѡ дх҃а",
    "Крестопоклонная": "Крестопокло́ннаѧ",
    "Свт. Григория Паламы": "Ст҃и́телѧ Григо́рїѧ Пала́мы",
    "Прп. Иоанна Лествичника": "Прпⷣбнагѡ І҆ѡа́нна Лѣ́ствичника",
    "Прп. Марии Египетской": "Прпⷣбныѧ Марі́и Є҆гѵ́петскїѧ",
    "апостола Фомы. Антипасха": "а҆пⷭ҇ла Ѳѡмы̀. А҆нтипа́сха",
    "святых жен-мироносиц": "ст҃ы́хъ же́нъ-мѵроно́сицъ",
    "о расслабленном": "ѡ҆ разсла́бленнѣмъ",
    "о самаряныне": "ѡ҆ самарѧ́нынѣ",
    "о слепом": "ѡ҆ слѣпе́мъ",
  },
  uk: {
    "Светлое Христово Воскресение. Пасха": "Світле Христове Воскресіння. Пасха",
    "Вход Господень в Иерусалим": "Вхід Господній в Єрусалим",
    "Вознесение Господне": "Вознесіння Господнє",
    "День Святой Троицы. Пятидесятница": "День Святої Тройці. П’ятидесятниця",
    "Святое Богоявление. Крещение Господа Бога и Спаса нашего Иисуса Христа": "Святе Богоявлення. Хрещення Господа Бога і Спаса нашого Ісуса Христа",
    "Сретение Господа Нашего Иисуса Христа": "Стрітення Господа нашого Ісуса Христа",
    "Благовещение Пресвятой Богородицы": "Благовіщення Пресвятої Богородиці",
    "Преображение Господа Бога и Спаса нашего Иисуса Христа": "Преображення Господа Бога і Спаса нашого Ісуса Христа",
    "Успение Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Успіння Пресвятої Владичиці нашої Богородиці і Приснодіви Марії",
    "Рождество Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Різдво Пресвятої Владичиці нашої Богородиці і Приснодіви Марії",
    "Воздвижение Честного и Животворящего Креста Господня": "Воздвиження Чесного і Животворчого Хреста Господнього",
    "Введение во храм Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Введення у храм Пресвятої Владичиці нашої Богородиці і Приснодіви Марії",
    "Рождество Господа и Спаса нашего Иисуса Христа": "Різдво Господа і Спаса нашого Ісуса Христа",
    "Обрезание Господне": "Обрізання Господнє",
    "Рождество Христово": "Різдво Христове",
    "Богоявление": "Богоявлення",
    "Собор Пресвятой Богородицы": "Собор Пресвятої Богородиці",
    "Неделя о Закхее": "Неділя про Закхея",
    "Неделя о мытаре и фарисее": "Неділя про митаря і фарисея",
    "Неделя о блудном сыне": "Неділя про блудного сина",
    "Лазарева суббота": "Лазарева субота",
    "Великий Понедельник": "Великий понеділок",
    "Великий Вторник": "Великий вівторок",
    "Великая Среда": "Велика середа",
    "Великий Четверток": "Великий четвер",
    "Великий Пяток": "Велика п’ятниця",
    "Великая Суббота": "Велика субота",
    "Торжество Православия": "Торжество Православ’я",
    "Прощеное воскресенье": "Прощена неділя",
    "Преполовение Пятидесятницы": "Переполовення П’ятидесятниці",
    "День Святого Духа": "День Святого Духа",
    "Крестопоклонная": "Хрестопоклонна",
    "Свт. Григория Паламы": "Свт. Григорія Палами",
    "Прп. Иоанна Лествичника": "Прп. Іоана Ліствичника",
    "Прп. Марии Египетской": "Прп. Марії Єгипетської",
    "апостола Фомы. Антипасха": "апостола Фоми. Антипасха",
    "святых жен-мироносиц": "святих жінок-мироносиць",
    "о расслабленном": "про розслабленого",
    "о самаряныне": "про самарянку",
    "о слепом": "про сліпого",
  },
  de: {
    "Светлое Христово Воскресение. Пасха": "Die lichte Auferstehung Christi. Pascha",
    "Вход Господень в Иерусалим": "Einzug des Herrn in Jerusalem",
    "Вознесение Господне": "Christi Himmelfahrt",
    "День Святой Троицы. Пятидесятница": "Tag der Heiligen Dreieinigkeit. Pfingsten",
    "Святое Богоявление. Крещение Господа Бога и Спаса нашего Иисуса Христа": "Heilige Theophanie. Taufe unseres Herrn, Gottes und Erlösers Jesus Christus",
    "Сретение Господа Нашего Иисуса Христа": "Begegnung unseres Herrn Jesus Christus",
    "Благовещение Пресвятой Богородицы": "Verkündigung an die Allheilige Gottesgebärerin",
    "Преображение Господа Бога и Спаса нашего Иисуса Христа": "Verklärung unseres Herrn, Gottes und Erlösers Jesus Christus",
    "Успение Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Entschlafung unserer allheiligen Gebieterin, der Gottesgebärerin und Immerjungfrau Maria",
    "Рождество Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Geburt unserer allheiligen Gebieterin, der Gottesgebärerin und Immerjungfrau Maria",
    "Воздвижение Честного и Животворящего Креста Господня": "Erhöhung des kostbaren und lebenspendenden Kreuzes des Herrn",
    "Введение во храм Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Einführung unserer allheiligen Gebieterin, der Gottesgebärerin und Immerjungfrau Maria, in den Tempel",
    "Рождество Господа и Спаса нашего Иисуса Христа": "Geburt unseres Herrn und Gottes und Erlösers Jesus Christus",
    "Обрезание Господне": "Beschneidung des Herrn",
    "Рождество Христово": "Geburt Christi",
    "Богоявление": "Theophanie",
    "Собор Пресвятой Богородицы": "Synaxis der Allheiligen Gottesgebärerin",
    "Неделя о Закхее": "Sonntag des Zachäus",
    "Неделя о мытаре и фарисее": "Sonntag des Zöllners und des Pharisäers",
    "Неделя о блудном сыне": "Sonntag des verlorenen Sohnes",
    "Лазарева суббота": "Lazarus-Samstag",
    "Великий Понедельник": "Großer Montag",
    "Великий Вторник": "Großer Dienstag",
    "Великая Среда": "Großer Mittwoch",
    "Великий Четверток": "Großer Donnerstag",
    "Великий Пяток": "Großer Freitag",
    "Великая Суббота": "Großer Samstag",
    "Торжество Православия": "Triumph der Orthodoxie",
    "Прощеное воскресенье": "Vergebungssonntag",
    "Преполовение Пятидесятницы": "Mittpfingsten",
    "День Святого Духа": "Tag des Heiligen Geistes",
    "Крестопоклонная": "Kreuzverehrung",
    "Свт. Григория Паламы": "Hl. Gregorios Palamas",
    "Прп. Иоанна Лествичника": "Hl. Johannes Klimakos",
    "Прп. Марии Египетской": "Hl. Maria von Ägypten",
    "апостола Фомы. Антипасха": "des Apostels Thomas. Antipascha",
    "святых жен-мироносиц": "der heiligen Myronträgerinnen",
    "о расслабленном": "des Gelähmten",
    "о самаряныне": "der Samariterin",
    "о слепом": "des Blindgeborenen",
  },
  pl: {
    "Светлое Христово Воскресение. Пасха": "Święte Zmartwychwstanie Chrystusa. Pascha",
    "Вход Господень в Иерусалим": "Wjazd Pański do Jerozolimy",
    "Вознесение Господне": "Wniebowstąpienie Pańskie",
    "День Святой Троицы. Пятидесятница": "Dzień Świętej Trójcy. Pięćdziesiątnica",
    "Святое Богоявление. Крещение Господа Бога и Спаса нашего Иисуса Христа": "Święto Objawienia Pańskiego. Chrzest Pana naszego Jezusa Chrystusa",
    "Сретение Господа Нашего Иисуса Христа": "Święto Spotkania Pańskiego",
    "Благовещение Пресвятой Богородицы": "Zwiastowanie Przenajświętszej Bogurodzicy",
    "Преображение Господа Бога и Спаса нашего Иисуса Христа": "Przemienienie Pańskie",
    "Успение Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Zaśnięcie Przenajświętszej Bogurodzicy",
    "Рождество Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Narodzenie Przenajświętszej Bogurodzicy",
    "Воздвижение Честного и Животворящего Креста Господня": "Podwyższenie Krzyża Pańskiego",
    "Введение во храм Пресвятой Владычицы нашей Богородицы и Приснодевы Марии": "Wprowadzenie Przenajświętszej Bogurodzicy do Świątyni",
    "Рождество Господа и Спаса нашего Иисуса Христа": "Narodzenie Chrystusa",
    "Обрезание Господне": "Obrzezanie Pańskie",
    "Рождество Христово": "Narodzenie Chrystusa",
    "Богоявление": "Objawienie Pańskie",
    "Собор Пресвятой Богородицы": "Sobór Przenajświętszej Bogurodzicy",
    "Неделя о Закхее": "Niedziela Zacheusza",
    "Неделя о мытаре и фарисее": "Niedziela o celniku i faryzeuszu",
    "Неделя о блудном сыне": "Niedziela o synu marnotrawnym",
    "Лазарева суббота": "Sobota Łazarza",
    "Великий Понедельник": "Wielki Poniedziałek",
    "Великий Вторник": "Wielki Wtorek",
    "Великая Среда": "Wielka Środa",
    "Великий Четверток": "Wielki Czwartek",
    "Великий Пяток": "Wielki Piątek",
    "Великая Суббота": "Wielka Sobota",
    "Торжество Православия": "Triumf Prawosławia",
    "Прощеное воскресенье": "Niedziela przebaczenia win",
    "Преполовение Пятидесятницы": "Połowa Pięćdziesiątnicy",
    "День Святого Духа": "Dzień Świętego Ducha",
    "Крестопоклонная": "Adoracji Krzyża",
    "Свт. Григория Паламы": "św. Grzegorza Palamasa",
    "Прп. Иоанна Лествичника": "św. Jana Klimaka",
    "Прп. Марии Египетской": "św. Marii Egipcjanki",
    "апостола Фомы. Антипасха": "apostoła Tomasza. Antypascha",
    "святых жен-мироносиц": "świętych niewiast niosących wonności",
    "о расслабленном": "o paralityku",
    "о самаряныне": "o Samarytance",
    "о слепом": "o niewidomym",
  },
};

const FEAST_FORMS: Record<Exclude<CalendarLanguage, "ru">, Record<string, string>> = {
  cu: {
    Богоявления: "Бг҃оѧвле́нїѧ", "Сретения Господня": "Срѣ́тенїѧ гдⷭ҇нѧ", "Благовещения Пресвятой Богородицы": "Бл҃говѣ́щенїѧ прест҃ы́ѧ бцⷣы",
    "Преображения Господня": "Преѡбраже́нїѧ гдⷭ҇нѧ", "Успения Пресвятой Богородицы": "Оу҆спе́нїѧ прест҃ы́ѧ бцⷣы", "Рождества Пресвятой Богородицы": "Ржⷭ҇тва̀ прест҃ы́ѧ бцⷣы",
    "Воздвижения Креста Господня": "Воздви́женїѧ крⷭ҇та̀ гдⷭ҇нѧ", "Введения во храм Пресвятой Богородицы": "Введе́нїѧ во хра́мъ прест҃ы́ѧ бцⷣы", "Рождества Христова": "Ржⷭ҇тва̀ хрⷭ҇то́ва",
    "Преполовения Пятидесятницы": "Преполове́нїѧ пѧтдесѧ́тницы", "Вознесения Господня": "Вознесе́нїѧ гдⷭ҇нѧ", Пятидесятницы: "Пѧтдесѧ́тницы", Пасхи: "Па́схи",
  },
  uk: {
    Богоявления: "Богоявлення", "Сретения Господня": "Стрітення Господнього", "Благовещения Пресвятой Богородицы": "Благовіщення Пресвятої Богородиці",
    "Преображения Господня": "Преображення Господнього", "Успения Пресвятой Богородицы": "Успіння Пресвятої Богородиці", "Рождества Пресвятой Богородицы": "Різдва Пресвятої Богородиці",
    "Воздвижения Креста Господня": "Воздвиження Хреста Господнього", "Введения во храм Пресвятой Богородицы": "Введення у храм Пресвятої Богородиці", "Рождества Христова": "Різдва Христового",
    "Преполовения Пятидесятницы": "Переполовення П’ятидесятниці", "Вознесения Господня": "Вознесіння Господнього", Пятидесятницы: "П’ятидесятниці", Пасхи: "Пасхи",
  },
  de: {
    Богоявления: "der Theophanie", "Сретения Господня": "der Begegnung des Herrn", "Благовещения Пресвятой Богородицы": "der Verkündigung an die Allheilige Gottesgebärerin",
    "Преображения Господня": "der Verklärung des Herrn", "Успения Пресвятой Богородицы": "der Entschlafung der Gottesgebärerin", "Рождества Пресвятой Богородицы": "der Geburt der Gottesgebärerin",
    "Воздвижения Креста Господня": "der Kreuzerhöhung", "Введения во храм Пресвятой Богородицы": "der Einführung der Gottesgebärerin in den Tempel", "Рождества Христова": "der Geburt Christi",
    "Преполовения Пятидесятницы": "von Mittpfingsten", "Вознесения Господня": "der Himmelfahrt des Herrn", Пятидесятницы: "von Pfingsten", Пасхи: "von Pascha",
  },
  pl: {
    Богоявления: "Objawienia Pańskiego", "Сретения Господня": "Spotkania Pańskiego", "Благовещения Пресвятой Богородицы": "Zwiastowania Przenajświętszej Bogurodzicy",
    "Преображения Господня": "Przemienienia Pańskiego", "Успения Пресвятой Богородицы": "Zaśnięcia Przenajświętszej Bogurodzicy", "Рождества Пресвятой Богородицы": "Narodzenia Przenajświętszej Bogurodzicy",
    "Воздвижения Креста Господня": "Podwyższenia Krzyża Pańskiego", "Введения во храм Пресвятой Богородицы": "Wprowadzenia Przenajświętszej Bogurodzicy do Świątyni", "Рождества Христова": "Narodzenia Chrystusa",
    "Преполовения Пятидесятницы": "Połowy Pięćdziesiątnicy", "Вознесения Господня": "Wniebowstąpienia Pańskiego", Пятидесятницы: "Pięćdziesiątnicy", Пасхи: "Paschy",
  },
};

const LITURGICAL_PREFIXES: Record<Exclude<CalendarLanguage, "ru">, Record<string, string>> = {
  cu: { Предпразднство: "Предпра́зднство", Попразднство: "Попра́зднство", "Отдание праздника": "Ѿда́нїе пра́здника" },
  de: { Предпразднство: "Vorfest", Попразднство: "Nachfest", "Отдание праздника": "Festabschluss" },
  uk: { Предпразднство: "Передсвято", Попразднство: "Післясвято", "Отдание праздника": "Віддання свята" },
  pl: { Предпразднство: "Przedświęcie", Попразднство: "Poświęcie", "Отдание праздника": "Zakończenie święta" },
};

const TERM_REPLACEMENTS: Record<Exclude<CalendarLanguage, "ru">, readonly [RegExp, string][]> = {
  cu: [
    [/Предпразднство/gu, "Предпра́зднство"], [/Попразднство/gu, "Попра́зднство"], [/Отдание праздника/gu, "Ѿда́нїе пра́здника"],
    [/Неделя/gu, "Недѣ́лѧ"], [/Пасхи/gu, "Па́схи"], [/Пятидесятнице/gu, "Пѧтдесѧ́тницѣ"], [/Великого поста/gu, "Вели́кагѡ поста̀"],
    [/Преподобн(?:ого|ой)/gu, "Преподо́бнагѡ"], [/Прп\./gu, "Прпⷣб."], [/Свт\./gu, "Ст҃и́телѧ"], [/Мч\./gu, "Мч҃."], [/Мц\./gu, "Мч҃цы"], [/Ап\./gu, "А҆п."],
    [/Святых/gu, "Ст҃ы́хъ"], [/святых/gu, "ст҃ы́хъ"], [/Господня/gu, "Гдⷭ҇нѧ"], [/Господне/gu, "Гдⷭ҇не"], [/Богородицы/gu, "Бцⷣы"],
  ],
  uk: [
    [/Предпразднство/gu, "Передсвято"], [/Попразднство/gu, "Післясвято"], [/Отдание праздника/gu, "Віддання свята"],
    [/Неделя/gu, "Неділя"], [/Великого поста/gu, "Великого посту"], [/Пятидесятнице/gu, "П’ятидесятниці"], [/Пасхи/gu, "Пасхи"],
    [/Прп\./gu, "Прп."], [/Свт\./gu, "Свт."], [/Мчч\./gu, "Мчч."], [/Мч\./gu, "Мч."], [/Мц\./gu, "Мц."], [/Ап\./gu, "Ап."],
    [/Иконы Божией Матери/gu, "Ікони Божої Матері"], [/Божией Матери/gu, "Божої Матері"], [/Господня/gu, "Господнього"], [/Господне/gu, "Господнє"],
    [/Рождеств/gu, "Різдв"], [/Успени/gu, "Успін"], [/Сретени/gu, "Стрітен"], [/Крещени/gu, "Хрещен"], [/Обретение/gu, "Знайдення"], [/Перенесение/gu, "Перенесення"],
  ],
  de: [
    [/Предпразднство/gu, "Vorfest"], [/Попразднство/gu, "Nachfest"], [/Отдание праздника/gu, "Festabschluss"],
    [/Неделя/gu, "Sonntag"], [/Великого поста/gu, "der Großen Fastenzeit"], [/по Пятидесятнице/gu, "nach Pfingsten"], [/по Пасхе/gu, "nach Pascha"],
    [/Сщмчч\./gu, "Hll. Priestermärt."], [/Сщмч\./gu, "Hl. Priestermärt."], [/Прпп\./gu, "Hll."], [/Прп\./gu, "Hl."], [/Свтт\./gu, "Hll. Hierarchen"], [/Свт\./gu, "Hl. Hierarch"], [/Мчч\./gu, "Hll. Märt."], [/Мч\./gu, "Märt."], [/Мцц\./gu, "Märtt."], [/Мц\./gu, "Märt."], [/Вмч\./gu, "Großmärt."], [/Вмц\./gu, "Großmärt."], [/Прмч\./gu, "Mönchsmärt."], [/Прмц\./gu, "Nonnenmärt."], [/Апп\./gu, "Apostel"], [/Ап\./gu, "Apostel"],
    [/Прав\./gu, "Gerechter"], [/Прор\./gu, "Prophet"], [/Равноап\./gu, "Apostelgleicher"], [/Блгв\./gu, "Rechtgläubiger"], [/Блж\./gu, "Seliger"], [/Св\./gu, "Hl."],
    [/архиеп\./giu, "Erzbischof"], [/еп\./giu, "Bischof"], [/митр\./giu, "Metropolit"], [/чудотв\./giu, "Wundertäter"],
    [/Иконы Божией Матери/gu, "Ikone der Gottesmutter"], [/Божией Матери/gu, "der Gottesmutter"], [/Обретение мощей/gu, "Auffindung der Reliquien"], [/Перенесение мощей/gu, "Überführung der Reliquien"],
  ],
  pl: [
    [/Предпразднство/gu, "Przedświęcie"], [/Попразднство/gu, "Poświęcie"], [/Отдание праздника/gu, "Zakończenie święta"],
    [/Неделя/gu, "Niedziela"], [/Великого поста/gu, "Wielkiego Postu"], [/по Пятидесятнице/gu, "po Pięćdziesiątnicy"], [/по Пасхе/gu, "po Passze"],
    [/Сщмчч\./gu, "Św. kapł. męcz."], [/Сщмч\./gu, "Św. kapł. męcz."], [/Прпп\./gu, "Św."], [/Прп\./gu, "Św."], [/Свтт\./gu, "Św. hierarch."], [/Свт\./gu, "Św. hierarch."], [/Мчч\./gu, "Św. męcz."], [/Мч\./gu, "Męcz."], [/Мцц\./gu, "Męcz."], [/Мц\./gu, "Męcz."], [/Вмч\./gu, "Wielki męcz."], [/Вмц\./gu, "Wielka męcz."], [/Прмч\./gu, "Mnich męcz."], [/Прмц\./gu, "Mniszka męcz."], [/Апп\./gu, "Apostołów"], [/Ап\./gu, "Apostoła"],
    [/Прав\./gu, "Sprawiedliwego"], [/Прор\./gu, "Proroka"], [/Равноап\./gu, "Równego Apostołom"], [/Блгв\./gu, "Prawowiernego"], [/Блж\./gu, "Bł."], [/Св\./gu, "Św."],
    [/архиеп\./giu, "abpa"], [/еп\./giu, "bpa"], [/митр\./giu, "metr."], [/чудотв\./giu, "cudotwórcy"],
    [/Иконы Божией Матери/gu, "Ikony Matki Bożej"], [/Божией Матери/gu, "Matki Bożej"], [/Обретение мощей/gu, "Odnalezienie relikwii"], [/Перенесение мощей/gu, "Przeniesienie relikwii"],
  ],
};

const CYRILLIC_LATIN: Record<string, string> = {
  А: "A", Б: "B", В: "W", Г: "G", Д: "D", Е: "E", Ё: "Jo", Ж: "Ż", З: "Z", И: "I", Й: "J", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F", Х: "Ch", Ц: "C", Ч: "Cz", Ш: "Sz", Щ: "Szcz", Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "Ju", Я: "Ja",
};

function transliterateRemainingCyrillic(value: string, language: "de" | "pl"): string {
  return Array.from(value).map((character) => {
    const upper = character.toLocaleUpperCase("ru");
    const mapped = CYRILLIC_LATIN[upper];
    if (mapped === undefined) return character;
    const resolved = language === "de"
      ? mapped.replaceAll("W", "V").replaceAll("Ż", "Sch").replaceAll("Cz", "Tsch").replaceAll("Sz", "Sch").replaceAll("Szcz", "Schtsch")
      : mapped;
    return character === upper ? resolved : resolved.charAt(0).toLocaleLowerCase(language) + resolved.slice(1);
  }).join("");
}

function localizeStructuredLiturgicalTitle(
  title: string,
  language: Exclude<CalendarLanguage, "ru">,
): string | undefined {
  const period = /^(Предпразднство|Попразднство|Отдание праздника) (.+)$/u.exec(title);
  if (period) {
    const sourceBody = period[2]!;
    const sourceFeast = Object.keys(FEAST_FORMS[language])
      .sort((left, right) => right.length - left.length)
      .find((candidate) => sourceBody === candidate || sourceBody.startsWith(`${candidate}.`));
    if (sourceFeast) {
      const feast = FEAST_FORMS[language][sourceFeast]!;
      const suffix = sourceBody.slice(sourceFeast.length);
      const localizedSuffix = suffix.startsWith(". ")
        ? `. ${localizeCalendarEventTitle(suffix.slice(2), language)}`
        : suffix;
      return `${LITURGICAL_PREFIXES[language][period[1]!]!} ${feast}${localizedSuffix}`;
    }
  }
  const pentecostSunday = /^Неделя (\d+)-я по Пятидесятнице$/u.exec(title);
  if (pentecostSunday) {
    const number = pentecostSunday[1];
    if (language === "cu") return `Недѣ́лѧ ${number}-ѧ по Пѧтдесѧ́тницѣ`;
    if (language === "de") return `${number}. Sonntag nach Pfingsten`;
    if (language === "uk") return `Неділя ${number}-га після П’ятидесятниці`;
    return `Niedziela ${number}. po Pięćdziesiątnicy`;
  }
  const greatLentSunday = /^Неделя (\d+)-я Великого поста(?:[.,] (.+))?$/u.exec(title);
  if (greatLentSunday) {
    const number = greatLentSunday[1];
    const suffix = greatLentSunday[2] ? `. ${localizeCalendarEventTitle(greatLentSunday[2], language)}` : "";
    if (language === "cu") return `Недѣ́лѧ ${number}-ѧ Вели́кагѡ поста̀${suffix}`;
    if (language === "de") return `${number}. Sonntag der Großen Fastenzeit${suffix}`;
    if (language === "uk") return `Неділя ${number}-га Великого посту${suffix}`;
    return `${number}. Niedziela Wielkiego Postu${suffix}`;
  }
  const paschaSunday = /^Неделя (\d+)-я по Пасхе(?:, (.+))?$/u.exec(title);
  if (paschaSunday) {
    const number = paschaSunday[1];
    const suffix = paschaSunday[2] ? `, ${localizeCalendarEventTitle(paschaSunday[2], language)}` : "";
    if (language === "cu") return `Недѣ́лѧ ${number}-ѧ по Па́сцѣ${suffix}`;
    if (language === "de") return `${number}. Sonntag nach Pascha${suffix}`;
    if (language === "uk") return `Неділя ${number}-га після Пасхи${suffix}`;
    return `${number}. Niedziela po Passze${suffix}`;
  }
  return undefined;
}

export function normalizeCalendarLanguage(value: unknown): CalendarLanguage {
  return value === "cu" || value === "de" || value === "uk" || value === "pl" ? value : "ru";
}

export function calendarMonthName(month: number, language: CalendarLanguage = "ru"): string {
  return MONTHS[normalizeCalendarLanguage(language)][month - 1] ?? MONTHS.ru[month - 1] ?? "Месяц";
}

export function calendarMonthHeading(month: number, year: number, language: CalendarLanguage = "ru"): string {
  return `${calendarMonthName(month, language)} ${year}`;
}

export function calendarWeekdayLabels(language: CalendarLanguage = "ru", short = false): readonly string[] {
  const labels = WEEKDAYS[normalizeCalendarLanguage(language)];
  return short ? labels.short : labels.full;
}

export function calendarFoodRuleLabel(rule: FoodRuleId, language: CalendarLanguage = "ru"): string {
  return FOOD_LABELS[normalizeCalendarLanguage(language)][rule];
}

export function calendarMonasteryEventLabel(language: CalendarLanguage = "ru"): string {
  return ({ ru: "событие монастыря", cu: "монасты́рское собы́тїе", de: "Klosterereignis", uk: "подія монастиря", pl: "wydarzenie monasteru" } as const)[normalizeCalendarLanguage(language)];
}

export function calendarOldStylePrefix(language: CalendarLanguage = "ru"): string {
  return ({ ru: "ст. ст.", cu: "по ста́ромꙋ ст.", de: "alter Stil", uk: "ст. ст.", pl: "stary styl" } as const)[normalizeCalendarLanguage(language)];
}

export function localizeCalendarEventTitle(title: string, language: CalendarLanguage = "ru"): string {
  const resolvedLanguage = normalizeCalendarLanguage(language);
  if (resolvedLanguage === "ru" || !title.trim()) return title;
  const exact = CORE_EVENTS[resolvedLanguage][title];
  if (exact) return exact;
  const structured = localizeStructuredLiturgicalTitle(title, resolvedLanguage);
  if (structured) return structured;
  let result = title;
  for (const [pattern, replacement] of TERM_REPLACEMENTS[resolvedLanguage]) result = result.replace(pattern, replacement);
  if (resolvedLanguage === "de" || resolvedLanguage === "pl") result = transliterateRemainingCyrillic(result, resolvedLanguage);
  return result;
}

export function localizeCalendarEvent(event: ResolvedCalendarEvent, language: CalendarLanguage = "ru"): ResolvedCalendarEvent {
  const resolvedLanguage = normalizeCalendarLanguage(language);
  if (resolvedLanguage === "ru") return event;
  return {
    ...event,
    title: localizeCalendarEventTitle(event.title, resolvedLanguage),
    ...(event.shortTitle ? { shortTitle: localizeCalendarEventTitle(event.shortTitle, resolvedLanguage) } : {}),
    ...(event.veryShortTitle ? { veryShortTitle: localizeCalendarEventTitle(event.veryShortTitle, resolvedLanguage) } : {}),
  };
}

export function localizedTextTitle(
  element: TextElement,
  page: PageModel,
  year: number,
  language: CalendarLanguage = "ru",
): string {
  if (element.semanticRole !== "calendar-month-title") return element.content.title;
  const month = page.elements.find((item) => item.type === "calendar-grid")?.month;
  const storedYear = /\b(19|20|21|22)\d{2}\b/u.exec(element.content.title)?.[0];
  return month ? calendarMonthHeading(month, storedYear ? Number(storedYear) : year, language) : element.content.title;
}
