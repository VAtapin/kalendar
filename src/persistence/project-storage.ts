import type { CalendarGridElement, CalendarProject, PageModel } from "../document/types";
import { COMMEMORATION_FILTER_PRESETS } from "../calendar/presentation/calendar-content-policy";
import {
  RUSSIAN_MONTH_NAMES,
  requiredMonthWeekRows,
} from "../templates/calendar-templates";

const DATABASE_NAME = "orthodox-calendar-layout";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";
const AUTOSAVE_KEY = "current-project";

function normalizeLegacyMonthLayout(page: PageModel, year: number): void {
  if (page.kind !== "month") return;
  const grid = page.elements.find(
    (element): element is CalendarGridElement => element.type === "calendar-grid",
  );
  if (!grid) return;
  const style = grid.gridStyle ?? "editorial";
  const target = style === "boxed"
    ? { y: 0.405, height: 0.535 }
    : style === "minimal"
      ? { y: 0.575, height: 0.365 }
      : { y: 0.5, height: 0.44 };
  const isTemplateGrid = Math.abs(grid.y - page.height * target.y) < page.height * 0.02;
  const compressedLegacyGrid = grid.height < page.height * (target.height - 0.01);
  if (isTemplateGrid && (compressedLegacyGrid || grid.height <= page.height * target.height)) {
    grid.y = page.height * target.y;
    grid.height = page.height * target.height;
  }
  grid.weekRows = Math.max(4, Math.min(6, requiredMonthWeekRows(year, grid.month))) as 4 | 5 | 6;

  const legend = page.elements.find((element) => element.type === "legend");
  if (legend?.type === "legend" && (isTemplateGrid || legend.height < page.height * 0.06)) {
    legend.y = page.height * 0.945;
    legend.height = page.height * 0.05;
    legend.columns = 8;
  }

  const removedIds = new Set(
    page.elements.filter((element) => element.type === "month-text").map((element) => element.id),
  );
  if (removedIds.size === 0) return;
  page.elements.splice(
    0,
    page.elements.length,
    ...page.elements.filter((element) => !removedIds.has(element.id)),
  );
  const removeGeneratedTextLayers = (nodes: typeof page.layers): void => {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];
      if (!node) continue;
      if (node.kind === "group") {
        removeGeneratedTextLayers(node.children);
      } else if (node.elementId && removedIds.has(node.elementId)) {
        nodes.splice(index, 1);
      }
    }
    nodes.forEach((node, index) => { node.order = index; });
  };
  removeGeneratedTextLayers(page.layers);
}

function normalizeLegacyTypography(page: PageModel, project: CalendarProject): void {
  for (const element of page.elements) {
    if (element.type === "calendar-grid") {
      if (!element.weekdayFontFamily || element.weekdayFontFamily === "Georgia") {
        element.weekdayFontFamily = "Ruslan Display";
      }
      if (!element.dayNumberFontFamily || element.dayNumberFontFamily === "Georgia") {
        element.dayNumberFontFamily = "Yeseva One";
      }
      if (!element.eventFontFamily || element.eventFontFamily === "Arial") {
        element.eventFontFamily = "Cormorant Garamond";
      }
      continue;
    }
    if (element.type === "month-text" && element.typography.fontFamily === "Georgia") {
      element.typography.fontFamily = "Marck Script";
      element.typography.fontStyle = "normal";
      if (element.typography.fontSizePt === 11) element.typography.fontSizePt = 13;
      continue;
    }
    if (element.type !== "text" || element.typography.fontFamily !== "Georgia") continue;
    const title = element.content.title.trim();
    const isMonthTitle = page.kind === "month" && RUSSIAN_MONTH_NAMES.some(
      (month) => title === `${month} ${project.year}`,
    );
    if (isMonthTitle || title === "ПРАВОСЛАВНЫЙ КАЛЕНДАРЬ") {
      element.typography.fontFamily = "Ruslan Display";
      element.typography.fontWeight = 400;
    } else if (page.kind === "cover" && title === String(project.year)) {
      element.typography.fontFamily = "Yeseva One";
      element.typography.fontWeight = 400;
    } else if (page.kind === "cover" && title === project.publisherProfile.name.trim()) {
      element.typography.fontFamily = "Cormorant Garamond";
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Не удалось открыть хранилище")));
  });
}

