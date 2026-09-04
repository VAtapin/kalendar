import type { CalendarGridElement, CalendarProject, PageModel } from "../document/types";
import { COMMEMORATION_FILTER_PRESETS } from "../calendar/presentation/calendar-content-policy";
import {
  RUSSIAN_MONTH_NAMES,
  requiredMonthWeekRows,
} from "../templates/calendar-templates";
import { applyDefaultCalendarCellGeometry } from "../templates/calendar-cell-defaults";
import { normalizedOpacity } from "../document/paint";
import { isFoodMarkerPackId } from "../calendar/presentation/marker-packs";

const DATABASE_NAME = "orthodox-calendar-layout";
const DATABASE_VERSION = 4;
const STORE_NAME = "projects";
const BACKUP_STORE_NAME = "backups";
const TEMPLATE_STORE_NAME = "templates";
const GRID_TEMPLATE_STORE_NAME = "grid-templates";
const FILE_HANDLE_STORE_NAME = "file-handles";
const AUTOSAVE_KEY = "current-project";
const ACTIVE_PROJECT_FILE_HANDLE_KEY = "active-project";

export interface CalendarProjectArchive {
  format: "orthodox-calendar-project";
  archiveVersion: 1;
  savedAt: string;
  project: CalendarProject;
  manifest: {
    embeddedAssetCount: number;
    embeddedFontCount: number;
  };
}

export interface ProjectBackup {
  id: string;
  createdAt: string;
  label: string;
  project: CalendarProject;
}

export interface UserProjectTemplate {
  id: string;
  name: string;
  createdAt: string;
  project: CalendarProject;
}

export interface UserCalendarGridTemplate {
  id: string;
  name: string;
  createdAt: string;
  grid: CalendarGridElement;
}

export interface StoredProjectFileReference<THandle = unknown> {
  handle: THandle;
  name: string;
  updatedAt: string;
}

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
      if (!database.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        database.createObjectStore(BACKUP_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(TEMPLATE_STORE_NAME)) {
        database.createObjectStore(TEMPLATE_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(GRID_TEMPLATE_STORE_NAME)) {
        database.createObjectStore(GRID_TEMPLATE_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(FILE_HANDLE_STORE_NAME)) {
        database.createObjectStore(FILE_HANDLE_STORE_NAME);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Не удалось открыть хранилище")));
  });
}

/**
 * File System Access handles are structured-cloneable and can be kept in
 * IndexedDB. Persisting the active handle lets Ctrl+S continue writing to the
 * same file after a reload or a development hot update.
 */
export async function saveActiveProjectFileReference<THandle>(
  handle: THandle,
  name: string,
): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE_NAME, "readwrite");
    transaction.objectStore(FILE_HANDLE_STORE_NAME).put({
      handle,
      name,
      updatedAt: new Date().toISOString(),
    } satisfies StoredProjectFileReference<THandle>, ACTIVE_PROJECT_FILE_HANDLE_KEY);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка сохранения ссылки на файл")));
  });
  database.close();
}

export async function loadActiveProjectFileReference<THandle>(): Promise<StoredProjectFileReference<THandle> | undefined> {
  const database = await openDatabase();
  const result = await new Promise<StoredProjectFileReference<THandle> | undefined>((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE_NAME, "readonly");
    const request = transaction.objectStore(FILE_HANDLE_STORE_NAME).get(ACTIVE_PROJECT_FILE_HANDLE_KEY);
    request.addEventListener("success", () => resolve(request.result as StoredProjectFileReference<THandle> | undefined));
    request.addEventListener("error", () => reject(request.error ?? new Error("Ошибка чтения ссылки на файл")));
  });
  database.close();
  return result;
}

export async function clearActiveProjectFileReference(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FILE_HANDLE_STORE_NAME, "readwrite");
    transaction.objectStore(FILE_HANDLE_STORE_NAME).delete(ACTIVE_PROJECT_FILE_HANDLE_KEY);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка удаления ссылки на файл")));
  });
  database.close();
}

export function createPersistentProjectSnapshot(project: CalendarProject): CalendarProject {
  // Exclude the immutable XML dataset before cloning. Clearing it afterwards
  // still makes JSON.stringify walk and copy thousands of records on every
  // history entry and autosave.
  return JSON.parse(JSON.stringify({ ...project, calendarData: null })) as CalendarProject;
}

