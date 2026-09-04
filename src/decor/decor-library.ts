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
  /** SVG is recolourable; image is a print-ready raster with preserved metallic rendering. */
  kind?: "svg" | "image";
  widthPx?: number;
  heightPx?: number;
  nominalDpi?: number;
}

export const DECOR_CATEGORY_LABELS: Readonly<Record<DecorCategory, string>> = {
  frames: "Рамки",
  corners: "Углы и бордюры",
  dividers: "Разделители",
  ornaments: "Орнаменты",
  religious: "Церковные изображения",
  symbols: "Символы",
};

import { DECOR_LIBRARY_ITEMS as SVG_DECOR_LIBRARY_ITEMS } from "./decor-library.generated";
import { GOLD_PRINT_LIBRARY_ITEMS } from "./gold-print-library";

export const DECOR_LIBRARY_ITEMS: readonly DecorLibraryItem[] = [
  ...GOLD_PRINT_LIBRARY_ITEMS,
  ...SVG_DECOR_LIBRARY_ITEMS,
];
