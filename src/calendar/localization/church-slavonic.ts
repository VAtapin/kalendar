import type { FoodRuleId } from "../fasting/fasting-api";

/** Small factual vocabulary checked against Ponomar on 2026-09-08.
 * This is not a complete translation of MemoryDays.xml or an imported corpus.
 * Ponomar's code/data repository is GPL-3.0; no source code is copied here.
 */
export const CHURCH_SLAVONIC_VOCABULARY_SOURCE =
  "https://github.com/typiconman/ponomar/blob/0af645f438856f45c22026912d2e4a9ce495e531/Ponomar/languages/cu/xml/Commands/LanguagePacks.xml";

/** Ponomar's Week1, reordered from Sunday-first to Monday-first. */
export const CHURCH_SLAVONIC_SHORT_WEEKDAYS = [
  "пнⷣе", "втоⷬ҇", "срⷣе", "чеⷦ҇", "пѧⷦ҇", "сꙋⷠ҇", "ндⷧ҇ѧ",
] as const;

/** Only source-attested corrections; other existing legends remain editorial. */
export const CHURCH_SLAVONIC_FOOD_CORRECTIONS: Partial<Record<FoodRuleId, string>> = {
  fish: "разрѣша́етсѧ на рыбꙋ̀",
  "boiled-no-oil": "Варе́нїе бе́з̾ є҆ле́ѧ",
  "dry-eating": "Сꙋхоѧде́нїе",
};

export const CHURCH_SLAVONIC_GEORGE_SOURCE =
  "https://github.com/typiconman/ponomar/blob/0af645f438856f45c22026912d2e4a9ce495e531/Ponomar/languages/cu/xml/lives/09497.xml";

/** Exact source identity only: no guessed inflections or substitutions in names.
 * The year is preserved from our Russian record, not independently re-dated.
 */
export function verifiedChurchSlavonicTitle(title: string): string | undefined {
  if (title === "Вмч. Георгия Победоносца (303)") {
    return "Ст҃а́гѡ сла́внагѡ великомч҃ника, побѣдоно́сца и҆ чꙋдотво́рца геѡ́ргїа (303)";
  }
  return undefined;
}

/** Editorial translations of the finite generated-cycle vocabulary (not saint-name
 * transliteration). Forms cross-referenced with Typikon ch. 49, the 1896 Sluzhebnik,
 * and Ponomar lives 9008, 9015, 9022, 9029, 9036, 9043, 9051, 9057, 9064,
 * 9801–9803, 9849, 9856. Explanatory clauses retained from our generated titles.
 * These references are not a claim of external philological certification.
 */
export const CHURCH_SLAVONIC_CYCLE_TITLES: Readonly<Record<string, string>> = {
  "Великий Четверток. Воспоминание Тайной Вечери": "Вели́кїй четверто́къ. Воспомина́нїе та́йныѧ ве́чери",
  "Великий Четверток. Тайная Вечеря": "Вели́кїй четверто́къ. Та́йнаѧ ве́черѧ",
  "Великий Пяток. Воспоминание Святых спасительных Страстей Господа Иисуса Христа": "Вели́кїй пѧто́къ. Воспомина́нїе ст҃ы́хъ спаси́тельныхъ страсте́й гдⷭ҇а і҆и҃са хрⷭ҇та̀",
  "Великий Пяток. Распятие Христа": "Вели́кїй пѧто́къ. Распѧ́тїе хрⷭ҇та̀",
  "Великая Суббота. Сошествие Христа во ад": "Вели́каѧ сꙋббѡ́та. Соше́ствїе хрⷭ҇та̀ во а҆́дъ",
  "Неделя о Страшном Суде (мясопустная)": "Недѣ́лѧ ѡ҆ стра́шнѣмъ сꙋдѣ́ (мѧсопꙋ́стнаѧ)",
  "Неделя о Страшном Суде": "Недѣ́лѧ ѡ҆ стра́шнѣмъ сꙋдѣ́",
  "О Страшном Суде": "Ѡ҆ стра́шнѣмъ сꙋдѣ́",
  "Неделя сыропустная. Воспоминание Адамова изгнания. Прощеное воскресенье": "Недѣ́лѧ сыропꙋ́стнаѧ. Воспомина́нїе а҆да́мова и҆згна́нїѧ. Прощено́е воскрⷭ҇нїе",
  "Неделя сыропустная. Прощеное воскресенье": "Недѣ́лѧ сыропꙋ́стнаѧ. Прощено́е воскрⷭ҇нїе",
  "2-я Неделя Великого поста": "Недѣ́лѧ 2-ѧ вели́кагѡ поста̀",
  "Неделя Крестопоклонная": "Недѣ́лѧ крестопокло́ннаѧ",
  "4-я Неделя Великого поста": "Недѣ́лѧ 4-ѧ вели́кагѡ поста̀",
  "5-я Неделя Великого поста": "Недѣ́лѧ 5-ѧ вели́кагѡ поста̀",
  "Антипасха. Неделя апостола Фомы": "А҆нтипа́сха. Недѣ́лѧ а҆пⷭ҇ла ѳѡмы̀",
  "Антипасха": "А҆нтипа́сха",
  "Неделя святых жен-мироносиц": "Недѣ́лѧ ст҃ы́хъ же́нъ-мѵроно́сицъ",
  "Неделя жен-мироносиц": "Недѣ́лѧ же́нъ-мѵроно́сицъ",
  "Неделя о расслабленном": "Недѣ́лѧ разсла́бленнагѡ",
  "Неделя о самаряныне": "Недѣ́лѧ самарѧны́ни",
  "Неделя о слепом": "Недѣ́лѧ ѡ҆ слѣпо́мъ",
  "Отдание Пасхи": "Ѿда́нїе па́схи",
  "Неделя 7-я по Пасхе, святых отцов I Вселенского Собора": "Недѣ́лѧ 7-ѧ по па́сцѣ, ст҃ы́хъ ѻ҆тє́цъ пе́рвагѡ вселе́нскагѡ собо́ра",
  "Неделя святых отцов I Вселенского Собора": "Недѣ́лѧ ст҃ы́хъ ѻ҆тє́цъ пе́рвагѡ вселе́нскагѡ собо́ра",
  "Неделя святых отцов": "Недѣ́лѧ ст҃ы́хъ ѻ҆тє́цъ",
  "Понедельник Пятидесятницы. День Святого Духа": "Понедѣ́льникъ пѧтидесѧ́тницѣ. Де́нь ст҃а́гѡ дх҃а",
  "Неделя 1-я по Пятидесятнице, Всех святых": "Недѣ́лѧ 1-ѧ по пѧтидесѧ́тницѣ, всѣ́хъ ст҃ы́хъ",
  "Неделя Всех святых": "Недѣ́лѧ всѣ́хъ ст҃ы́хъ",
  "Неделя 2-я по Пятидесятнице, Всех святых, в земле Русской просиявших": "Недѣ́лѧ 2-ѧ по пѧтидесѧ́тницѣ, всѣ́хъ ст҃ы́хъ, въ землѝ рѡссі́йстѣй просїѧ́вшихъ",
  "Неделя Всех святых, в земле Русской просиявших": "Недѣ́лѧ всѣ́хъ ст҃ы́хъ, въ землѝ рѡссі́йстѣй просїѧ́вшихъ",
  "Неделя Всех русских святых": "Недѣ́лѧ всѣ́хъ ст҃ы́хъ землѝ рѡссі́йскїѧ",
};
