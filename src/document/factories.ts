import type {
  CalendarProject,
  DocumentModel,
  PageFormatId,
  PageModel,
  PageLayerNode,
  PageOrientation,
  StyleTheme,
} from "./types";
import {
  createBrandLogoAsset,
  ensureCalendarWorkshopBranding,
  BRAND_LOGO_ASSET_ID,
} from "./branding";

export const PAGE_FORMATS: Readonly<
  Record<PageFormatId, { label: string; width: number; height: number }>
> = Object.freeze({
  A3: { label: "A3", width: 297, height: 420 },
  A4: { label: "A4", width: 210, height: 297 },
  A5: { label: "A5", width: 148, height: 210 },
  A6: { label: "A6", width: 105, height: 148 },
});

export const A3_PORTRAIT = PAGE_FORMATS.A3;

export function getPageDimensions(
  formatId: PageFormatId,
  orientation: PageOrientation,
): { width: number; height: number } {
  const format = PAGE_FORMATS[formatId];
  return orientation === "portrait"
    ? { width: format.width, height: format.height }
    : { width: format.height, height: format.width };
}

export function createInitialPageLayers(): PageLayerNode[] {
  return [
    {
      id: "layer-1",
      kind: "layer",
      name: "Слой 1",
      order: 0,
      visible: true,
      locked: false,
      color: "#4f7da1",
    },
  ];
}

export function createBlankPage(
  formatId: PageFormatId = "A3",
  orientation: PageOrientation = "portrait",
): PageModel {
  const dimensions = getPageDimensions(formatId, orientation);
  return {
    id: `page-${formatId.toLowerCase()}-${orientation}`,
    name: `Пустая страница ${formatId}`,
    kind: "information",
    formatId,
    orientation,
    width: dimensions.width,
    height: dimensions.height,
    bleed: { top: 3, right: 3, bottom: 3, left: 3 },
    safeArea: { top: 15, right: 10, bottom: 10, left: 10 },
    backgroundToken: "paper",
    layers: createInitialPageLayers(),
    elements: [],
  };
}

export const createBlankA3Page = (): PageModel => createBlankPage("A3", "portrait");

export function changePageFormat(
  page: PageModel,
  formatId: PageFormatId,
  orientation: PageOrientation,
): void {
  const dimensions = getPageDimensions(formatId, orientation);
  const scaleX = dimensions.width / page.width;
  const scaleY = dimensions.height / page.height;
  const scale = Math.min(scaleX, scaleY);
  for (const element of page.elements) {
    element.x *= scaleX;
    element.y *= scaleY;
    element.width *= scaleX;
    element.height *= scaleY;
    if (element.type === "text" || element.type === "month-text") {
      element.typography.fontSizePt *= scale;
      element.typography.letterSpacingPt *= scale;
      element.typography.paddingMm *= scale;
    } else if (element.type === "shape") {
      element.strokeWidthMm *= scale;
    } else if (element.type === "calendar-grid") {
      if (element.dayNumberFontSizePt !== undefined) element.dayNumberFontSizePt *= scale;
      if (element.eventFontSizePt !== undefined) element.eventFontSizePt *= scale;
      if (element.eventLineSpacingPt !== undefined) element.eventLineSpacingPt *= scale;
      if (element.eventGapPt !== undefined) element.eventGapPt *= scale;
      if (element.cellPaddingMm !== undefined) element.cellPaddingMm *= scale;
      if (element.weekdayFontSizePt !== undefined) element.weekdayFontSizePt *= scale;
      if (element.oldStyleFontSizePt !== undefined) element.oldStyleFontSizePt *= scale;
      if (element.dayNumberXOffsetMm !== undefined) element.dayNumberXOffsetMm *= scaleX;
      if (element.dayNumberYOffsetMm !== undefined) element.dayNumberYOffsetMm *= scaleY;
      if (element.oldStyleXOffsetMm !== undefined) element.oldStyleXOffsetMm *= scaleX;
      if (element.oldStyleYOffsetMm !== undefined) element.oldStyleYOffsetMm *= scaleY;
      if (element.foodMarkerSizeMm !== undefined) element.foodMarkerSizeMm *= scale;
      if (element.foodMarkerXOffsetMm !== undefined) element.foodMarkerXOffsetMm *= scaleX;
      if (element.foodMarkerYOffsetMm !== undefined) element.foodMarkerYOffsetMm *= scaleY;
      if (element.eventTextXOffsetMm !== undefined) element.eventTextXOffsetMm *= scaleX;
      if (element.eventTextYOffsetMm !== undefined) element.eventTextYOffsetMm *= scaleY;
      if (element.eventTextRightInsetMm !== undefined) element.eventTextRightInsetMm *= scaleX;
      if (element.eventTextBottomInsetMm !== undefined) element.eventTextBottomInsetMm *= scaleY;
      if (element.typikonMarkerSizeMm !== undefined) element.typikonMarkerSizeMm *= scale;
      if (element.typikonMarkerXOffsetMm !== undefined) element.typikonMarkerXOffsetMm *= scaleX;
      if (element.typikonMarkerYOffsetMm !== undefined) element.typikonMarkerYOffsetMm *= scaleY;
    }
  }
  page.safeArea = {
    top: page.safeArea.top * scaleY,
    right: page.safeArea.right * scaleX,
    bottom: page.safeArea.bottom * scaleY,
    left: page.safeArea.left * scaleX,
  };
  page.formatId = formatId;
  page.orientation = orientation;
  page.width = dimensions.width;
  page.height = dimensions.height;
}

