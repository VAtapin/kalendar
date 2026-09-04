import type { OrthodoxCalendarDay } from "../types";
import {
  resolveFoodRuleForDay,
  type FoodRule,
  type FoodRuleId,
  type FastingProfileId,
} from "../fasting/fasting-api";

export type { FoodRule, FoodRuleId } from "../fasting/fasting-api";
export {
  FOOD_RULES,
  calculateFastingDay,
  calculateFastingPeriods,
  fastingPeriodForDate,
  FASTING_PROFILES,
} from "../fasting/fasting-api";

const FOOD_RULE_LEGEND_LABELS: Record<FoodRuleId, string> = {
  "no-fast": "",
  fast: "постный день",
  fish: "разрешается рыба",
  oil: "пища с маслом",
  "boiled-no-oil": "пища без масла",
  "dry-eating": "сухоядение",
  "strict-fast": "строгий пост",
  "dairy-eggs": "молочное и яйца",
  memorial: "поминовение усопших",
};

export function foodRuleLegendLabel(rule: FoodRuleId): string {
  return FOOD_RULE_LEGEND_LABELS[rule];
}

const foodRuleCache = new WeakMap<OrthodoxCalendarDay, Map<FastingProfileId, FoodRule>>();

/** Keeps the one-marker print presentation while the API retains food + memorial separately. */
export function resolveFoodRule(
  day: OrthodoxCalendarDay,
  profileId: FastingProfileId = "typikon-strict",
): FoodRule {
  let byProfile = foodRuleCache.get(day);
  const cached = byProfile?.get(profileId);
  if (cached) return cached;
  const calculated = resolveFoodRuleForDay(day, profileId);
  byProfile ??= new Map();
  byProfile.set(profileId, calculated);
  foodRuleCache.set(day, byProfile);
  return calculated;
}

/** Returns only the signs that are actually used by the requested month pages. */
export function usedFoodRulesForMonths(
  days: Iterable<OrthodoxCalendarDay>,
  months: ReadonlySet<number>,
  profileId: FastingProfileId = "typikon-strict",
): Set<FoodRuleId> {
  const rules = new Set<FoodRuleId>();
  for (const day of days) {
    if (months.has(day.date.month)) rules.add(resolveFoodRule(day, profileId).id);
  }
  return rules;
}
