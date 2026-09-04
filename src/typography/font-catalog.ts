export interface FontOption {
  family: string;
  label: string;
  description: string;
  kind: "decorative" | "text" | "system";
  scriptSupport?: "full-cyrillic" | "partial-cyrillic" | "latin";
}

export interface BundledFontFiles {
  regular: string;
  bold?: string;
  italic?: string;
  boldItalic?: string;
}

const bundledFontFiles = {
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
  "Italiano Decor": { regular: "ItalianoDecor.ttf" },
  Condens: { regular: "Condens.ttf" },
  Favorit: { regular: "Favorit.ttf" },
  AGLettericaExtraCompressed: { regular: "AGLettericaExtraCompressed.ttf" },
  "ST-Surzhik": { regular: "ST-Surzhik.otf" },
  "ST-Cyberillic": { regular: "ST-Cyberillic.otf" },
  "ST-Postoronnim": { regular: "ST-Postoronnim.otf" },
  "Monomakh Unicode": { regular: "MonomakhUnicode.ttf" },
  IzhitsaShadowCTT: { regular: "IzhitsaShadowCTT.ttf" },
  OldCyr: { regular: "OldCyr.ttf" },
  "Wooden Ship Decorated": { regular: "WoodenShipDecorated.ttf" },
  "DS Yermak_D": { regular: "DSYermakD.ttf" },
  Rurintania: { regular: "Rurintania.ttf" },
  a_BosaNova: { regular: "ABosaNova.ttf" },
  Wonderland: { regular: "Wonderland.ttf" },
  "Wonderland Stars": { regular: "WonderlandStars.ttf" },
  "Pret-a-Porter Deco": { regular: "PretAPorterDeco.ttf" },
  Brevis: { regular: "Brevis.ttf" },
  Avalon: { regular: "Avalon.ttf" },
  "Fortuna Gothic FlorishC": { regular: "FortunaGothicFlorishC.ttf" },
  "Country Western": { regular: "CountryWestern.ttf" },
  Neoneon: { regular: "Neoneon.ttf" },
  Lighthaus: { regular: "Lighthaus.ttf" },
  "Country Western Swing": { regular: "CountryWesternSwing.ttf" },
  "Aero Matics Stencil": { regular: "AeroMaticsStencil.ttf" },
  Dublon: { regular: "Dublon.ttf" },
  Spectrashell: { regular: "Spectrashell.ttf" },
  Daray: { regular: "Daray.ttf" },
  Okuda: { regular: "Okuda.ttf" },
  TauernInlineCTT: { regular: "TauernInlineCTT.ttf" },
  "Gazeta Sans Serif": { regular: "GazetaSansSerif.ttf" },
  Afisha: { regular: "Afisha.ttf" },
  Balalaika: { regular: "Balalaika.otf" },
  "Lavka 2021": { regular: "Lavka2021.otf" },
  "TD Elena2021": { regular: "TDElena2021.otf" },
};

export type BundledFontFamily = keyof typeof bundledFontFiles;

export const BUNDLED_FONT_FILES: Readonly<Record<BundledFontFamily, BundledFontFiles>> = bundledFontFiles;

