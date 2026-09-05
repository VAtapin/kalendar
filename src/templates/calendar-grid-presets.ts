import type { CalendarGridElement, LargeTextEffects } from "../document/types";

export interface GlobalCalendarGridTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  builtIn: boolean;
  grid: CalendarGridElement;
}

const INITIAL_PRESET_DATE = "2026-09-05T00:00:00.000Z";

function goldTextEffects(): LargeTextEffects {
  return {
    gradient: {
      kind: "linear-gradient",
      direction: "vertical",
      startColor: "#fff1a8",
      centerColor: "#d4a62a",
      endColor: "#75460c",
    },
    shadow: {
      color: "#352006",
      offsetXMm: 0.35,
      offsetYMm: 0.45,
      blurMm: 0.35,
      opacity: 0.58,
    },
  };
}

function baseGrid(overrides: Partial<CalendarGridElement>): CalendarGridElement {
  return {
    id: "global-grid-template",
    type: "calendar-grid",
    layerId: "global-grid-template-layer",
    x: 10,
    y: 210,
    width: 277,
    height: 184.8,
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    overflow: "none",
    month: 1,
    columns: 7,
    weekRows: 6,
    showOverflowWarnings: true,
    showWeekdayHeader: true,
    weekdayLabelMode: "full",
    showOldStyleDate: false,
    maxVisibleEvents: 3,
    showFoodIcons: true,
    showFeastColors: true,
    showTypikonIcons: false,
    showFastingText: false,
    showMarriageRules: false,
    showScriptureReadings: false,
    commemorationDetail: "standard",
    commemorationFilter: {
      "pascha-and-twelve": true,
      great: true,
      medium: true,
      memorial: true,
    },
    minorCommemorationFallback: 2,
    dayNumberFontFamily: "Yeseva One",
    eventFontFamily: "Cormorant Garamond",
    dayNumberFontSizePt: 30,
    dayNumberXOffsetMm: 1.5,
    dayNumberYOffsetMm: 1.5,
    oldStyleFontFamily: "Cormorant Garamond",
    oldStyleFontSizePt: 4.4,
    oldStyleXOffsetMm: 1.5,
    oldStyleYOffsetMm: 13.15,
    foodMarkerSizeMm: 9.5,
    foodMarkerXOffsetMm: 1.5,
    foodMarkerYOffsetMm: 14.08,
    eventFontSizePt: 10,
    eventTextXOffsetMm: 15.7,
    eventTextYOffsetMm: 1.5,
    eventTextRightInsetMm: 1.5,
    eventTextBottomInsetMm: 1.5,
    typikonMarkerSizeMm: 4.6,
    typikonMarkerXOffsetMm: 1.5,
    typikonMarkerYOffsetMm: 24.38,
    autoFitText: true,
    minimumEventFontSizePt: 9,
    eventLineSpacingPt: 0.8,
    eventGapPt: 1,
    cellPaddingMm: 1.5,
    gridStyle: "editorial",
    weekdayFontFamily: "Ruslan Display",
    weekdayFontSizePt: 18,
    ...overrides,
  };
}

