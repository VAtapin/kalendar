import type { CalendarDate, ResolvedCalendarEvent } from '../types';

export type FoodRuleId =
  | "no-fast"
  | "fast"
  | "fish"
  | "oil"
  | "boiled-no-oil"
  | "dry-eating"
  | "strict-fast"
  | "caviar"
  | "total-abstinence"
  | "dairy-eggs"
  | "memorial";

export interface FoodRule {
  id: FoodRuleId;
  label: string;
  color: string;
}

export const FOOD_RULES: Readonly<Record<FoodRuleId, FoodRule>> = {
  "no-fast": { id: "no-fast", label: "поста нет", color: "#7b4433" },
  fast: { id: "fast", label: "постный день без рыбы", color: "#527b43" },
  fish: { id: "fish", label: "разрешается рыба", color: "#3a6f85" },
  oil: { id: "oil", label: "варёная пища с маслом (елеем)", color: "#a36b22" },
  "boiled-no-oil": { id: "boiled-no-oil", label: "варёная пища без масла (елея)", color: "#92724f" },
  "dry-eating": { id: "dry-eating", label: "сухоядение", color: "#6c613a" },
  "strict-fast": { id: "strict-fast", label: "строгий пост", color: "#40584a" },
  caviar: { id: "caviar", label: "разрешается рыбная икра, но не рыба", color: "#955328" },
  "total-abstinence": { id: "total-abstinence", label: "полное воздержание от пищи", color: "#4e495c" },
  "dairy-eggs": { id: "dairy-eggs", label: "разрешаются молочные продукты и яйца", color: "#b18642" },
  memorial: { id: "memorial", label: "день особого поминовения усопших", color: "#66524c" },
};

export type FastingPeriodId =
  | "great-lent"
  | "apostles-fast"
  | "dormition-fast"
  | "nativity-fast";

export interface FastingPeriod {
  id: FastingPeriodId;
  label: string;
  start: CalendarDate;
  finish: CalendarDate;
}

export interface FastingDayInput {
  date: CalendarDate;
  weekday?: number;
  events?: readonly Pick<ResolvedCalendarEvent, "title" | "typeCode">[];
}

export type FastingProfileId = "typikon-strict" | "parish";

export interface FastingProfile {
  id: FastingProfileId;
  label: string;
  description: string;
  rulesVersion: string;
  sourceUrls: readonly string[];
}

export interface FastingDayResolution {
  date: CalendarDate;
  profileId: FastingProfileId;
  period?: FastingPeriodId;
  foodRule: FoodRule;
  memorial: boolean;
  reason: string;
  sourceUrls: readonly string[];
}

/**
 * Profiles describe source-based editorial conventions, not a universal
 * personal fasting obligation or the custom of the site's founding monastery.
 * The project selects its profile; no site-wide monastery setting overrides it.
 */
export const FASTING_PROFILE_ID = "typikon-strict" as const;
export const FASTING_RULE_SOURCE_URLS = [
  "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/32",
  "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/33",
  "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/48",
  "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/49",
  "https://otrada-i-uteshenie.ru/kalendar/",
  "https://azbyka.ru/days/p-kalendar-postov-i-trapez",
  "https://azbyka.ru/otechnik/Spravochniki/spravochnik-pravoslavnogo-cheloveka-chast-4-pravoslavnye-posty-i-prazdniki/1",
  "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/49_19",
  "https://patriarchia.ru/bu/2024-05-04",
  "https://predanie.ru/book/101747-tipikon/?chapter=chapter_33",
  "https://www.diak.ortox.ru/bogosluzhebnye_ukazanija/view/id/1216876",
] as const;

export const FASTING_PROFILES: Readonly<Record<FastingProfileId, FastingProfile>> = {
  "typikon-strict": {
    id: "typikon-strict",
    label: "Строгий устав",
    description: "Строгая уставная мера с сухоядением и днями полного воздержания. Не личное предписание всем пользователям.",
    rulesVersion: "2026.09.08.3",
    sourceUrls: FASTING_RULE_SOURCE_URLS,
  },
  parish: {
    id: "parish",
    label: "Приходская практика",
    description: "Приходской вариант таблицы постов. Не заменяет правила вашей общины и личную меру поста.",
    rulesVersion: "2026.09.08.3",
    sourceUrls: FASTING_RULE_SOURCE_URLS,
  },
} as const;
