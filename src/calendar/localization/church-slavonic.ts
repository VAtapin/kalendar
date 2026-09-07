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