export const DEFAULT_GLOBAL_CALENDAR_GRID_TEMPLATES: readonly GlobalCalendarGridTemplate[] = [
  {
    id: "editorial-classic",
    name: "Издательская классика",
    description: "Полные названия дней, крупные даты и лёгкие пунктирные разделители.",
    createdAt: INITIAL_PRESET_DATE,
    updatedAt: INITIAL_PRESET_DATE,
    builtIn: true,
    grid: baseGrid({
      gridStyle: "editorial",
      weekdayLabelMode: "full",
      weekdayFontFamily: "Ruslan Display",
      dayNumberFontFamily: "Yeseva One",
      eventFontFamily: "Cormorant Garamond",
      maxVisibleEvents: 3,
    }),
  },
  {
    id: "monastic-book",
    name: "Монастырская книга",
    description: "Строгая рамочная сетка, церковный шрифт и дата по старому стилю.",
    createdAt: INITIAL_PRESET_DATE,
    updatedAt: INITIAL_PRESET_DATE,
    builtIn: true,
    grid: baseGrid({
      gridStyle: "boxed",
      weekdayLabelMode: "full",
      weekdayFontFamily: "Monomakh Unicode",
      weekdayFontSizePt: 16,
      dayNumberFontFamily: "Monomakh Unicode",
      dayNumberFontSizePt: 27,
      eventFontFamily: "Cormorant Garamond",
      eventFontSizePt: 9.6,
      minimumEventFontSizePt: 8.4,
      showOldStyleDate: true,
      oldStyleFontFamily: "Monomakh Unicode",
      showTypikonIcons: true,
      maxVisibleEvents: 4,
    }),
  },
  {
    id: "clean-modern",
    name: "Современная светлая",
    description: "Короткие дни недели, свободная сетка и нейтральный шрифт без засечек.",
    createdAt: INITIAL_PRESET_DATE,
    updatedAt: INITIAL_PRESET_DATE,
    builtIn: true,
    grid: baseGrid({
      gridStyle: "minimal",
      weekdayLabelMode: "short",
      weekdayFontFamily: "AGLettericaExtraCompressed",
      weekdayFontSizePt: 17,
      dayNumberFontFamily: "Favorit",
      dayNumberFontSizePt: 27,
      eventFontFamily: "Arial",
      eventFontSizePt: 9.2,
      minimumEventFontSizePt: 8.2,
      cellPaddingMm: 1.15,
      maxVisibleEvents: 4,
      showFeastColors: true,
    }),
  },
  {
    id: "festal-gold",
    name: "Торжественная золотая",
    description: "Золотые заголовки и числа с тенью для праздничного оформления.",
    createdAt: INITIAL_PRESET_DATE,
    updatedAt: INITIAL_PRESET_DATE,
    builtIn: true,
    grid: baseGrid({
      gridStyle: "editorial",
      weekdayLabelMode: "full",
      weekdayFontFamily: "IzhitsaShadowCTT",
      weekdayFontSizePt: 17,
      weekdayTextEffects: goldTextEffects(),
      dayNumberFontFamily: "IzhitsaShadowCTT",
      dayNumberFontSizePt: 31,
      dayNumberTextEffects: goldTextEffects(),
      eventFontFamily: "Georgia",
      eventFontSizePt: 9.5,
      minimumEventFontSizePt: 8.4,
      showTypikonIcons: true,
      maxVisibleEvents: 3,
    }),
  },
  {
    id: "compact-information",
    name: "Компактная подробная",
    description: "Больше памятей в ячейке, сокращённые дни и плотная книжная верстка.",
    createdAt: INITIAL_PRESET_DATE,
    updatedAt: INITIAL_PRESET_DATE,
    builtIn: true,
    grid: baseGrid({
      gridStyle: "boxed",
      weekdayLabelMode: "short",
      weekdayFontFamily: "Condens",
      weekdayFontSizePt: 16,
      dayNumberFontFamily: "Brevis",
      dayNumberFontSizePt: 25,
      eventFontFamily: "Verdana",
      eventFontSizePt: 8.6,
      minimumEventFontSizePt: 7.2,
      eventLineSpacingPt: 0.35,
      eventGapPt: 0.55,
      cellPaddingMm: 0.85,
      showOldStyleDate: true,
      maxVisibleEvents: 5,
      commemorationDetail: "full",
      minorCommemorationFallback: 3,
    }),
  },
] as const;

export function defaultGlobalCalendarGridTemplates(): GlobalCalendarGridTemplate[] {
  return JSON.parse(JSON.stringify(DEFAULT_GLOBAL_CALENDAR_GRID_TEMPLATES)) as GlobalCalendarGridTemplate[];
}