export function createProjectArchive(project: CalendarProject): CalendarProjectArchive {
  const snapshot = createPersistentProjectSnapshot(project);
  return {
    format: "orthodox-calendar-project",
    archiveVersion: 1,
    savedAt: new Date().toISOString(),
    project: snapshot,
    manifest: {
      embeddedAssetCount: snapshot.assets.filter((asset) => asset.source.startsWith("data:")).length,
      embeddedFontCount: snapshot.customFonts?.length ?? 0,
    },
  };
}

export function parseProjectArchive(value: unknown): CalendarProject | undefined {
  if (isCalendarProject(value)) return normalizeCalendarProject(value);
  if (!value || typeof value !== "object") return undefined;
  const archive = value as Partial<CalendarProjectArchive>;
  if (
    archive.format !== "orthodox-calendar-project" ||
    archive.archiveVersion !== 1 ||
    !isCalendarProject(archive.project)
  ) return undefined;
  return normalizeCalendarProject(archive.project);
}

/** Adds defaults introduced within schema version 1 to older autosaves/files. */
export function normalizeCalendarProject(project: CalendarProject): CalendarProject {
  const layoutRevision = project.layoutRevision ?? 0;
  const needsLargeCalendarTypography = layoutRevision < 2;
  const needsLargerEventTypography = layoutRevision < 3;
  const needsPrintScaleTypography = layoutRevision < 4;
  // Calendar source data is loaded once per application session and must not
  // become part of Vue's deep-reactive editable document.
  project.calendarData = null;
  project.fastingProfileId = project.fastingProfileId === "parish" ? "parish" : "typikon-strict";
  project.printSettings ??= {
    includeCropMarks: true,
    cropMarkLengthMm: 2,
    cropMarkOffsetMm: 0.5,
  };
  project.printSettings.bindingEdge ??= "top";
  project.printSettings.bindingSafeMm = Math.max(0, project.printSettings.bindingSafeMm ?? 12);
  project.printSettings.pdfStandard ??= "PDF-1.7";
  project.printSettings.colorProfile ??= "sRGB";
  project.printSettings.outputConditionName ??= project.printSettings.colorProfile === "CMYK-custom"
    ? "Пользовательский профиль типографии"
    : "sRGB IEC61966-2.1";
  project.customFonts ??= [];
  project.printSettings.cropMarkLengthMm = Math.max(0.5, project.printSettings.cropMarkLengthMm || 2);
  project.printSettings.cropMarkOffsetMm = Math.max(0, project.printSettings.cropMarkOffsetMm || 0);
  if (!isFoodMarkerPackId(project.foodMarkerPackId)) {
    project.foodMarkerPackId = "ornamental";
  }
  for (const page of project.document.pages) {
    for (const element of page.elements) {
      element.opacity = normalizedOpacity(element.opacity);
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
        (needsLargeCalendarTypography && element.dayNumberFontSizePt <= 24) ||
        (needsPrintScaleTypography && element.dayNumberFontSizePt === 28)
      ) {
        element.dayNumberFontSizePt = 30;
      }
      if (
        element.eventFontSizePt === undefined ||
        (needsLargerEventTypography && element.eventFontSizePt <= 8) ||
        (needsPrintScaleTypography && element.eventFontSizePt === 9)
      ) {
        element.eventFontSizePt = 10;
      }
      if (
        element.minimumEventFontSizePt === undefined ||
        (needsLargerEventTypography && element.minimumEventFontSizePt <= 7) ||
        (needsPrintScaleTypography && element.minimumEventFontSizePt === 8)
      ) {
        element.minimumEventFontSizePt = Math.min(element.eventFontSizePt, 9);
      }
      element.minorCommemorationFallback ??= 2;
      element.showTypikonIcons ??= false;
      if (layoutRevision < 5 && element.typikonMarkerYOffsetMm === 0) {
        element.typikonMarkerXOffsetMm = undefined;
        element.typikonMarkerYOffsetMm = undefined;
      }
      applyDefaultCalendarCellGeometry(element);
    }
    normalizeLegacyTypography(page, project);
    normalizeLegacyMonthLayout(page, project.year);
  }
  project.layoutRevision = 6;
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

