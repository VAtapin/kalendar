import type {
  CalendarProject,
  ImageElement,
  LayoutElementNode,
  PageLayerNode,
  PageModel,
} from "../document/types";
import { BRAND_LOGO_ASSET_ID } from "../document/branding";
import { calendarMonthHeading } from "../calendar/localization/calendar-language";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function monthOf(page: PageModel): number | undefined {
  return page.elements.find((element) => element.type === "calendar-grid")?.month;
}

function replaceYearText(value: string, oldYear: number, newYear: number): string {
  return value.replace(new RegExp(`\\b${oldYear}\\b`, "gu"), String(newYear));
}

export function updatePageCalendarYear(
  page: PageModel,
  oldYear: number,
  newYear: number,
  calendarLanguage: CalendarProject["calendarLanguage"] = "ru",
): void {
  const month = monthOf(page);
  if (page.kind === "month" && month) {
    page.name = calendarMonthHeading(month, newYear, calendarLanguage);
  } else {
    page.name = replaceYearText(page.name, oldYear, newYear);
  }
  for (const element of page.elements) {
    if (element.type !== "text" && element.type !== "month-text") continue;
    if (element.type === 'text' && element.manualTitle) continue;
    element.content.title = replaceYearText(element.content.title, oldYear, newYear);
    if (element.content.shortTitle) {
      element.content.shortTitle = replaceYearText(element.content.shortTitle, oldYear, newYear);
    }
    if (element.content.veryShortTitle) {
      element.content.veryShortTitle = replaceYearText(element.content.veryShortTitle, oldYear, newYear);
    }
  }
}

/** Creates an independent project for another civil year without rebuilding pages. */
export function cloneProjectForYear(
  source: CalendarProject,
  year: number,
  idFactory: () => string = () => crypto.randomUUID(),
): CalendarProject {
  const project = clone(source);
  const oldYear = project.year;
  project.id = `calendar-project-${idFactory()}`;
  project.year = year;
  project.name = replaceYearText(project.name, oldYear, year);
  if (project.name === source.name) project.name = `${source.name} — ${year}`;
  project.document.title = replaceYearText(project.document.title, oldYear, year);
  project.document.pages.forEach((page) => updatePageCalendarYear(page, oldYear, year, project.calendarLanguage));
  project.calendarData = null;
  return project;
}

function remapLayerTree(
  nodes: PageLayerNode[],
  prefix: string,
  layerIds: Map<string, string>,
  elementIds: Map<string, string>,
): void {
  for (const node of nodes) {
    const oldLayerId = node.id;
    node.id = `${prefix}-${oldLayerId}`;
    layerIds.set(oldLayerId, node.id);
    if (node.kind === "group") remapLayerTree(node.children, prefix, layerIds, elementIds);
    else if (node.elementId) {
      const oldElementId = node.elementId;
      node.elementId = `${prefix}-${oldElementId}`;
      elementIds.set(oldElementId, node.elementId);
    }
  }
}

type TextContentElement = Extract<LayoutElementNode, { type: "text" | "month-text" }>;

function isTextContentElement(element: LayoutElementNode): element is TextContentElement {
  return element.type === "text" || element.type === "month-text";
}

function isDecorImage(element: ImageElement): boolean {
  return element.assetId === BRAND_LOGO_ASSET_ID || element.assetId.startsWith("asset-decor-");
}

function isPhotoContentElement(element: LayoutElementNode): element is ImageElement {
  return element.type === "image" && !isDecorImage(element);
}

/**
 * Applies one designed month as a real master page. Geometry and presentation
 * come from the master, while each month's text and photo-frame contents remain
 * untouched. An empty target photo frame therefore stays empty. Decorative
 * library images and SVG elements are part of the master design.
 */
export function applyMonthMaster(
  project: CalendarProject,
  sourcePageId: string,
): { changedPages: number; preservedImages: number } {
  const source = project.document.pages.find((page) => page.id === sourcePageId && page.kind === "month");
  if (!source) throw new Error("Для мастер-страницы нужно выбрать страницу месяца");
  let changedPages = 0;
  let preservedImages = 0;
  for (const target of project.document.pages) {
    if (target.kind !== "month" || target.id === source.id) continue;
    const targetMonth = monthOf(target);
    if (!targetMonth) continue;
    const oldPhotoAssets = target.elements
      .filter(isPhotoContentElement)
      .map((element) => element.assetId);
    const oldTextContents = target.elements
      .filter(isTextContentElement)
      .map((element) => ({
        content: clone(element.content),
        attribution: element.type === "month-text" ? element.attribution : undefined,
      }));
    const oldGridRows = target.elements
      .filter((element) => element.type === "calendar-grid")
      .map((element) => element.weekRows);
    const next = clone(source);
    const prefix = `master-${targetMonth}-${crypto.randomUUID()}`;
    const layerIds = new Map<string, string>();
    const elementIds = new Map<string, string>();
    remapLayerTree(next.layers, prefix, layerIds, elementIds);
    next.elements.forEach((element) => {
      const oldElementId = element.id;
      element.id = elementIds.get(oldElementId) ?? `${prefix}-${oldElementId}`;
      element.layerId = layerIds.get(element.layerId) ?? `${prefix}-${element.layerId}`;
    });
    next.elements.filter(isPhotoContentElement).forEach((element, index) => {
      const preserved = oldPhotoAssets[index] ?? "";
      element.assetId = preserved;
      if (preserved) preservedImages += 1;
    });
    next.elements.filter(isTextContentElement).forEach((element, index) => {
      const preserved = oldTextContents[index];
      if (!preserved) return;
      element.content = clone(preserved.content);
      if (element.type === "month-text") element.attribution = preserved.attribution;
    });
    next.elements.filter((element) => element.type === "calendar-grid").forEach((element, index) => {
      element.month = targetMonth;
      element.weekRows = oldGridRows[index] ?? element.weekRows;
    });
    next.id = target.id;
    next.name = calendarMonthHeading(targetMonth, project.year, project.calendarLanguage);
    updatePageCalendarYear(next, project.year, project.year, project.calendarLanguage);
    Object.assign(target, next);
    changedPages += 1;
  }
  return { changedPages, preservedImages };
}

export function describeMonthMasterApplication(project: CalendarProject, sourcePageId: string): string {
  const source = project.document.pages.find((page) => page.id === sourcePageId);
  const targets = project.document.pages.filter((page) => page.kind === "month" && page.id !== sourcePageId);
  const placedPhotos = targets.reduce(
    (total, page) => total + page.elements.filter((element) => element.type === "image" && element.assetId).length,
    0,
  );
  return `Мастер «${source?.name ?? "месяц"}» будет применён к ${targets.length} страницам. ` +
    `Названия месяцев и содержимое текстовых рамок останутся своими. ` +
    `${placedPhotos} назначенных изображений будут сохранены, а пустые фоторамки останутся пустыми. ` +
    "Геометрия, сетка, шрифты и декор остальных месяцев будут заменены; действие можно отменить.";
}