const additionalDecorativeFonts = [
  ["Italiano Decor", "Italiano Decor — орнаментальный", "Пышные декоративные заголовки", "full-cyrillic"],
  ["Condens", "Condens — сжатый жирный", "Компактные заголовки; нет буквы Ё", "partial-cyrillic"],
  ["Favorit", "Favorit — декоративный", "Пластичные праздничные надписи", "full-cyrillic"],
  ["AGLettericaExtraCompressed", "AG Letterica — сверхсжатый", "Узкие наклонные заголовки", "full-cyrillic"],
  ["ST-Surzhik", "ST-Surzhik — рукописный", "Характерные декоративные подписи", "full-cyrillic"],
  ["ST-Cyberillic", "ST-Cyberillic — неполная кириллица", "Для коротких надписей после проверки букв", "partial-cyrillic"],
  ["ST-Postoronnim", "ST-Postoronnim — неполная кириллица", "Для коротких надписей после проверки букв", "partial-cyrillic"],
  ["Monomakh Unicode", "Monomakh Unicode — древнерусский", "Церковные и исторические заголовки", "full-cyrillic"],
  ["IzhitsaShadowCTT", "Ижица с тенью", "Объёмные старославянские заголовки", "full-cyrillic"],
  ["OldCyr", "OldCyr — старославянский", "Строгие кириллические заголовки", "full-cyrillic"],
  ["Wooden Ship Decorated", "Wooden Ship — украшенный", "Орнаментальные крупные надписи", "full-cyrillic"],
  ["DS Yermak_D", "DS Yermak — декоративный", "Русский характер; неполный набор букв", "partial-cyrillic"],
  ["Rurintania", "Rurintania — витой", "Торжественные декоративные заголовки", "full-cyrillic"],
  ["a_BosaNova", "BosaNova — художественный", "Мягкие необычные заголовки", "full-cyrillic"],
  ["Wonderland", "Wonderland — сказочный", "Декоративные названия и подписи", "full-cyrillic"],
  ["Wonderland Stars", "Wonderland Stars — со звёздами", "Праздничные украшенные надписи", "full-cyrillic"],
  ["Pret-a-Porter Deco", "Pret-a-Porter Deco", "Геометрический декоративный шрифт", "full-cyrillic"],
  ["Brevis", "Brevis — книжный декоративный", "Лаконичные заголовки с характером", "full-cyrillic"],
  ["Avalon", "Avalon — декоративный", "Классические заголовки; нет буквы Ё", "partial-cyrillic"],
  ["Fortuna Gothic FlorishC", "Fortuna Gothic — с росчерками", "Готические украшенные надписи", "full-cyrillic"],
  ["Country Western", "Country Western", "Рельефные плакатные заголовки", "full-cyrillic"],
  ["Neoneon", "Neoneon — контурный", "Светящиеся и контурные надписи", "full-cyrillic"],
  ["Lighthaus", "Lighthaus — геометрический", "Высокие архитектурные заголовки", "full-cyrillic"],
  ["Country Western Swing", "Country Western Swing", "Пластичный плакатный шрифт", "full-cyrillic"],
  ["Aero Matics Stencil", "Aero Matics — трафаретный", "Строгие трафаретные надписи", "full-cyrillic"],
  ["Dublon", "Dublon — объёмный", "Выразительные плотные заголовки", "full-cyrillic"],
  ["Spectrashell", "Spectrashell — техничный", "Современные декоративные надписи", "full-cyrillic"],
  ["Daray", "Daray — рукописный", "Живые художественные подписи", "full-cyrillic"],
  ["Okuda", "Okuda — округлый", "Мягкие дружелюбные заголовки", "full-cyrillic"],
  ["TauernInlineCTT", "Tauern Inline — линейный", "Двойной контур для крупных слов", "full-cyrillic"],
  ["Gazeta Sans Serif", "Gazeta Sans Serif", "Газетные заголовки; нет буквы Ё", "partial-cyrillic"],
  ["Afisha", "Afisha — плакатный", "Крупные афишные заголовки", "full-cyrillic"],
  ["Balalaika", "Balalaika — только латиница", "Декоративные латинские надписи", "latin"],
  ["Lavka 2021", "Lavka 2021 — вывесочный", "Русские декоративные заголовки", "full-cyrillic"],
  ["TD Elena2021", "TD Elena — рукописный", "Изящные праздничные подписи", "full-cyrillic"],
] as const;

const ADDITIONAL_DECORATIVE_FONT_OPTIONS: readonly FontOption[] = additionalDecorativeFonts.map(
  ([family, label, description, scriptSupport]) => ({
    family,
    label,
    description,
    kind: "decorative",
    scriptSupport,
  }),
);

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
  ...ADDITIONAL_DECORATIVE_FONT_OPTIONS,
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