export async function saveProjectBackup(project: CalendarProject, label: string): Promise<ProjectBackup> {
  const createdAt = new Date().toISOString();
  const backup: ProjectBackup = {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    createdAt,
    label,
    project: createPersistentProjectSnapshot(project),
  };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BACKUP_STORE_NAME, "readwrite");
    transaction.objectStore(BACKUP_STORE_NAME).put(backup);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка резервного копирования")));
  });
  const all = await listProjectBackups(11, database);
  if (all.length > 10) {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(BACKUP_STORE_NAME, "readwrite");
      for (const stale of all.slice(10)) transaction.objectStore(BACKUP_STORE_NAME).delete(stale.id);
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка очистки резервных копий")));
    });
  }
  database.close();
  return backup;
}

export async function listProjectBackups(
  limit = 10,
  existingDatabase?: IDBDatabase,
): Promise<ProjectBackup[]> {
  const database = existingDatabase ?? await openDatabase();
  const result = await new Promise<ProjectBackup[]>((resolve, reject) => {
    const transaction = database.transaction(BACKUP_STORE_NAME, "readonly");
    const request = transaction.objectStore(BACKUP_STORE_NAME).getAll();
    request.addEventListener("success", () => resolve((request.result as ProjectBackup[])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)));
    request.addEventListener("error", () => reject(request.error ?? new Error("Ошибка чтения резервных копий")));
  });
  if (!existingDatabase) database.close();
  return result;
}

export async function saveUserProjectTemplate(name: string, project: CalendarProject): Promise<UserProjectTemplate> {
  const template: UserProjectTemplate = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    project: createPersistentProjectSnapshot(project),
  };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(TEMPLATE_STORE_NAME, "readwrite");
    transaction.objectStore(TEMPLATE_STORE_NAME).put(template);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка сохранения шаблона")));
  });
  database.close();
  return template;
}

export async function listUserProjectTemplates(): Promise<UserProjectTemplate[]> {
  const database = await openDatabase();
  const result = await new Promise<UserProjectTemplate[]>((resolve, reject) => {
    const transaction = database.transaction(TEMPLATE_STORE_NAME, "readonly");
    const request = transaction.objectStore(TEMPLATE_STORE_NAME).getAll();
    request.addEventListener("success", () => resolve((request.result as UserProjectTemplate[])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))));
    request.addEventListener("error", () => reject(request.error ?? new Error("Ошибка чтения шаблонов")));
  });
  database.close();
  return result;
}

export async function deleteUserProjectTemplate(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(TEMPLATE_STORE_NAME, "readwrite");
    transaction.objectStore(TEMPLATE_STORE_NAME).delete(id);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка удаления шаблона")));
  });
  database.close();
}

export async function saveUserCalendarGridTemplate(
  name: string,
  grid: CalendarGridElement,
): Promise<UserCalendarGridTemplate> {
  const template: UserCalendarGridTemplate = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    // Vue passes a reactive proxy from the editor; JSON materialisation removes
    // proxy internals before IndexedDB receives the self-contained preset.
    grid: JSON.parse(JSON.stringify(grid)) as CalendarGridElement,
  };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(GRID_TEMPLATE_STORE_NAME, "readwrite");
    transaction.objectStore(GRID_TEMPLATE_STORE_NAME).put(template);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка сохранения шаблона сетки")));
  });
  database.close();
  return template;
}

export async function listUserCalendarGridTemplates(): Promise<UserCalendarGridTemplate[]> {
  const database = await openDatabase();
  const result = await new Promise<UserCalendarGridTemplate[]>((resolve, reject) => {
    const transaction = database.transaction(GRID_TEMPLATE_STORE_NAME, "readonly");
    const request = transaction.objectStore(GRID_TEMPLATE_STORE_NAME).getAll();
    request.addEventListener("success", () => resolve((request.result as UserCalendarGridTemplate[])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))));
    request.addEventListener("error", () => reject(request.error ?? new Error("Ошибка чтения шаблонов сетки")));
  });
  database.close();
  return result;
}

export async function deleteUserCalendarGridTemplate(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(GRID_TEMPLATE_STORE_NAME, "readwrite");
    transaction.objectStore(GRID_TEMPLATE_STORE_NAME).delete(id);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Ошибка удаления шаблона сетки")));
  });
  database.close();
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