export function createBlankA3Document(): DocumentModel {
  return {
    schemaVersion: 1,
    unit: "mm",
    title: "Новый печатный документ",
    pages: [createBlankA3Page()],
  };
}

function createDefaultTheme(): StyleTheme {
  return {
    id: "default-print-theme",
    name: "Базовая печатная тема",
    tokens: {
      paper: { id: "paper", label: "Бумага", backgroundColor: "#ffffff" },
      "ordinary-day": {
        id: "ordinary-day",
        label: "Обычный день",
        numberColor: "#17201d",
        textColor: "#17201d",
      },
      sunday: {
        id: "sunday",
        label: "Воскресенье",
        numberColor: "#a12b2b",
        textColor: "#a12b2b",
        fontWeight: 700,
      },
      "great-feast": {
        id: "great-feast",
        label: "Великий праздник",
        numberColor: "#a12b2b",
        textColor: "#a12b2b",
        fontWeight: 700,
      },
      fast: {
        id: "fast",
        label: "Пост",
        numberColor: "#3c7257",
        textColor: "#3c7257",
      },
      "monastery-feast": {
        id: "monastery-feast",
        label: "Событие монастыря",
        numberColor: "#7f5a19",
        textColor: "#7f5a19",
        fontWeight: 700,
      },
    },
  };
}

export function createBlankCalendarProject(year = 2027): CalendarProject {
  const project: CalendarProject = {
    schemaVersion: 1,
    layoutRevision: 6,
    id: "calendar-project",
    name: `Православный календарь ${year}`,
    publisherProfile: { name: "Издатель", logoAssetId: BRAND_LOGO_ASSET_ID },
    year,
    calendarLanguage: "ru",
    fastingProfileId: "typikon-strict",
    calendarData: null,
    monasteryEvents: [],
    styleTheme: createDefaultTheme(),
    assets: [createBrandLogoAsset()],
    customFonts: [],
    programSettings: { interfaceLanguage: "ru" },
    printSettings: {
      includeCropMarks: true,
      cropMarkLengthMm: 2,
      cropMarkOffsetMm: 0.5,
      bindingEdge: "top",
      bindingSafeMm: 12,
      pdfStandard: "PDF-1.7",
      colorProfile: "sRGB",
      outputConditionName: "sRGB IEC61966-2.1",
    },
    foodMarkerPackId: "ornamental",
    foodMarkerAssets: {},
    document: createBlankA3Document(),
  };
  ensureCalendarWorkshopBranding(project);
  return project;
}
