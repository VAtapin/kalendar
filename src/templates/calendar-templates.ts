import { createBlankPage } from "../document/factories";
import { attachElementToLayer, createEmptyLayer } from "../document/layer-operations";
import type {
  LegendElement,
  PageFormatId,
  PageModel,
  PageOrientation,
  TextElement,
} from "../document/types";
import { createElementOnOwnLayer, type ElementIdFactory } from "../editor/element-creation";

export const RUSSIAN_MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export type CalendarTemplateId = "editorial-photo" | "classic-grid" | "photo-feature";

export interface CalendarTemplatePreset {
  id: CalendarTemplateId;
  name: string;
  description: string;
}

export const CALENDAR_TEMPLATE_PRESETS: readonly CalendarTemplatePreset[] = [
  {
    id: "editorial-photo",
    name: "Фото + издательская сетка",
    description: "Крупное фото, открытая газетная верстка и текст месяца.",
  },
  {
    id: "classic-grid",
    name: "Классическая таблица",
    description: "Больше места календарю, ячейки с полной рамкой.",
  },
  {
    id: "photo-feature",
    name: "Акцент на фотографии",
    description: "Половина страницы под фото, компактная сетка без рамок.",
  },
] as const;

function defaultId(): string {
  return crypto.randomUUID();
}