export function createPersistentProjectSnapshot(project: CalendarProject): CalendarProject {
  // Exclude the immutable XML dataset before cloning. Clearing it afterwards
  // still makes JSON.stringify walk and copy thousands of records on every
  // history entry and autosave.
  return JSON.parse(JSON.stringify({ ...project, calendarData: null })) as CalendarProject;
}

/** Adds defaults introduced within schema version 1 to older autosaves/files. */
export function normalizeCalendarProject(project: CalendarProject): CalendarProject {
  const layoutRevision = project.layoutRevision ?? 0;
  const needsLargeCalendarTypography = layoutRevision < 2;
  const needsLargerEventTypography = layoutRevision < 3;
  // Calendar source data is loaded once per application session and must not
  // become part of Vue's deep-reactive editable document.
  project.calendarData = null;
  project.printSettings ??= {
    includeCropMarks: true,
    cropMarkLengthMm: 2,
    cropMarkOffsetMm: 0.5,
  };
  project.printSettings.cropMarkLengthMm = Math.max(0.5, project.printSettings.cropMarkLengthMm || 2);
  project.printSettings.cropMarkOffsetMm = Math.max(0, project.printSettings.cropMarkOffsetMm || 0);
  if (project.foodMarkerPackId !== "ornamental" && project.foodMarkerPackId !== "dark") {
    project.foodMarkerPackId = "ornamental";
  }
  for (const page of project.document.pages) {
    for (const element of page.elements) {
      if (element.type !== "calendar-grid") continue;
      if (!element.commemorationFilter) {
        const detail = element.commemorationDetail === "main" || element.commemorationDetail === "full"
          ? element.commemorationDetail
          : "standard";
        element.commemorationFilter = { ...COMMEMORATION_FILTER_PRESETS[detail] };
        if (element.maxVisibleEvents === 6) element.maxVisibleEvents = 3;
      }
      if (element.weekdayFontSizePt === undefined || element.weekdayFontSizePt === 10 || element.weekdayFontSizePt === 14) {
        element.weekdayFontSizePt = 18;
      }
      if (
        element.dayNumberFontSizePt === undefined ||
        (needsLargeCalendarTypography && element.dayNumberFontSizePt <= 24)
      ) {
        element.dayNumberFontSizePt = 28;
      }
      if (
        element.eventFontSizePt === undefined ||
        (needsLargerEventTypography && element.eventFontSizePt <= 8)
      ) {
        element.eventFontSizePt = 9;
      }
      if (
        element.minimumEventFontSizePt === undefined ||
        (needsLargerEventTypography && element.minimumEventFontSizePt <= 7)
      ) {
        element.minimumEventFontSizePt = Math.min(element.eventFontSizePt, 8);
      }
      element.minorCommemorationFallback ??= 2;
      element.showTypikonIcons ??= false;
    }
    normalizeLegacyTypography(page, project);
    normalizeLegacyMonthLayout(page, project.year);
  }
  project.layoutRevision = 3;
  return project;
}

export async function saveAutosavedProject(project: CalendarProject): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(createPersistentProjectSnapshot(project), AUTOSAVE_KEY);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка автосохранения")));
  });
  database.close();
}

export async function loadAutosavedProject(): Promise<CalendarProject | undefined> {
  const database = await openDatabase();
  const result = await new Promise<CalendarProject | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(AUTOSAVE_KEY);
    request.addEventListener("success", () => resolve(request.result as CalendarProject | undefined));
    request.addEventListener("error", () => reject(request.error ?? new Error("Ошибка чтения проекта")));
  });
  database.close();
  return result;
}

export function isCalendarProject(value: unknown): value is CalendarProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CalendarProject>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.name === "string" &&
    !!candidate.document &&
    Array.isArray(candidate.document.pages) &&
    candidate.document.pages.length > 0
  );
}
