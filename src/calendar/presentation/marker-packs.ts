import type { FoodRuleId } from "./fasting";

export type FoodMarkerPackId = "ornamental" | "dark";

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
    Object.entries(fileNames).map(([id, fileName]) => [id, `/assets/markers/${folder}/${fileName}`]),
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
