export type DecorCategory =
  | "frames"
  | "corners"
  | "dividers"
  | "ornaments"
  | "religious"
  | "symbols";

export interface DecorLibraryItem {
  id: string;
  sourceId: string;
  label: string;
  category: DecorCategory;
  source: string;
  aspectRatio: number;
}

export const DECOR_CATEGORY_LABELS: Readonly<Record<DecorCategory, string>> = {
  frames: "Рамки",
  corners: "Углы и бордюры",
  dividers: "Разделители",
  ornaments: "Орнаменты",
  religious: "Церковные изображения",
  symbols: "Символы",
};

export { DECOR_LIBRARY_ITEMS } from "./decor-library.generated";
