export type BundledFontFamily =
  | "Ruslan Display"
  | "Yeseva One"
  | "Cormorant Garamond"
  | "Marck Script";

export interface FontOption {
  family: string;
  label: string;
  description: string;
  kind: "decorative" | "text" | "system";
}

export interface BundledFontFiles {
  regular: string;
  bold?: string;
  italic?: string;
  boldItalic?: string;
}

export const BUNDLED_FONT_FILES: Readonly<Record<BundledFontFamily, BundledFontFiles>> = {
  "Ruslan Display": {
    regular: "RuslanDisplay-Regular.ttf",
  },
  "Yeseva One": {
    regular: "YesevaOne-Regular.ttf",
  },
  "Cormorant Garamond": {
    regular: "CormorantGaramond-Regular.ttf",
    bold: "CormorantGaramond-Bold.ttf",
    italic: "CormorantGaramond-Italic.ttf",
    boldItalic: "CormorantGaramond-BoldItalic.ttf",
  },
  "Marck Script": {
    regular: "MarckScript-Regular.ttf",
  },
};

export const FONT_OPTIONS: readonly FontOption[] = [
  {
    family: "Ruslan Display",
    label: "Руслан — древнерусский",
    description: "Выразительные заголовки дней недели",
    kind: "decorative",
  },
  {
    family: "Yeseva One",
    label: "Yeseva One — торжественный",
    description: "Название месяца, крупные числа и праздники",
    kind: "decorative",
  },
  {
    family: "Marck Script",
    label: "Marck Script — рукописный",
    description: "Короткие цитаты и декоративные подписи",
    kind: "decorative",
  },
  {
    family: "Cormorant Garamond",
    label: "Cormorant Garamond — книжный",
    description: "Читаемый церковно-книжный текст",
    kind: "text",
  },
  {
    family: "Georgia",
    label: "Georgia",
    description: "Системный шрифт с засечками",
    kind: "system",
  },
  {
    family: "Arial",
    label: "Arial",
    description: "Системный шрифт без засечек",
    kind: "system",
  },
  {
    family: "Times New Roman",
    label: "Times New Roman",
    description: "Классический системный шрифт",
    kind: "system",
  },
  {
    family: "Verdana",
    label: "Verdana",
    description: "Широкий системный шрифт",
    kind: "system",
  },
] as const;

export const DISPLAY_FONT_OPTIONS = FONT_OPTIONS.filter(
  (option) => option.kind !== "text" || option.family === "Cormorant Garamond",
);

export function bundledFontFamily(value: string): BundledFontFamily | undefined {
  return Object.prototype.hasOwnProperty.call(BUNDLED_FONT_FILES, value)
    ? value as BundledFontFamily
    : undefined;
}