export function requiredMonthWeekRows(year: number, month: number): number {
  const firstWeekdaySundayZero = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstColumnMondayZero = (firstWeekdaySundayZero + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.ceil((firstColumnMondayZero + daysInMonth) / 7);
}

function addLegend(
  page: PageModel,
  frame: { x: number; y: number; width: number; height: number },
  idFactory: ElementIdFactory,
): void {
  const layer = createEmptyLayer(page, `layer-object-${idFactory()}`, "Легенда");
  const element: LegendElement = {
    id: `element-${idFactory()}`,
    type: "legend",
    layerId: layer.id,
    ...frame,
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    overflow: "none",
    generatedFromVisibleMarkers: true,
    columns: 8,
  };
  attachElementToLayer(page, layer.id, element);
}

export function createMonthTemplatePageWithPreset(
  formatId: PageFormatId,
  orientation: PageOrientation,
  month: number,
  year: number,
  templateId: CalendarTemplateId,
  idFactory: ElementIdFactory = defaultId,
): PageModel {
  const page = createBlankPage(formatId, orientation);
  page.id = `page-month-${month}-${idFactory()}`;
  page.name = `${RUSSIAN_MONTH_NAMES[month - 1] ?? "Месяц"} ${year}`;
  page.kind = "month";
  page.layers = [];
  page.elements = [];

  const margin = Math.max(6, page.width * 0.034);
  const contentWidth = page.width - margin * 2;
  const preset = templateId === "classic-grid"
    ? {
        photoHeight: 0.33,
        titleY: 0.335,
        titleColor: "#8d2e25",
        gridY: 0.405,
        gridHeight: 0.535,
        legendY: 0.945,
        legendHeight: 0.05,
        gridStyle: "boxed" as const,
        weekdayMode: "short" as const,
      }
    : templateId === "photo-feature"
      ? {
          photoHeight: 0.54,
          titleY: 0.035,
          titleColor: "#fff4d0",
          gridY: 0.575,
          gridHeight: 0.365,
          legendY: 0.945,
          legendHeight: 0.05,
          gridStyle: "minimal" as const,
          weekdayMode: "full" as const,
        }
      : {
          photoHeight: 0.47,
          titleY: 0.42,
          titleColor: "#8d2e25",
          gridY: 0.5,
          gridHeight: 0.44,
          legendY: 0.945,
          legendHeight: 0.05,
          gridStyle: "editorial" as const,
          weekdayMode: "full" as const,
        };
  const photoHeight = page.height * preset.photoHeight;
  const titleHeight = page.height * 0.065;
  const gridY = page.height * preset.gridY;
  const gridHeight = page.height * preset.gridHeight;

  createElementOnOwnLayer(
    page,
    "image",
    { x: 0, y: 0, width: page.width, height: photoHeight },
    { idFactory },
  );
  const monthTitle = createElementOnOwnLayer(
    page,
    "text",
    { x: margin, y: page.height * preset.titleY, width: contentWidth, height: titleHeight },
    { idFactory, fillColor: preset.titleColor },
  ).element as TextElement;
  monthTitle.content.title = `${RUSSIAN_MONTH_NAMES[month - 1] ?? "Месяц"} ${year}`;
  monthTitle.typography.fontFamily = "Ruslan Display";
  monthTitle.typography.fontSizePt = Math.max(20, page.width * 0.105);
  monthTitle.typography.fontWeight = 400;
  monthTitle.typography.align = "center";

  const grid = createElementOnOwnLayer(
    page,
    "calendar-grid",
    { x: margin, y: gridY, width: contentWidth, height: gridHeight },
    { idFactory },
  ).element;
  if (grid.type === "calendar-grid") {
    grid.month = month;
    grid.weekRows = Math.max(4, Math.min(6, requiredMonthWeekRows(year, month))) as 4 | 5 | 6;
    grid.gridStyle = preset.gridStyle;
    grid.weekdayLabelMode = preset.weekdayMode;
    if (templateId === "photo-feature") {
      grid.eventFontSizePt = Math.max(8.5, (grid.eventFontSizePt ?? 9) * 0.94);
      grid.minimumEventFontSizePt = Math.min(grid.eventFontSizePt, 8);
      grid.dayNumberFontSizePt = Math.max(26, (grid.dayNumberFontSizePt ?? 28) * 0.94);
    }
  }

  addLegend(
    page,
    {
      x: margin,
      y: page.height * preset.legendY,
      width: contentWidth,
      height: page.height * preset.legendHeight,
    },
    idFactory,
  );
  return page;
}

export function createMonthTemplatePage(
  formatId: PageFormatId,
  orientation: PageOrientation,
  month: number,
  year: number,
  idFactory: ElementIdFactory = defaultId,
): PageModel {
  return createMonthTemplatePageWithPreset(
    formatId,
    orientation,
    month,
    year,
    "editorial-photo",
    idFactory,
  );
}

export function createCoverTemplatePage(
  formatId: PageFormatId,
  orientation: PageOrientation,
  year: number,
  publisherName: string,
  idFactory: ElementIdFactory = defaultId,
): PageModel {
  const page = createBlankPage(formatId, orientation);
  page.id = `page-cover-${idFactory()}`;
  page.name = `Обложка ${year}`;
  page.kind = "cover";
  page.layers = [];
  page.elements = [];
  const margin = Math.max(8, page.width * 0.05);

  createElementOnOwnLayer(
    page,
    "image",
    { x: 0, y: 0, width: page.width, height: page.height },
    { idFactory },
  );
  const titleBand = createElementOnOwnLayer(
    page,
    "rectangle",
    { x: margin * 0.45, y: page.height * 0.71, width: page.width - margin * 0.9, height: page.height * 0.1 },
    { idFactory, fillColor: "#741f1b", strokeColor: "#c8a64b" },
  ).element;
  if (titleBand.type === "shape") titleBand.strokeWidthMm = 0.55;
  const title = createElementOnOwnLayer(
    page,
    "text",
    { x: margin, y: page.height * 0.71, width: page.width - margin * 2, height: page.height * 0.1 },
    { idFactory, fillColor: "#fff4d0" },
  ).element as TextElement;
  title.content.title = "ПРАВОСЛАВНЫЙ КАЛЕНДАРЬ";
  title.typography.fontFamily = "Ruslan Display";
  title.typography.fontSizePt = Math.max(25, page.width * 0.12);
  title.typography.fontWeight = 400;
  title.typography.align = "center";
  title.typography.verticalAlign = "middle";

  const yearText = createElementOnOwnLayer(
    page,
    "text",
    { x: margin, y: page.height * 0.08, width: page.width - margin * 2, height: page.height * 0.12 },
    { idFactory, fillColor: "#d6ac43" },
  ).element as TextElement;
  yearText.content.title = String(year);
  yearText.typography.fontFamily = "Yeseva One";
  yearText.typography.fontSizePt = Math.max(36, page.width * 0.2);
  yearText.typography.fontWeight = 400;
  yearText.typography.align = "center";

  const publisher = createElementOnOwnLayer(
    page,
    "text",
    { x: margin, y: page.height * 0.84, width: page.width - margin * 2, height: page.height * 0.07 },
    { idFactory, fillColor: "#d6ac43" },
  ).element as TextElement;
  publisher.content.title = publisherName;
  publisher.typography.fontFamily = "Cormorant Garamond";
  publisher.typography.fontSizePt = Math.max(14, page.width * 0.06);
  publisher.typography.align = "center";

  createElementOnOwnLayer(
    page,
    "svg",
    { x: page.width * 0.39, y: page.height * 0.25, width: page.width * 0.22, height: page.width * 0.22 },
    { idFactory },
  );
  return page;
}

export function createFullCalendarTemplate(
  formatId: PageFormatId,
  orientation: PageOrientation,
  year: number,
  publisherName: string,
  templateId: CalendarTemplateId = "editorial-photo",
): PageModel[] {
  return [
    createCoverTemplatePage(formatId, orientation, year, publisherName),
    ...Array.from({ length: 12 }, (_, index) =>
      createMonthTemplatePageWithPreset(formatId, orientation, index + 1, year, templateId),
    ),
  ];
}
