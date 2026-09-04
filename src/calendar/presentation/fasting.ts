import type { OrthodoxCalendarDay } from "../types";
import {
  resolveFoodRuleForDay,
  type FoodRule,
  type FoodRuleId,
} from "../fasting/fasting-api";

export type { FoodRule, FoodRuleId } from "../fasting/fasting-api";
export {
  FOOD_RULES,
  calculateFastingDay,
  calculateFastingPeriods,
  fastingPeriodForDate,
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

const foodRuleCache = new WeakMap<OrthodoxCalendarDay, FoodRule>();

/** Keeps the one-marker print presentation while the API retains food + memorial separately. */
export function resolveFoodRule(day: OrthodoxCalendarDay): FoodRule {
  const cached = foodRuleCache.get(day);
  if (cached) return cached;
  const calculated = resolveFoodRuleForDay(day);
  foodRuleCache.set(day, calculated);
  return calculated;
}

/** Returns only the signs that are actually used by the requested month pages. */
export function usedFoodRulesForMonths(
  days: Iterable<OrthodoxCalendarDay>,
  months: ReadonlySet<number>,
): Set<FoodRuleId> {
  const rules = new Set<FoodRuleId>();
  for (const day of days) {
    if (months.has(day.date.month)) rules.add(resolveFoodRule(day).id);
  }
  return rules;
}
