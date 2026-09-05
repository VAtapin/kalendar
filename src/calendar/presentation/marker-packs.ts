import type { FoodRuleId } from "./fasting";

export const FOOD_MARKER_PACK_IDS = [
  "ornamental",
  "dark",
  "bronze-medallions",
  "jeweled-medallions",
  "photographic-vignettes",
  "gold-oval-medallions",
  "minimal-dark",
  "vintage-watercolor",
  "light-watercolor",
  "sticker-outline",
  "soft-illustration",
  "clean-illustration",
  "blue-photo",
  "rustic-photo",
  "copper-photo",
  "gold-photo",
] as const;

export type FoodMarkerPackId = typeof FOOD_MARKER_PACK_IDS[number];

const foodMarkerPackIds = new Set<string>(FOOD_MARKER_PACK_IDS);

export function isFoodMarkerPackId(value: unknown): value is FoodMarkerPackId {
  return typeof value === "string" && foodMarkerPackIds.has(value);
}

export interface FoodMarkerPack {
  id: FoodMarkerPackId;
  label: string;
  description: string;
  sources: Record<FoodRuleId, string>;
}

const fileNames: Record<FoodRuleId, string> = {
  "no-fast": "no-fast.png",
  fast: "fast-no-fish.png",
  fish: "fish.png",
  oil: "boiled-with-oil.png",
  "boiled-no-oil": "boiled-no-oil.png",
  "dry-eating": "dry-eating.png",
  "strict-fast": "strict-fast.png",
  "dairy-eggs": "dairy-eggs.png",
  memorial: "memorial.png",
};

function packSources(folder: string): Record<FoodRuleId, string> {
  return Object.fromEntries(
    Object.entries(fileNames).map(([id, fileName]) => [
      id,
      id === "no-fast" && folder !== "ornamental" && folder !== "dark"
        ? "/assets/markers/ornamental/no-fast.png"
        : `/assets/markers/${folder}/${fileName}`,
    ]),
  ) as Record<FoodRuleId, string>;
}

export const FOOD_MARKER_PACKS: ReadonlyArray<FoodMarkerPack> = [
  {
    id: "ornamental",
    label: "Орнаментальные с надписью",
    description: "Круглые светлые знаки с подписью категории.",
    sources: packSources("ornamental"),
  },
  {
    id: "dark",
    label: "Фотографические тёмные",
    description: "Фотографические композиции без встроенной подписи.",
    sources: packSources("dark"),
  },
  {
    id: "bronze-medallions",
    label: "Бронзовые медальоны",
    description: "Тёплые овальные знаки с бронзовой церковной рамкой.",
    sources: packSources("bronze-medallions"),
  },
  {
    id: "jeweled-medallions",
    label: "Самоцветные медальоны",
    description: "Насыщенные сине-красно-зелёные медальоны с золотой рамкой.",
    sources: packSources("jeweled-medallions"),
  },
  {
    id: "photographic-vignettes",
    label: "Фотографические виньетки",
    description: "Крупные реалистичные композиции на прозрачном фоне.",
    sources: packSources("photographic-vignettes"),
  },
  {
    id: "gold-oval-medallions",
    label: "Золотые овальные медальоны",
    description: "Компактные знаки в светлой овальной золотой рамке.",
    sources: packSources("gold-oval-medallions"),
  },
  {
    id: "minimal-dark",
    label: "Минималистичные пиктограммы",
    description: "Простые тёмные пиктограммы для очень мелкого кегля.",
    sources: packSources("minimal-dark"),
  },
  {
    id: "vintage-watercolor",
    label: "Винтажная акварель",
    description: "Тонкие акварельные знаки в старопечатной манере.",
    sources: packSources("vintage-watercolor"),
  },
  {
    id: "light-watercolor",
    label: "Светлая акварель",
    description: "Лёгкие цветные акварельные иллюстрации.",
    sources: packSources("light-watercolor"),
  },
  {
    id: "sticker-outline",
    label: "Контурные наклейки",
    description: "Яркие знаки с толстой контрастной обводкой.",
    sources: packSources("sticker-outline"),
  },
  {
    id: "soft-illustration",
    label: "Мягкая иллюстрация",
    description: "Спокойные рисованные знаки с мягкими тенями.",
    sources: packSources("soft-illustration"),
  },
  {
    id: "clean-illustration",
    label: "Чистая иллюстрация",
    description: "Чистые компактные изображения без лишнего декора.",
    sources: packSources("clean-illustration"),
  },
  {
    id: "blue-photo",
    label: "Фотореалистика — синяя",
    description: "Контрастная реалистичная серия с холодными рыбными тонами.",
    sources: packSources("blue-photo"),
  },
  {
    id: "rustic-photo",
    label: "Фотореалистика — деревенская",
    description: "Тёплая серия с глиняной посудой и натуральными продуктами.",
    sources: packSources("rustic-photo"),
  },
  {
    id: "copper-photo",
    label: "Фотореалистика — медная",
    description: "Насыщенная серия с медно-красными акцентами.",
    sources: packSources("copper-photo"),
  },
  {
    id: "gold-photo",
    label: "Фотореалистика — золотая",
    description: "Светлая тёплая серия с золотистыми акцентами.",
    sources: packSources("gold-photo"),
  },
] as const;

export const DEFAULT_FOOD_MARKER_PACK_ID: FoodMarkerPackId = "ornamental";

export function getFoodMarkerPack(id: FoodMarkerPackId | undefined): FoodMarkerPack {
  return FOOD_MARKER_PACKS.find((pack) => pack.id === id) ?? FOOD_MARKER_PACKS[0]!;
}

export function foodMarkerPackSource(
  packId: FoodMarkerPackId | undefined,
  rule: FoodRuleId,
): string {
  return getFoodMarkerPack(packId).sources[rule];
}

/** Lightweight UI thumbnail; the full 300 dpi source remains reserved for print. */
export function foodMarkerPackPreviewSource(
  packId: FoodMarkerPackId | undefined,
  rule: FoodRuleId,
): string {
  return foodMarkerPackSource(packId, rule).replace("/assets/markers/", "/assets/marker-previews/");
}
