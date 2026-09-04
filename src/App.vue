<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import DocumentWorkspace from "./components/DocumentWorkspace.vue";
import DecorLibraryPanel from "./components/DecorLibraryPanel.vue";
import LayersPanel from "./components/LayersPanel.vue";
import ToolsPanel from "./components/ToolsPanel.vue";
import {
  changePageFormat,
  createBlankCalendarProject,
  PAGE_FORMATS,
} from "./document/factories";
import {
  createEmptyLayer,
  createLayerGroup,
  findLayerLocation,
  groupLayerNodes,
  moveLayerNode,
  moveLayerNodeToEdge,
  removeLayerNode,
} from "./document/layer-operations";
import type {
  CalendarGridElement,
  CalendarProject,
  CommemorationRankFilterId,
  MonasteryEvent,
  PageFormatId,
  PageOrientation,
  SvgElement,
} from "./document/types";
import {
  PRINT_GOLD_COLOR,
  createGoldGradient,
  createLinearGradient,
  normalizedOpacity,
} from "./document/paint";
import { createElementOnOwnLayer, duplicateElementOnOwnLayer } from "./editor/element-creation";
import type { ElementFrame } from "./editor/element-creation";
import { alignElements, distributeElements, type AlignMode, type DistributeMode } from "./editor/alignment";
import type { DockPanelId, EditorTool } from "./editor/types";
import { FOOD_RULES, type FoodRuleId } from "./calendar/presentation/fasting";
import {
  FOOD_MARKER_PACKS,
  foodMarkerPackSource,
  getFoodMarkerPack,
  isFoodMarkerPackId,
} from "./calendar/presentation/marker-packs";
import { mergeMonasteryEvents } from "./calendar/engine/merge-monastery-events";
import { FASTING_PROFILES } from "./calendar/fasting/fasting-api";
import type { MemoryDaysDataset, OrthodoxCalendarYear } from "./calendar/types";
import {
  COMMEMORATION_FILTER_OPTIONS,
  COMMEMORATION_FILTER_PRESETS,
  commemorationFilterForElement,
} from "./calendar/presentation/calendar-content-policy";
import {
  createProjectArchive,
  createPersistentProjectSnapshot,
  listProjectBackups,
  listUserCalendarGridTemplates,
  listUserProjectTemplates,
  loadAutosavedProject,
  normalizeCalendarProject,
  parseProjectArchive,
  saveAutosavedProject,
  saveProjectBackup,
  saveUserCalendarGridTemplate,
  saveUserProjectTemplate,
  deleteUserCalendarGridTemplate,
  deleteUserProjectTemplate,
  type ProjectBackup,
  type UserCalendarGridTemplate,
  type UserProjectTemplate,
} from "./persistence/project-storage";
import {
  CALENDAR_TEMPLATE_PRESETS,
  createCoverTemplatePage,
  createFullCalendarTemplate,
  createMonthTemplatePageWithPreset,
  type CalendarTemplateId,
} from "./templates/calendar-templates";
import { checkCalendarProject, type PreflightIssue } from "./preflight/project-preflight";
import { copyCalendarGridPresentation } from "./templates/calendar-grid-settings";
import { DECOR_LIBRARY_ITEMS, type DecorLibraryItem } from "./decor/decor-library";
import { recolorSvgMarkup, svgMarkupDataUrl } from "./decor/svg-recolor";
import { FONT_OPTIONS } from "./typography/font-catalog";
import {
  applyMonthMaster,
  cloneProjectForYear,
  describeMonthMasterApplication,
} from "./templates/project-templates";

const project = ref(createBlankCalendarProject());
const zoomPercent = ref(55);
const showGuides = ref(true);
const activeTool = ref<EditorTool>("selection");
const selectedLayerIds = ref(["layer-1"]);
const selectedPageId = ref(project.value.document.pages[0]?.id ?? "");
const selectedElementId = ref<string>();
const assetFileInput = ref<HTMLInputElement>();
const projectFileInput = ref<HTMLInputElement>();
const projectFileName = ref<string>();
const savedProjectFileSnapshot = ref<string>();
const foodMarkerFileInput = ref<HTMLInputElement>();
const fontFileInput = ref<HTMLInputElement>();
const iccProfileFileInput = ref<HTMLInputElement>();
const pendingFoodMarkerRule = ref<FoodRuleId>();
const activeDockPanel = ref<DockPanelId>("properties");
const DOCK_PANEL_DEFAULT_WIDTH_PX = 284;
const DOCK_PANEL_MIN_WIDTH_PX = 180;
const EDITOR_MIN_WORKSPACE_WIDTH_PX = 640;
const EDITOR_RESIZER_WIDTH_PX = 7;
const dockPanelWidthPx = ref(DOCK_PANEL_DEFAULT_WIDTH_PX);
const viewportWidthPx = ref(typeof window === "undefined" ? 1440 : window.innerWidth);
const dockPanelResizing = ref(false);
let dockResizePointerId: number | undefined;
let dockResizeStartX = 0;
let dockResizeStartWidth = DOCK_PANEL_DEFAULT_WIDTH_PX;
const selectedTemplateId = ref<CalendarTemplateId>("editorial-photo");
const userProjectTemplates = ref<UserProjectTemplate[]>([]);
const userCalendarGridTemplates = ref<UserCalendarGridTemplate[]>([]);
const projectBackups = ref<ProjectBackup[]>([]);
const RECENT_PROJECTS_KEY = "orthodox-calendar-layout:recent-projects";
const recentProjectNames = ref<string[]>([]);
type ApplicationMenuId = "file" | "edit" | "layout" | "object" | "text" | "view" | "window" | "help";
type MenuCommandId =
  | "new-project" | "open-project" | "save-project" | "save-as-project" | "download-project" | "export-pdf"
  | "save-user-template" | "clone-year"
  | "undo" | "redo" | "duplicate" | "delete"
  | "full-template" | "add-cover" | "add-month" | "delete-page"
  | "apply-month-master"
  | "bring-front" | "send-back" | "group" | "toggle-lock" | "toggle-visible"
  | "align-object-left" | "align-object-center" | "align-object-right"
  | "align-object-top" | "align-object-middle" | "align-object-bottom"
  | "distribute-horizontal" | "distribute-vertical"
  | "bold" | "italic" | "align-left" | "align-center" | "align-right"
  | "toggle-guides" | "zoom-in" | "zoom-out" | "fit-page"
  | "toggle-tools" | "toggle-properties" | "toggle-library" | "toggle-layers" | "toggle-pages" | "toggle-events" | "toggle-preflight" | "toggle-all-panels"
  | "shortcuts" | "about";

interface WritableProjectFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface ProjectFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableProjectFile>;
}

interface ProjectPickerWindow extends Window {
  showSaveFilePicker?: (options: unknown) => Promise<ProjectFileHandle>;
  showOpenFilePicker?: (options: unknown) => Promise<ProjectFileHandle[]>;
}

let activeProjectFileHandle: ProjectFileHandle | undefined;
interface MenuItemDefinition {
  command?: MenuCommandId;
  label?: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  separator?: boolean;
}
interface ApplicationMenuDefinition {
  id: ApplicationMenuId;
  label: string;
  items: MenuItemDefinition[];
}
interface HistoryEntry {
  snapshot: string;
  label: string;
  pageId: string;
}
const activeMenu = ref<ApplicationMenuId>();
const chromePanelsHidden = ref(false);
const operationNotice = ref("Документ готов к редактированию");
// Both structures are immutable and large. Deep Vue proxies only add work to
// rendering, history and autosave, so keep just their top-level references reactive.
const calendarDataset = shallowRef<MemoryDaysDataset>();
const calendarYear = shallowRef<OrthodoxCalendarYear>();
const calendarLoadState = ref<"loading" | "ready" | "error">("loading");
const persistenceState = ref<"loading" | "saved" | "saving" | "error">("loading");
const pdfExportState = ref<"idle" | "exporting" | "ready" | "error">("idle");
const currentFillColor = ref("#f4f1e8");
const currentStrokeColor = ref("#17201d");
const fontOptionGroups = computed(() => [
  { label: "Декоративные кириллические", options: FONT_OPTIONS.filter((option) => option.kind === "decorative") },
  { label: "Книжные", options: FONT_OPTIONS.filter((option) => option.kind === "text") },
  {
    label: "Шрифты проекта",
    options: (project.value.customFonts ?? []).map((font) => ({
      family: font.family,
      label: `${font.family} — встроенный`,
      description: "Встроен в проект и печатный PDF",
      kind: "decorative" as const,
    })),
  },
  { label: "Системные", options: FONT_OPTIONS.filter((option) => option.kind === "system") },
].filter((group) => group.options.length > 0));
const undoStack = ref<HistoryEntry[]>([]);
const redoStack = ref<HistoryEntry[]>([]);
let continuousEditSnapshot: string | undefined;
let continuousEditPageId: string | undefined;
let autosaveTimer: number | undefined;
let persistenceReady = false;
let calendarDatasetPromise: Promise<MemoryDaysDataset> | undefined;
let calendarRuntimePromise: Promise<{
  parseMemoryDaysXml: typeof import("./calendar/xml/parse-memory-days").parseMemoryDaysXml;
  buildOrthodoxCalendarYear: typeof import("./calendar/engine/build-calendar-year").buildOrthodoxCalendarYear;
}> | undefined;
const calendarYearCache = new Map<number, OrthodoxCalendarYear>();
const EDITOR_STATE_KEY = "orthodox-calendar-layout:editor-state";
const panelVisibility = ref({
  tools: true,
  properties: true,
  library: true,
  layers: true,
  pages: true,
  events: true,
  preflight: true,
});

const dockPanels: ReadonlyArray<{ id: DockPanelId; label: string }> = [
  { id: "properties", label: "Свойства" },
  { id: "library", label: "Элементы" },
  { id: "layers", label: "Слои" },
  { id: "pages", label: "Страницы" },
  { id: "events", label: "События" },
  { id: "preflight", label: "Проверка" },
];
const monthNames = [
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
const foodRuleOptions = Object.values(FOOD_RULES).filter((rule) => rule.id !== "no-fast");
const foodMarkerPackOptions = FOOD_MARKER_PACKS;
const foodMarkerPackPreviewRules: readonly FoodRuleId[] = ["fast", "fish", "strict-fast"];
const activeFoodMarkerPack = computed(() => getFoodMarkerPack(project.value.foodMarkerPackId));
const calendarTemplatePresets = CALENDAR_TEMPLATE_PRESETS;
const commemorationFilterOptions = COMMEMORATION_FILTER_OPTIONS;
const fastingProfileOptions = Object.values(FASTING_PROFILES);
const decorLibraryItems = DECOR_LIBRARY_ITEMS;

const selectedPage = computed(() => {
  const page =
    project.value.document.pages.find((item) => item.id === selectedPageId.value) ??
    project.value.document.pages[0];
  if (!page) throw new Error("Документ должен содержать хотя бы одну страницу");
  return page;
});
const selectedPageIndex = computed(() =>
  Math.max(0, project.value.document.pages.findIndex((page) => page.id === selectedPage.value.id)),
);
const selectedElement = computed(() =>
  selectedPage.value.elements.find((element) => element.id === selectedElementId.value),
);
const projectFileStatus = computed(() => {
  if (!projectFileName.value) return "Файл проекта не выбран";
  return savedProjectFileSnapshot.value === serializeEditableProject()
    ? `Файл: ${projectFileName.value}`
    : `Файл изменён: ${projectFileName.value}`;
});
const cropMarksEnabled = computed({
  get: () => project.value.printSettings?.includeCropMarks ?? true,
  set: (value: boolean) => {
    project.value.printSettings ??= { includeCropMarks: value, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
    project.value.printSettings.includeCropMarks = value;
  },
});
const cropMarkLengthMm = computed({
  get: () => project.value.printSettings?.cropMarkLengthMm ?? 2,
  set: (value: number) => {
    project.value.printSettings ??= { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
    project.value.printSettings.cropMarkLengthMm = Math.max(0.5, value);
  },
});
const bindingEdge = computed({
  get: () => project.value.printSettings?.bindingEdge ?? "top",
  set: (value: "none" | "top" | "left" | "right") => {
    project.value.printSettings ??= { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
    project.value.printSettings.bindingEdge = value;
  },
});
const bindingSafeMm = computed({
  get: () => project.value.printSettings?.bindingSafeMm ?? 12,
  set: (value: number) => {
    project.value.printSettings ??= { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
    project.value.printSettings.bindingSafeMm = Math.max(0, value);
  },
});
const pdfStandard = computed({
  get: () => project.value.printSettings?.pdfStandard ?? "PDF-1.7",
  set: (value: "PDF-1.7" | "PDF/X-4") => {
    project.value.printSettings ??= { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
    project.value.printSettings.pdfStandard = value;
  },
});
const iccProfileName = computed(() => {
  const assetId = project.value.printSettings?.iccProfileAssetId;
  return project.value.assets.find((asset) => asset.id === assetId)?.name;
});
const cropMarkOffsetMm = computed({
  get: () => project.value.printSettings?.cropMarkOffsetMm ?? 0.5,
  set: (value: number) => {
    project.value.printSettings ??= { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
    project.value.printSettings.cropMarkOffsetMm = Math.max(0, value);
  },
});
const selectedLayerElements = computed(() => {
  const selected = new Set(selectedLayerIds.value);
  return selectedPage.value.elements.filter((element) => selected.has(element.layerId));
});

// This conversion exists only in the editor viewport. The document remains in mm.
const pixelsPerMm = computed(() => 3.2 * (zoomPercent.value / 100));
const orientationLabel = computed(() =>
  selectedPage.value.orientation === "portrait" ? "Книжная" : "Альбомная",
);
const visibleDockPanels = computed(() =>
  dockPanels.filter((panel) => panelVisibility.value[panel.id]),
);
const showToolsPanel = computed(
  () => panelVisibility.value.tools && !chromePanelsHidden.value,
);
const showDock = computed(
  () => visibleDockPanels.value.length > 0 && !chromePanelsHidden.value,
);
const dockPanelMaximumWidthPx = computed(() => Math.max(
  DOCK_PANEL_MIN_WIDTH_PX,
  viewportWidthPx.value -
    (showToolsPanel.value ? 44 : 0) -
    EDITOR_RESIZER_WIDTH_PX -
    EDITOR_MIN_WORKSPACE_WIDTH_PX,
));
const editorGridColumns = computed(() =>
  [
    showToolsPanel.value ? "44px" : null,
    `minmax(${EDITOR_MIN_WORKSPACE_WIDTH_PX}px, 1fr)`,
    showDock.value ? `${EDITOR_RESIZER_WIDTH_PX}px` : null,
    showDock.value ? `${dockPanelWidthPx.value}px` : null,
  ]
    .filter(Boolean)
    .join(" "),
);
const calendarEventCount = computed(() =>
  displayedCalendarYear.value?.days.reduce((total, day) => total + day.events.length, 0) ?? 0,
);
const displayedCalendarYear = computed(() =>
  calendarYear.value
    ? mergeMonasteryEvents(calendarYear.value, project.value.monasteryEvents)
    : undefined,
);
const preflightIssues = computed(() =>
  checkCalendarProject(project.value, displayedCalendarYear.value),
);
const preflightErrorCount = computed(() =>
  preflightIssues.value.filter((item) => item.severity === "error").length,
);
const preflightWarningCount = computed(() =>
  preflightIssues.value.filter((item) => item.severity === "warning").length,
);
const selectedElementIssues = computed(() =>
  selectedElement.value
    ? preflightIssues.value.filter((item) => item.elementId === selectedElement.value?.id)
    : [],
);
const selectedElementOverflowState = computed(() => {
  if (selectedElementIssues.value.some((item) => item.code.includes("overflow") && item.severity === "error")) return "error";
  if (selectedElementIssues.value.some((item) => item.code.includes("overflow"))) return "warning";
  return "none";
});
const applicationMenus = computed<ApplicationMenuDefinition[]>(() => {
  const hasSelection = Boolean(selectedElement.value || selectedLayerIds.value.length > 0);
  const textSelected =
    selectedElement.value?.type === "text" || selectedElement.value?.type === "month-text";
  return [
    {
      id: "file",
      label: "Файл",
      items: [
        { command: "new-project", label: "Новый проект", shortcut: "Ctrl+N" },
        { command: "open-project", label: "Открыть проект…", shortcut: "Ctrl+O" },
        { command: "save-project", label: "Сохранить", shortcut: "Ctrl+S" },
        { command: "save-as-project", label: "Сохранить как…", shortcut: "Ctrl+Shift+S" },
        { command: "download-project", label: "Скачать резервную копию…" },
        { command: "save-user-template", label: "Сохранить дизайн как шаблон…" },
        { command: "clone-year", label: "Создать копию для другого года…" },
        { separator: true },
        { command: "export-pdf", label: "Экспортировать печатный PDF…", shortcut: "Ctrl+E", disabled: pdfExportState.value === "exporting" },
      ],
    },
    {
      id: "edit",
      label: "Правка",
      items: [
        { command: "undo", label: "Отменить", shortcut: "Ctrl+Z", disabled: undoStack.value.length === 0 },
        { command: "redo", label: "Повторить", shortcut: "Ctrl+Y", disabled: redoStack.value.length === 0 },
        { separator: true },
        { command: "duplicate", label: "Дублировать", shortcut: "Ctrl+D", disabled: !selectedElement.value },
        { command: "delete", label: "Удалить", shortcut: "Delete", disabled: !hasSelection },
      ],
    },
    {
      id: "layout",
      label: "Макет",
      items: [
        { command: "apply-month-master", label: "Сделать выбранный месяц мастер-страницей", disabled: selectedPage.value.kind !== "month" },
        { separator: true },
        { command: "full-template", label: "Создать календарь: обложка + 12 месяцев" },
        { command: "add-cover", label: "Добавить обложку" },
        { command: "add-month", label: "Добавить страницу месяца" },
        { separator: true },
        { command: "delete-page", label: "Удалить текущую страницу", disabled: project.value.document.pages.length <= 1 },
      ],
    },
    {
      id: "object",
      label: "Объект",
      items: [
        { command: "bring-front", label: "На самый верх", disabled: !hasSelection },
        { command: "send-back", label: "На самый низ", disabled: !hasSelection },
        { command: "group", label: "Объединить слои в папку", disabled: selectedLayerIds.value.length < 2 },
        { separator: true },
        { command: "align-object-left", label: "Выровнять по левому краю", disabled: selectedLayerElements.value.length < 2 },
        { command: "align-object-center", label: "Выровнять по центру горизонтально", disabled: selectedLayerElements.value.length < 2 },
        { command: "align-object-right", label: "Выровнять по правому краю", disabled: selectedLayerElements.value.length < 2 },
        { command: "align-object-top", label: "Выровнять по верхнему краю", disabled: selectedLayerElements.value.length < 2 },
        { command: "align-object-middle", label: "Выровнять по центру вертикально", disabled: selectedLayerElements.value.length < 2 },
        { command: "align-object-bottom", label: "Выровнять по нижнему краю", disabled: selectedLayerElements.value.length < 2 },
        { command: "distribute-horizontal", label: "Распределить по горизонтали", disabled: selectedLayerElements.value.length < 3 },
        { command: "distribute-vertical", label: "Распределить по вертикали", disabled: selectedLayerElements.value.length < 3 },
        { separator: true },
        { command: "toggle-lock", label: "Блокировать / разблокировать", disabled: !hasSelection },
        { command: "toggle-visible", label: "Показать / скрыть", disabled: !hasSelection },
        { command: "duplicate", label: "Дублировать", disabled: !selectedElement.value },
        { command: "delete", label: "Удалить", disabled: !hasSelection },
      ],
    },
    {
      id: "text",
      label: "Текст",
      items: [
        { command: "bold", label: "Полужирный", checked: textSelected && (selectedElement.value?.type === "text" || selectedElement.value?.type === "month-text") ? (selectedElement.value.typography.fontWeight ?? 400) >= 600 : false, disabled: !textSelected },
        { command: "italic", label: "Курсив", checked: textSelected && (selectedElement.value?.type === "text" || selectedElement.value?.type === "month-text") ? selectedElement.value.typography.fontStyle === "italic" : false, disabled: !textSelected },
        { separator: true },
        { command: "align-left", label: "По левому краю", disabled: !textSelected },
        { command: "align-center", label: "По центру", disabled: !textSelected },
        { command: "align-right", label: "По правому краю", disabled: !textSelected },
      ],
    },
    {
      id: "view",
      label: "Вид",
      items: [
        { command: "toggle-guides", label: "Направляющие", checked: showGuides.value },
        { separator: true },
        { command: "zoom-in", label: "Увеличить", shortcut: "+" },
        { command: "zoom-out", label: "Уменьшить", shortcut: "−" },
        { command: "fit-page", label: "Страница целиком", shortcut: "Ctrl+0" },
      ],
    },
    {
      id: "window",
      label: "Окно",
      items: [
        { command: "toggle-tools", label: "Инструменты", checked: panelVisibility.value.tools },
        { separator: true },
        { command: "toggle-properties", label: "Свойства", checked: panelVisibility.value.properties },
        { command: "toggle-library", label: "Библиотека элементов", checked: panelVisibility.value.library },
        { command: "toggle-layers", label: "Слои", checked: panelVisibility.value.layers },
        { command: "toggle-pages", label: "Страницы", checked: panelVisibility.value.pages },
        { command: "toggle-events", label: "События монастыря", checked: panelVisibility.value.events },
        { command: "toggle-preflight", label: "Предпечатная проверка", checked: panelVisibility.value.preflight },
        { separator: true },
        { command: "toggle-all-panels", label: chromePanelsHidden.value ? "Показать все панели" : "Скрыть все панели", shortcut: "Tab" },
      ],
    },
    {
      id: "help",
      label: "Справка",
      items: [
        { command: "shortcuts", label: "Горячие клавиши" },
        { command: "about", label: "О программе" },
      ],
    },
  ];
});

function serializeEditableProject(): string {
  return JSON.stringify(createPersistentProjectSnapshot(project.value));
}

function mutateProject<T>(label: string, mutation: () => T): T {
  const before = serializeEditableProject();
  const result = mutation();
  const after = serializeEditableProject();
  if (before !== after) {
    undoStack.value.push({ snapshot: before, label, pageId: selectedPageId.value });
    if (undoStack.value.length > 40) undoStack.value.shift();
    redoStack.value = [];
  }
  return result;
}

function restoreProjectSnapshot(snapshot: string, pageId?: string): void {
  const restored = normalizeCalendarProject(JSON.parse(snapshot) as CalendarProject);
  project.value = restored;
  selectedPageId.value =
    restored.document.pages.find((page) => page.id === pageId)?.id ??
    restored.document.pages[0]?.id ??
    "";
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
}

function undo(): void {
  const entry = undoStack.value.pop();
  if (!entry) return;
  redoStack.value.push({ snapshot: serializeEditableProject(), label: entry.label, pageId: selectedPageId.value });
  restoreProjectSnapshot(entry.snapshot, entry.pageId);
  operationNotice.value = `Отменено: ${entry.label}`;
}

function redo(): void {
  const entry = redoStack.value.pop();
  if (!entry) return;
  undoStack.value.push({ snapshot: serializeEditableProject(), label: entry.label, pageId: selectedPageId.value });
  restoreProjectSnapshot(entry.snapshot, entry.pageId);
  operationNotice.value = `Повторено: ${entry.label}`;
}

function beginContinuousEdit(): void {
  continuousEditSnapshot = serializeEditableProject();
  continuousEditPageId = selectedPageId.value;
}

function endContinuousEdit(label = "Изменение геометрии"): void {
  const before = continuousEditSnapshot;
  const pageId = continuousEditPageId ?? selectedPageId.value;
  continuousEditSnapshot = undefined;
  continuousEditPageId = undefined;
  if (!before || before === serializeEditableProject()) return;
  undoStack.value.push({ snapshot: before, label, pageId });
  if (undoStack.value.length > 40) undoStack.value.shift();
  redoStack.value = [];
}

async function saveAutosaveNow(showNotice = false): Promise<void> {
  persistenceState.value = "saving";
  try {
    await saveAutosavedProject(project.value);
    persistenceState.value = "saved";
    if (showNotice) operationNotice.value = "Создана локальная копия для автовосстановления";
  } catch (error) {
    persistenceState.value = "error";
    operationNotice.value = `Ошибка сохранения: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function scheduleAutosave(): void {
  if (!persistenceReady) return;
  persistenceState.value = "saving";
  if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => void saveAutosaveNow(), 700);
}

async function initializeProject(): Promise<void> {
  try {
    const restored = await loadAutosavedProject();
    let savedPageId: string | undefined;
    let savedDockPanel: DockPanelId | undefined;
    try {
      const editorState = JSON.parse(localStorage.getItem(EDITOR_STATE_KEY) ?? "{}") as {
        pageId?: string;
        dockPanel?: DockPanelId;
        dockPanelWidthPx?: number;
        zoomPercent?: number;
        showGuides?: boolean;
        selectedTemplateId?: CalendarTemplateId;
        panelVisibility?: Partial<typeof panelVisibility.value>;
      };
      savedPageId = editorState.pageId;
      savedDockPanel = editorState.dockPanel;
      if (typeof editorState.zoomPercent === "number") zoomPercent.value = Math.min(100, Math.max(35, editorState.zoomPercent));
      if (typeof editorState.showGuides === "boolean") showGuides.value = editorState.showGuides;
      if (CALENDAR_TEMPLATE_PRESETS.some((preset) => preset.id === editorState.selectedTemplateId)) {
        selectedTemplateId.value = editorState.selectedTemplateId!;
      }
      if (editorState.panelVisibility) {
        for (const key of Object.keys(panelVisibility.value) as Array<keyof typeof panelVisibility.value>) {
          const stored = editorState.panelVisibility[key];
          if (typeof stored === "boolean") panelVisibility.value[key] = stored;
        }
      }
      if (typeof editorState.dockPanelWidthPx === "number" && Number.isFinite(editorState.dockPanelWidthPx)) {
        dockPanelWidthPx.value = clampDockPanelWidth(editorState.dockPanelWidthPx);
      }
    } catch {
      // A broken UI preference must never prevent the document from opening.
    }
    if (restored) {
      project.value = normalizeCalendarProject(restored);
      operationNotice.value = "Восстановлено последнее автосохранение";
      await registerProjectFonts(project.value);
    }
    selectedPageId.value =
      project.value.document.pages.find((page) => page.id === savedPageId)?.id ??
      project.value.document.pages.find((page) => page.id === selectedPageId.value)?.id ??
      project.value.document.pages[0]?.id ??
      "";
    if (savedDockPanel && dockPanels.some((panel) => panel.id === savedDockPanel)) {
      activeDockPanel.value = savedDockPanel;
    }
    [userProjectTemplates.value, userCalendarGridTemplates.value, projectBackups.value] = await Promise.all([
      listUserProjectTemplates(),
      listUserCalendarGridTemplates(),
      listProjectBackups(),
    ]);
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) ?? "[]") as unknown;
      recentProjectNames.value = Array.isArray(recent)
        ? recent.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [];
    } catch {
      recentProjectNames.value = [];
    }
    persistenceState.value = "saved";
  } catch (error) {
    persistenceState.value = "error";
    operationNotice.value = `Хранилище недоступно: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    persistenceReady = true;
  }
  await loadCalendarData();
}

function projectFileBlob(): Blob {
  return new Blob([JSON.stringify(createProjectArchive(project.value), null, 2)], {
    type: "application/vnd.orthodox-calendar-project+json",
  });
}

function suggestedProjectFileName(): string {
  return `${project.value.name.replace(/[^\p{L}\p{N}._-]+/gu, "-")}.kalendar`;
}

function rememberProjectName(name: string): void {
  recentProjectNames.value = [name, ...recentProjectNames.value.filter((item) => item !== name)].slice(0, 8);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recentProjectNames.value));
}

function downloadProjectFile(markAsCurrent = false): void {
  const blob = projectFileBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedProjectFileName();
  anchor.click();
  URL.revokeObjectURL(url);
  if (markAsCurrent) {
    projectFileName.value = anchor.download;
    savedProjectFileSnapshot.value = serializeEditableProject();
  }
  operationNotice.value = "Резервная копия отправлена в папку загрузок браузера";
}

function isPickerCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function writeProjectFile(handle: ProjectFileHandle): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(projectFileBlob());
  await writable.close();
  activeProjectFileHandle = handle;
  projectFileName.value = handle.name;
  savedProjectFileSnapshot.value = serializeEditableProject();
  rememberProjectName(handle.name);
  await saveProjectBackup(project.value, `Сохранение ${handle.name}`);
  projectBackups.value = await listProjectBackups();
  await saveAutosaveNow();
  operationNotice.value = `Проект сохранён в файл: ${handle.name}`;
}

async function saveProjectAs(): Promise<void> {
  const pickerWindow = window as ProjectPickerWindow;
  if (!pickerWindow.showSaveFilePicker) {
    downloadProjectFile(true);
    operationNotice.value = "Браузер не поддерживает выбор папки: файл сохранён в его папку загрузок";
    return;
  }
  try {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: suggestedProjectFileName(),
      types: [{
        description: "Проект календаря",
        accept: { "application/vnd.orthodox-calendar-project+json": [".kalendar"] },
      }],
    });
    await writeProjectFile(handle);
  } catch (error) {
    if (isPickerCancellation(error)) return;
    operationNotice.value = `Не удалось сохранить файл: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function saveProjectNow(): Promise<void> {
  if (!activeProjectFileHandle) {
    await saveProjectAs();
    return;
  }
  try {
    await writeProjectFile(activeProjectFileHandle);
  } catch (error) {
    operationNotice.value = `Не удалось сохранить файл: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPrintPdf(): Promise<void> {
  if (!displayedCalendarYear.value) {
    operationNotice.value = "PDF пока не создан: календарные данные ещё загружаются";
    return;
  }
  pdfExportState.value = "exporting";
  operationNotice.value = `Формируется PDF: ${project.value.document.pages.length} стр.`;
  try {
    const { exportCalendarProjectPdf, loadPdfFontFiles } = await import("./export/pdf-exporter");
    const fonts = await loadPdfFontFiles();
    const result = await exportCalendarProjectPdf(
      createPersistentProjectSnapshot(project.value),
      displayedCalendarYear.value,
      fonts,
    );
    const safeName = project.value.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const pdfBytes = Uint8Array.from(result.bytes);
    downloadBlob(new Blob([pdfBytes.buffer], { type: "application/pdf" }), `${safeName}-${project.value.year}-print.pdf`);
    pdfExportState.value = "ready";
    operationNotice.value = result.warnings.length
      ? `PDF создан; предпечатных предупреждений: ${result.warnings.length}`
      : "Печатный PDF создан без предупреждений";
  } catch (error) {
    pdfExportState.value = "error";
    operationNotice.value = `Ошибка PDF: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function selectPreflightIssue(item: PreflightIssue): void {
  selectPage(item.pageId);
  if (item.elementId) selectElement(item.elementId);
  operationNotice.value = item.message;
}

async function loadProjectFromFile(file: File, handle?: ProjectFileHandle): Promise<void> {
  await createRecoveryPoint(`Перед открытием ${file.name}`);
  const candidate: unknown = JSON.parse(await file.text());
  const loadedProject = parseProjectArchive(candidate);
  if (!loadedProject) throw new Error("Неподдерживаемый формат проекта");
  project.value = loadedProject;
  await registerProjectFonts(project.value);
  selectedPageId.value = project.value.document.pages[0]?.id ?? "";
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
  undoStack.value = [];
  redoStack.value = [];
  activeProjectFileHandle = handle;
  projectFileName.value = file.name;
  savedProjectFileSnapshot.value = serializeEditableProject();
  rememberProjectName(file.name);
  await loadCalendarData();
  await saveAutosaveNow();
  operationNotice.value = `Открыт файл проекта: ${file.name}`;
}

async function requestProjectFile(): Promise<void> {
  if (
    savedProjectFileSnapshot.value !== serializeEditableProject() &&
    project.value.document.pages.some((page) => page.elements.length > 0) &&
    !window.confirm("Открыть другой проект? Несохранённые в файл изменения текущего проекта будут потеряны.")
  ) return;
  const pickerWindow = window as ProjectPickerWindow;
  if (!pickerWindow.showOpenFilePicker) {
    projectFileInput.value?.click();
    return;
  }
  try {
    const [handle] = await pickerWindow.showOpenFilePicker({
      multiple: false,
      types: [{
        description: "Проект календаря",
        accept: { "application/vnd.orthodox-calendar-project+json": [".kalendar", ".json"] },
      }],
    });
    if (!handle) return;
    await loadProjectFromFile(await handle.getFile(), handle);
  } catch (error) {
    if (isPickerCancellation(error)) return;
    operationNotice.value = `Не удалось открыть проект: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function openProjectFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await loadProjectFromFile(file);
  } catch (error) {
    operationNotice.value = `Не удалось открыть проект: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    input.value = "";
  }
}

async function createRecoveryPoint(label: string): Promise<void> {
  try {
    await saveProjectBackup(project.value, label);
    projectBackups.value = await listProjectBackups();
  } catch {
    // A failed local backup is surfaced by autosave status, but must not trap
    // the user in the current project when they explicitly confirmed a switch.
  }
}

async function createNewProject(): Promise<void> {
  if (
    project.value.document.pages.some((page) => page.elements.length > 0) &&
    !window.confirm("Создать новый проект? Текущий проект будет закрыт. Если он ещё не сохранён в файл, сначала нажмите «Сохранить как…».")
  ) return;
  await createRecoveryPoint("Перед созданием нового проекта");
  project.value = createBlankCalendarProject(new Date().getFullYear() + 1);
  activeProjectFileHandle = undefined;
  projectFileName.value = undefined;
  savedProjectFileSnapshot.value = undefined;
  selectedPageId.value = project.value.document.pages[0]?.id ?? "";
  selectedElementId.value = undefined;
  selectedLayerIds.value = ["layer-1"];
  undoStack.value = [];
  redoStack.value = [];
  void loadCalendarData();
  operationNotice.value = "Создан новый проект";
}

function selectPage(pageId: string): void {
  selectedPageId.value = pageId;
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
}

async function applyFullCalendarTemplate(): Promise<void> {
  if (
    project.value.document.pages.some((page) => page.elements.length > 0) &&
    !window.confirm("Заменить все текущие страницы новой обложкой и 12 месяцами? Изменённые страницы будут удалены. После создания действие можно отменить через Ctrl+Z.")
  ) return;
  await createRecoveryPoint("Перед заменой страниц полным шаблоном");
  mutateProject("Создание полного календаря", () => {
    project.value.document.pages = createFullCalendarTemplate(
      selectedPage.value.formatId,
      selectedPage.value.orientation,
      project.value.year,
      project.value.publisherProfile.name,
      selectedTemplateId.value,
    );
  });
  const first = project.value.document.pages[0];
  if (first) selectPage(first.id);
  operationNotice.value = "Созданы обложка и 12 месячных страниц";
}

function addMonthTemplatePage(month = 1): void {
  const page = mutateProject("Добавление страницы месяца", () => {
    const created = createMonthTemplatePageWithPreset(
      selectedPage.value.formatId,
      selectedPage.value.orientation,
      month,
      project.value.year,
      selectedTemplateId.value,
    );
    project.value.document.pages.push(created);
    return created;
  });
  selectPage(page.id);
  operationNotice.value = `Добавлена страница: ${page.name}`;
}

function addCoverTemplatePage(): void {
  const page = mutateProject("Добавление обложки", () => {
    const created = createCoverTemplatePage(
      selectedPage.value.formatId,
      selectedPage.value.orientation,
      project.value.year,
      project.value.publisherProfile.name,
    );
    project.value.document.pages.unshift(created);
    return created;
  });
  selectPage(page.id);
  operationNotice.value = "Добавлен шаблон обложки";
}

function addMonasteryEvent(): void {
  const event: MonasteryEvent = {
    id: `monastery-event-${crypto.randomUUID()}`,
    title: "Новое событие монастыря",
    shortTitle: "Событие монастыря",
    dateRule: { type: "annual", month: 1, day: 1 },
    priority: 900,
    styleToken: "monastery-feast",
  };
  mutateProject("Добавление события монастыря", () => project.value.monasteryEvents.push(event));
  operationNotice.value = "Добавлено событие монастыря";
}

function removeMonasteryEvent(eventId: string): void {
  const index = project.value.monasteryEvents.findIndex((event) => event.id === eventId);
  if (index < 0) return;
  mutateProject("Удаление события монастыря", () => project.value.monasteryEvents.splice(index, 1));
  operationNotice.value = "Событие монастыря удалено";
}

function changeMonasteryEventRule(event: MonasteryEvent, type: "annual" | "once"): void {
  if (event.dateRule.type === type) return;
  mutateProject("Изменение типа события", () => {
    event.dateRule =
      type === "annual"
        ? { type: "annual", month: 1, day: 1 }
        : { type: "once", date: `${project.value.year}-01-01` };
  });
}

function deleteCurrentPage(): void {
  if (project.value.document.pages.length <= 1) {
    operationNotice.value = "В документе должна остаться хотя бы одна страница";
    return;
  }
  const currentIndex = selectedPageIndex.value;
  mutateProject("Удаление страницы", () => {
    project.value.document.pages.splice(currentIndex, 1);
  });
  const next = project.value.document.pages[Math.min(currentIndex, project.value.document.pages.length - 1)];
  if (next) selectPage(next.id);
  operationNotice.value = "Страница удалена";
}

async function loadCalendarData(): Promise<void> {
  calendarLoadState.value = "loading";
  const requestedYear = project.value.year;
  try {
    calendarRuntimePromise ??= Promise.all([
      import("./calendar/xml/parse-memory-days"),
      import("./calendar/engine/build-calendar-year"),
    ]).then(([parser, engine]) => ({
      parseMemoryDaysXml: parser.parseMemoryDaysXml,
      buildOrthodoxCalendarYear: engine.buildOrthodoxCalendarYear,
    }));
    calendarDatasetPromise ??= (async () => {
      const [response, runtime] = await Promise.all([
        fetch("/data/MemoryDays.xml"),
        calendarRuntimePromise!,
      ]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return runtime.parseMemoryDaysXml(await response.text());
    })().catch((error) => {
      calendarDatasetPromise = undefined;
      throw error;
    });
    const [dataset, runtime] = await Promise.all([calendarDatasetPromise, calendarRuntimePromise]);
    let year = calendarYearCache.get(requestedYear);
    if (!year) {
      year = runtime.buildOrthodoxCalendarYear(requestedYear, dataset);
      calendarYearCache.set(requestedYear, year);
      // Switching through many years must not grow memory without a bound.
      if (calendarYearCache.size > 3) {
        const oldestYear = calendarYearCache.keys().next().value as number | undefined;
        if (oldestYear !== undefined) calendarYearCache.delete(oldestYear);
      }
    }
    if (project.value.year !== requestedYear) return;
    calendarDataset.value = dataset;
    calendarYear.value = year;
    calendarLoadState.value = "ready";
    operationNotice.value = `Загружено ${dataset.statistics.recordCount} календарных записей`;
  } catch (error) {
    calendarLoadState.value = "error";
    operationNotice.value = `Ошибка календарных данных: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function updateFormat(formatId: PageFormatId): void {
  mutateProject("Изменение формата страницы", () =>
    changePageFormat(selectedPage.value, formatId, selectedPage.value.orientation),
  );
  operationNotice.value = `Формат страницы: ${formatId}`;
}

function updateOrientation(orientation: PageOrientation): void {
  mutateProject("Изменение ориентации страницы", () =>
    changePageFormat(selectedPage.value, selectedPage.value.formatId, orientation),
  );
  operationNotice.value = `Ориентация: ${orientation === "portrait" ? "книжная" : "альбомная"}`;
}

function updateProjectYear(event: Event): void {
  const value = Math.round(Number((event.target as HTMLInputElement).value));
  if (!Number.isInteger(value) || value < 1900 || value > 2200 || value === project.value.year) return;
  mutateProject("Изменение календарного года", () => {
    project.value.year = value;
  });
  void loadCalendarData();
  operationNotice.value = `Календарь пересчитан на ${value} год`;
}

function findLayer(layerId: string) {
  return findLayerLocation(selectedPage.value, layerId)?.node;
}

function addLayer(): void {
  const selected = findLayer(selectedLayerIds.value.at(-1) ?? "");
  const parentGroupId = selected?.kind === "group" ? selected.id : undefined;
  const layer = mutateProject("Добавление слоя", () =>
    createEmptyLayer(
      selectedPage.value,
      `layer-${crypto.randomUUID()}`,
      undefined,
      parentGroupId,
    ),
  );
  selectedLayerIds.value = [layer.id];
  operationNotice.value = parentGroupId ? "Слой добавлен в папку" : "Добавлен пустой слой";
}

function addLayerGroup(): void {
  const selected = findLayer(selectedLayerIds.value.at(-1) ?? "");
  const parentGroupId = selected?.kind === "group" ? selected.id : undefined;
  const group = mutateProject("Добавление папки слоёв", () =>
    createLayerGroup(
      selectedPage.value,
      `group-${crypto.randomUUID()}`,
      "Новая папка",
      parentGroupId,
    ),
  );
  selectedLayerIds.value = [group.id];
  operationNotice.value = "Добавлена папка слоёв";
}

function groupSelectedLayers(): void {
  try {
    const group = mutateProject("Группировка слоёв", () =>
      groupLayerNodes(
        selectedPage.value,
        selectedLayerIds.value,
        `group-${crypto.randomUUID()}`,
      ),
    );
    selectedLayerIds.value = [group.id];
    operationNotice.value = "Выбранные слои объединены в папку";
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось объединить слои";
  }
}

function selectLayer(nodeId: string, additive: boolean): void {
  if (!additive) {
    selectedLayerIds.value = [nodeId];
  } else {
    selectedLayerIds.value = selectedLayerIds.value.includes(nodeId)
      ? selectedLayerIds.value.filter((id) => id !== nodeId)
      : [...selectedLayerIds.value, nodeId];
  }
  const selectedNode = findLayer(nodeId);
  selectedElementId.value = selectedNode?.kind === "layer" ? selectedNode.elementId : undefined;
}

function moveLayer(
  sourceId: string,
  targetId: string,
  placement: "before" | "after" | "inside",
): void {
  try {
    mutateProject("Перемещение слоя", () =>
      moveLayerNode(selectedPage.value, sourceId, targetId, placement),
    );
    operationNotice.value = placement === "inside" ? "Слой перемещён в папку" : "Порядок слоёв изменён";
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось переместить слой";
  }
}

function renameLayer(layerId: string, name: string): void {
  const layer = findLayer(layerId);
  if (layer) mutateProject("Переименование слоя", () => (layer.name = name));
}

function deleteSelection(): void {
  const ids = selectedElement.value
    ? [selectedElement.value.layerId]
    : [...selectedLayerIds.value];
  if (ids.length === 0) return;
  try {
    let removedObjects = 0;
    mutateProject("Удаление выбранного", () => {
      for (const id of ids) removedObjects += removeLayerNode(selectedPage.value, id).length;
    });
    selectedLayerIds.value = [];
    selectedElementId.value = undefined;
    operationNotice.value = removedObjects
      ? `Удалено объектов: ${removedObjects}`
      : "Удалены выбранные пустые слои";
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось удалить выбранное";
  }
}

function moveSelectionToEdge(edge: "front" | "back"): void {
  const nodeId = selectedElement.value?.layerId ?? selectedLayerIds.value.at(-1);
  if (!nodeId) return;
  try {
    mutateProject(edge === "front" ? "На передний план" : "На задний план", () =>
      moveLayerNodeToEdge(selectedPage.value, nodeId, edge),
    );
    operationNotice.value = edge === "front" ? "Перемещено на самый верх" : "Перемещено на самый низ";
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось изменить порядок";
  }
}

function alignSelection(mode: AlignMode): void {
  if (selectedLayerElements.value.length < 2) return;
  mutateProject("Выравнивание объектов", () => alignElements(selectedLayerElements.value, mode));
  operationNotice.value = `Выровнено объектов: ${selectedLayerElements.value.length}`;
}

function distributeSelection(mode: DistributeMode): void {
  if (selectedLayerElements.value.length < 3) return;
  mutateProject("Распределение объектов", () => distributeElements(selectedLayerElements.value, mode));
  operationNotice.value = `Распределено объектов: ${selectedLayerElements.value.length}`;
}

function duplicateSelection(): void {
  const elementId = selectedElementId.value;
  if (!elementId) return;
  const duplicated = mutateProject("Дублирование объекта", () =>
    duplicateElementOnOwnLayer(selectedPage.value, elementId),
  );
  if (!duplicated) return;
  selectedElementId.value = duplicated.element.id;
  selectedLayerIds.value = [duplicated.layer.id];
  operationNotice.value = "Объект продублирован";
}

function createElement(tool: EditorTool, frame: ElementFrame): void {
  try {
    const created = mutateProject("Создание объекта", () =>
      createElementOnOwnLayer(selectedPage.value, tool, frame, {
        fillColor: currentFillColor.value,
        strokeColor: currentStrokeColor.value,
      }),
    );
    selectedLayerIds.value = [created.layer.id];
    selectedElementId.value = created.element.id;
    activeDockPanel.value = "properties";
    operationNotice.value =
      tool === "image"
        ? "Рамка изображения создана — выберите файл в свойствах"
        : `Создан объект «${created.layer.name}»`;
    if (tool === "image" || tool === "svg") {
      window.setTimeout(() => requestAssetFile(), 0);
    }
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось создать объект";
  }
}

function selectElement(elementId: string | undefined): void {
  selectedElementId.value = elementId;
  if (!elementId) return;
  const element = selectedPage.value.elements.find((item) => item.id === elementId);
  if (element) selectedLayerIds.value = [element.layerId];
}

function updateElementNumber(
  property: "x" | "y" | "width" | "height" | "rotation",
  event: Event,
): void {
  const element = selectedElement.value;
  const value = Number((event.target as HTMLInputElement).value);
  if (!element || !Number.isFinite(value)) return;
  element[property] = property === "width" || property === "height" ? Math.max(0.2, value) : value;
}

function updateElementGeometry(elementId: string, frame: ElementFrame): void {
  const element = selectedPage.value.elements.find((item) => item.id === elementId);
  if (!element) return;
  element.x = frame.x;
  element.y = frame.y;
  element.width = Math.max(0.2, frame.width);
  element.height = Math.max(0.2, frame.height);
  if (element.type === "month-text") element.placement = "fixed-frame";
  if (element.type === "shape" && element.shape === "line" && frame.lineDirection) {
    element.lineDirection = frame.lineDirection;
  }
}

function updateWeekdayLabel(element: CalendarGridElement, index: number, value: string): void {
  const defaults = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const labels = Array.from(
    { length: 7 },
    (_, itemIndex) => element.customWeekdayLabels?.[itemIndex] ?? defaults[itemIndex] ?? "",
  ) as [string, string, string, string, string, string, string];
  labels[index] = value;
  element.customWeekdayLabels = labels;
}

function updateCommemorationPreset(element: CalendarGridElement, value: string): void {
  if (value === "custom") {
    element.commemorationDetail = "custom";
    return;
  }
  if (value !== "main" && value !== "standard" && value !== "full") return;
  mutateProject("Состав памятей календаря", () => {
    element.commemorationDetail = value;
    element.commemorationFilter = { ...COMMEMORATION_FILTER_PRESETS[value] };
  });
}

function commemorationFilterEnabled(
  element: CalendarGridElement,
  rank: CommemorationRankFilterId,
): boolean {
  return commemorationFilterForElement(element)[rank];
}

function updateCommemorationFilter(
  element: CalendarGridElement,
  rank: CommemorationRankFilterId,
  checked: boolean,
): void {
  mutateProject("Фильтр памятей календаря", () => {
    element.commemorationFilter = {
      ...commemorationFilterForElement(element),
      [rank]: checked,
    };
    element.commemorationDetail = "custom";
  });
}

function applyGridPresentationToAllMonths(): void {
  const source = selectedElement.value;
  if (!source || source.type !== "calendar-grid") return;
  let updated = 0;
  mutateProject("Оформление календарных сеток", () => {
    for (const page of project.value.document.pages) {
      if (page.kind !== "month") continue;
      for (const element of page.elements) {
        if (element.type !== "calendar-grid" || element.id === source.id) continue;
        copyCalendarGridPresentation(source, element);
        updated += 1;
      }
    }
  });
  operationNotice.value = updated > 0
    ? `Оформление сетки применено ещё к ${updated} мес.`
    : "Других месячных сеток в документе нет";
}

async function saveSelectedGridAsTemplate(): Promise<void> {
  const grid = selectedElement.value;
  if (!grid || grid.type !== "calendar-grid") {
    operationNotice.value = "Сначала выберите календарную сетку";
    return;
  }
  const name = window.prompt("Название шаблона календарной сетки", "Моя календарная сетка");
  if (!name?.trim()) return;
  const saved = await saveUserCalendarGridTemplate(name.trim(), grid);
  userCalendarGridTemplates.value = [saved, ...userCalendarGridTemplates.value];
  operationNotice.value = `Шаблон сетки «${saved.name}» сохранён`;
}

function applyCalendarGridTemplate(template: UserCalendarGridTemplate, allMonths: boolean): void {
  const selectedGrid = selectedElement.value?.type === "calendar-grid" ? selectedElement.value : undefined;
  if (!allMonths && !selectedGrid) {
    operationNotice.value = "Сначала выберите календарную сетку месяца";
    return;
  }
  let updated = 0;
  mutateProject(allMonths ? "Шаблон сетки для всех месяцев" : "Шаблон календарной сетки", () => {
    for (const page of project.value.document.pages) {
      if (page.kind !== "month") continue;
      for (const grid of page.elements) {
        if (grid.type !== "calendar-grid") continue;
        if (!allMonths && grid.id !== selectedGrid?.id) continue;
        copyCalendarGridPresentation(template.grid, grid);
        updated += 1;
      }
    }
  });
  operationNotice.value = allMonths
    ? `Шаблон «${template.name}» применён к ${updated} месяцам`
    : `Шаблон «${template.name}» применён к выбранной сетке`;
}

async function removeCalendarGridTemplate(template: UserCalendarGridTemplate): Promise<void> {
  if (!window.confirm(`Удалить шаблон сетки «${template.name}»?`)) return;
  await deleteUserCalendarGridTemplate(template.id);
  userCalendarGridTemplates.value = userCalendarGridTemplates.value.filter((item) => item.id !== template.id);
  operationNotice.value = `Шаблон сетки «${template.name}» удалён`;
}

function applySelectedMonthAsMaster(): void {
  if (selectedPage.value.kind !== "month") {
    operationNotice.value = "Сначала выберите страницу месяца";
    return;
  }
  const summary = describeMonthMasterApplication(project.value, selectedPage.value.id);
  if (!window.confirm(`${summary}\n\nПрименить мастер-страницу?`)) return;
  const result = mutateProject("Применение мастер-страницы", () =>
    applyMonthMaster(project.value, selectedPage.value.id),
  );
  operationNotice.value = `Мастер применён к ${result.changedPages} страницам; сохранено назначений фотографий: ${result.preservedImages}`;
}

async function saveCurrentDesignAsTemplate(): Promise<void> {
  const name = window.prompt("Название пользовательского шаблона", `${project.value.name} — дизайн`);
  if (!name?.trim()) return;
  const saved = await saveUserProjectTemplate(name.trim(), project.value);
  userProjectTemplates.value = [saved, ...userProjectTemplates.value];
  operationNotice.value = `Шаблон «${saved.name}» сохранён локально`;
}

function applyUserProjectTemplate(template: UserProjectTemplate): void {
  if (!window.confirm(`Применить шаблон «${template.name}» ко всему документу? Текущие страницы будут заменены; действие можно отменить.`)) return;
  const current = project.value;
  const prepared = cloneProjectForYear(template.project, current.year);
  mutateProject("Применение пользовательского шаблона", () => {
    project.value = {
      ...prepared,
      id: current.id,
      name: current.name,
      publisherProfile: current.publisherProfile,
      monasteryEvents: current.monasteryEvents,
      assets: [...prepared.assets, ...current.assets.filter((asset) => !prepared.assets.some((item) => item.id === asset.id))],
      customFonts: [
        ...(prepared.customFonts ?? []),
        ...(current.customFonts ?? []).filter((font) => !(prepared.customFonts ?? []).some((item) => item.assetId === font.assetId)),
      ],
    };
  });
  selectedPageId.value = project.value.document.pages[0]?.id ?? "";
  void registerProjectFonts(project.value);
  operationNotice.value = `Применён шаблон «${template.name}»`;
}

async function removeUserProjectTemplate(template: UserProjectTemplate): Promise<void> {
  if (!window.confirm(`Удалить шаблон «${template.name}»?`)) return;
  await deleteUserProjectTemplate(template.id);
  userProjectTemplates.value = userProjectTemplates.value.filter((item) => item.id !== template.id);
  operationNotice.value = `Шаблон «${template.name}» удалён`;
}

function cloneCurrentProjectToYear(): void {
  const answer = window.prompt("Год для копии проекта", String(project.value.year + 1));
  if (answer === null) return;
  const year = Math.round(Number(answer));
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    operationNotice.value = "Введите год от 1900 до 2200";
    return;
  }
  void saveProjectBackup(project.value, `Перед созданием копии на ${year} год`).then(async () => {
    projectBackups.value = await listProjectBackups();
  });
  project.value = normalizeCalendarProject(cloneProjectForYear(project.value, year));
  activeProjectFileHandle = undefined;
  projectFileName.value = undefined;
  savedProjectFileSnapshot.value = undefined;
  undoStack.value = [];
  redoStack.value = [];
  selectedPageId.value = project.value.document.pages[0]?.id ?? "";
  void registerProjectFonts(project.value);
  void loadCalendarData();
  operationNotice.value = `Создана независимая копия проекта на ${year} год; выберите «Сохранить как…»`;
}

function restoreProjectBackup(backup: ProjectBackup): void {
  if (!window.confirm(`Восстановить резервную копию «${backup.label}» от ${new Date(backup.createdAt).toLocaleString("ru-RU")}?`)) return;
  mutateProject("Восстановление резервной копии", () => {
    project.value = normalizeCalendarProject(createPersistentProjectSnapshot(backup.project));
  });
  activeProjectFileHandle = undefined;
  projectFileName.value = undefined;
  savedProjectFileSnapshot.value = undefined;
  selectedPageId.value = project.value.document.pages[0]?.id ?? "";
  void registerProjectFonts(project.value);
  void loadCalendarData();
  operationNotice.value = `Восстановлена копия «${backup.label}»; сохраните её в новый файл`;
}

function formatBackupTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function placeSelectedLegend(edge: "top" | "bottom"): void {
  const element = selectedElement.value;
  if (!element || element.type !== "legend") return;
  mutateProject("Размещение легенды", () => {
    element.x = selectedPage.value.safeArea.left;
    element.width = selectedPage.value.width - selectedPage.value.safeArea.left - selectedPage.value.safeArea.right;
    element.y = edge === "top"
      ? selectedPage.value.safeArea.top
      : selectedPage.value.height - selectedPage.value.safeArea.bottom - element.height;
  });
  operationNotice.value = edge === "top" ? "Легенда размещена сверху" : "Легенда размещена снизу";
}

function requestAssetFile(): void {
  assetFileInput.value?.click();
}

function requestCustomFontFile(): void {
  fontFileInput.value?.click();
}

function requestIccProfileFile(): void {
  iccProfileFileInput.value?.click();
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Ошибка чтения файла")));
    reader.readAsDataURL(file);
  });
}

async function registerProjectFonts(targetProject: CalendarProject = project.value): Promise<void> {
  if (!("fonts" in document) || typeof FontFace === "undefined") return;
  for (const face of targetProject.customFonts ?? []) {
    const asset = targetProject.assets.find((item) => item.id === face.assetId && item.kind === "font");
    if (!asset) continue;
    try {
      const loaded = await new FontFace(face.family, `url(${JSON.stringify(asset.source)})`, {
        style: face.fontStyle,
        weight: String(face.fontWeight),
      }).load();
      document.fonts.add(loaded);
    } catch {
      // Preflight reports an unavailable font; one bad custom face must not
      // prevent the rest of the project from opening.
    }
  }
}

async function importCustomFont(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const suggested = file.name.replace(/\.(?:ttf|otf|woff2?)$/iu, "").replace(/[-_]+/gu, " ").trim();
    const family = window.prompt("Название семейства шрифта", suggested);
    if (!family?.trim()) return;
    const source = await readFileAsDataUrl(file);
    const assetId = `asset-font-${crypto.randomUUID()}`;
    mutateProject("Добавление шрифта проекта", () => {
      project.value.assets.push({
        id: assetId,
        name: file.name,
        mimeType: file.type || "font/ttf",
        source,
        kind: "font",
      });
      project.value.customFonts ??= [];
      project.value.customFonts.push({
        assetId,
        family: family.trim(),
        fontWeight: 400,
        fontStyle: "normal",
      });
    });
    await registerProjectFonts();
    operationNotice.value = `Шрифт «${family.trim()}» встроен в проект`;
  } finally {
    input.value = "";
  }
}

async function importIccProfile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const source = await readFileAsDataUrl(file);
    const assetId = `asset-icc-${crypto.randomUUID()}`;
    mutateProject("Профиль типографии", () => {
      project.value.assets.push({
        id: assetId,
        name: file.name,
        mimeType: file.type || "application/vnd.iccprofile",
        source,
        kind: "icc-profile",
      });
      project.value.printSettings ??= { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
      project.value.printSettings.iccProfileAssetId = assetId;
      project.value.printSettings.colorProfile = "CMYK-custom";
      project.value.printSettings.pdfStandard = "PDF/X-4";
      project.value.printSettings.outputConditionName = file.name.replace(/\.(?:icc|icm)$/iu, "");
    });
    operationNotice.value = `ICC-профиль «${file.name}» встроен; включён PDF/X-4`;
  } finally {
    input.value = "";
  }
}

function removeProjectFont(assetId: string): void {
  mutateProject("Удаление шрифта проекта", () => {
    project.value.customFonts = (project.value.customFonts ?? []).filter((font) => font.assetId !== assetId);
    project.value.assets = project.value.assets.filter((asset) => asset.id !== assetId);
  });
}

function frameForDecor(item: DecorLibraryItem): ElementFrame {
  const page = selectedPage.value;
  const usableWidth = page.width - page.safeArea.left - page.safeArea.right;
  const usableHeight = page.height - page.safeArea.top - page.safeArea.bottom;
  const limits = item.category === "frames"
    ? { width: usableWidth * 0.78, height: usableHeight * 0.78 }
    : item.category === "dividers"
      ? { width: usableWidth * 0.62, height: Math.min(usableHeight * 0.16, 42) }
      : item.category === "corners"
        ? { width: Math.min(usableWidth * 0.3, 62), height: Math.min(usableHeight * 0.3, 62) }
        : item.category === "religious"
          ? { width: Math.min(usableWidth * 0.34, 72), height: Math.min(usableHeight * 0.34, 88) }
          : item.category === "symbols"
            ? { width: Math.min(usableWidth * 0.18, 38), height: Math.min(usableHeight * 0.18, 45) }
            : { width: Math.min(usableWidth * 0.34, 72), height: Math.min(usableHeight * 0.3, 68) };
  let width = limits.width;
  let height = width / item.aspectRatio;
  if (height > limits.height) {
    height = limits.height;
    width = height * item.aspectRatio;
  }
  return {
    x: page.safeArea.left + (usableWidth - width) / 2,
    y: page.safeArea.top + (usableHeight - height) / 2,
    width,
    height,
  };
}

async function loadDecorMarkup(item: DecorLibraryItem): Promise<string> {
  const response = await fetch(item.source);
  if (!response.ok) throw new Error(`Не удалось прочитать ${item.label}`);
  return response.text();
}

async function insertDecorLibraryItem(item: DecorLibraryItem): Promise<void> {
  try {
    const color = currentStrokeColor.value;
    const markup = recolorSvgMarkup(await loadDecorMarkup(item), color);
    const asset = {
      id: `asset-decor-${crypto.randomUUID()}`,
      name: `${item.label}.svg`,
      mimeType: "image/svg+xml",
      source: svgMarkupDataUrl(markup),
      kind: "svg" as const,
    };
    const created = mutateProject("Вставка элемента из библиотеки", () => {
      project.value.assets.push(asset);
      const result = createElementOnOwnLayer(selectedPage.value, "svg", frameForDecor(item));
      result.layer.name = item.label;
      const element = result.element as SvgElement;
      element.assetId = asset.id;
      element.libraryItemId = item.id;
      element.decorColor = color;
      return result;
    });
    selectedLayerIds.value = [created.layer.id];
    selectedElementId.value = created.element.id;
    activeTool.value = "selection";
    activeDockPanel.value = "properties";
    operationNotice.value = `Добавлен элемент «${item.label}» на новый верхний слой`;
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось добавить элемент";
  }
}

async function setSelectedDecorColor(color: string): Promise<void> {
  const element = selectedElement.value;
  if (!element || element.type !== "svg" || !element.libraryItemId) return;
  const item = decorLibraryItems.find((candidate) => candidate.id === element.libraryItemId);
  if (!item) return;
  const elementId = element.id;
  try {
    const markup = recolorSvgMarkup(await loadDecorMarkup(item), color);
    const current = selectedPage.value.elements.find(
      (candidate): candidate is SvgElement => candidate.id === elementId && candidate.type === "svg",
    );
    if (!current) return;
    const asset = project.value.assets.find((candidate) => candidate.id === current.assetId);
    if (!asset) return;
    mutateProject("Цвет элемента декора", () => {
      asset.source = svgMarkupDataUrl(markup);
      current.decorColor = color;
    });
    currentStrokeColor.value = color;
    operationNotice.value = `Цвет элемента «${item.label}» изменён`;
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось изменить цвет";
  }
}

async function updateSelectedDecorColor(event: Event): Promise<void> {
  await setSelectedDecorColor((event.target as HTMLInputElement).value);
}

async function importSelectedAsset(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const element = selectedElement.value;
  if (!file || !element || (element.type !== "image" && element.type !== "svg")) return;
  const source = await readFileAsDataUrl(file);
  const dimensions = element.type === "image" && !/svg/i.test(file.type)
    ? await readRasterDimensions(source)
    : undefined;
  const asset = {
    id: `asset-${crypto.randomUUID()}`,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    source,
    kind: element.type === "svg" ? ("svg" as const) : ("image" as const),
    ...dimensions,
  };
  mutateProject("Помещение файла", () => {
    project.value.assets.push(asset);
    element.assetId = asset.id;
    if (element.type === "svg") {
      element.libraryItemId = undefined;
      element.decorColor = undefined;
    }
  });
  operationNotice.value = `Помещён файл: ${file.name}`;
  input.value = "";
}

function readRasterDimensions(source: string): Promise<{ widthPx: number; heightPx: number } | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve({ widthPx: image.naturalWidth, heightPx: image.naturalHeight }));
    image.addEventListener("error", () => resolve(undefined));
    image.src = source;
  });
}

function selectedAssetInfo(): string | undefined {
  const element = selectedElement.value;
  if (!element || (element.type !== "image" && element.type !== "svg") || !element.assetId) return undefined;
  const asset = project.value.assets.find((item) => item.id === element.assetId);
  if (!asset) return undefined;
  if (!asset.widthPx || !asset.heightPx || element.type !== "image") return asset.name;
  const dpi = Math.min(
    asset.widthPx / (element.width / 25.4),
    asset.heightPx / (element.height / 25.4),
  );
  return `${asset.name} · ${asset.widthPx} × ${asset.heightPx} px · ~${Math.round(dpi)} dpi`;
}

function requestFoodMarkerFile(rule: FoodRuleId): void {
  pendingFoodMarkerRule.value = rule;
  foodMarkerFileInput.value?.click();
}

async function importFoodMarkerAsset(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const rule = pendingFoodMarkerRule.value;
  if (!file || !rule) return;
  try {
    const source = await readFileAsDataUrl(file);
    const asset = {
      id: `asset-food-${crypto.randomUUID()}`,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      source,
      kind: "image" as const,
    };
    mutateProject("Изображение обозначения пищи", () => {
      project.value.assets.push(asset);
      project.value.foodMarkerAssets ??= {};
      project.value.foodMarkerAssets[rule] = asset.id;
    });
    operationNotice.value = `Изображение «${FOOD_RULES[rule].label}» загружено`;
  } catch (error) {
    operationNotice.value = `Не удалось загрузить изображение: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    pendingFoodMarkerRule.value = undefined;
    input.value = "";
  }
}

function foodMarkerAssetName(rule: FoodRuleId): string {
  const assetId = project.value.foodMarkerAssets?.[rule];
  const customAsset = project.value.assets.find((asset) => asset.id === assetId);
  if (customAsset) return `свой файл: ${customAsset.name}`;
  return `набор: ${getFoodMarkerPack(project.value.foodMarkerPackId).label}`;
}

function foodMarkerPreviewSource(rule: FoodRuleId): string {
  const assetId = project.value.foodMarkerAssets?.[rule];
  const customAsset = project.value.assets.find((asset) => asset.id === assetId);
  return customAsset?.source ?? foodMarkerPackSource(project.value.foodMarkerPackId, rule);
}

function hasCustomFoodMarker(rule: FoodRuleId): boolean {
  const assetId = project.value.foodMarkerAssets?.[rule];
  return Boolean(assetId && project.value.assets.some((asset) => asset.id === assetId));
}

function clearFoodMarkerAsset(rule: FoodRuleId): void {
  if (!project.value.foodMarkerAssets?.[rule]) return;
  mutateProject("Вернуть знак из набора", () => {
    delete project.value.foodMarkerAssets?.[rule];
  });
}

function updateFoodMarkerPack(value: string): void {
  if (!isFoodMarkerPackId(value)) return;
  mutateProject("Сменить набор знаков", () => {
    project.value.foodMarkerPackId = value;
  });
}

function clampDockPanelWidth(width: number): number {
  return Math.round(Math.min(
    dockPanelMaximumWidthPx.value,
    Math.max(DOCK_PANEL_MIN_WIDTH_PX, width),
  ));
}

function moveDockPanelResize(event: PointerEvent): void {
  if (event.pointerId !== dockResizePointerId) return;
  dockPanelWidthPx.value = clampDockPanelWidth(
    dockResizeStartWidth + dockResizeStartX - event.clientX,
  );
}

function stopDockPanelResize(event?: PointerEvent): void {
  if (event && event.pointerId !== dockResizePointerId) return;
  dockResizePointerId = undefined;
  dockPanelResizing.value = false;
  window.removeEventListener("pointermove", moveDockPanelResize);
  window.removeEventListener("pointerup", stopDockPanelResize);
  window.removeEventListener("pointercancel", stopDockPanelResize);
}

function startDockPanelResize(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  stopDockPanelResize();
  dockResizePointerId = event.pointerId;
  dockResizeStartX = event.clientX;
  dockResizeStartWidth = dockPanelWidthPx.value;
  dockPanelResizing.value = true;
  window.addEventListener("pointermove", moveDockPanelResize);
  window.addEventListener("pointerup", stopDockPanelResize);
  window.addEventListener("pointercancel", stopDockPanelResize);
}

function resizeDockPanelWithKeyboard(event: KeyboardEvent): void {
  const step = event.shiftKey ? 64 : 16;
  let width = dockPanelWidthPx.value;
  if (event.key === "ArrowLeft") width += step;
  else if (event.key === "ArrowRight") width -= step;
  else if (event.key === "Home") width = DOCK_PANEL_MIN_WIDTH_PX;
  else if (event.key === "End") width = dockPanelMaximumWidthPx.value;
  else return;
  event.preventDefault();
  dockPanelWidthPx.value = clampDockPanelWidth(width);
}

function resetDockPanelWidth(): void {
  dockPanelWidthPx.value = clampDockPanelWidth(DOCK_PANEL_DEFAULT_WIDTH_PX);
}

function handleViewportResize(): void {
  viewportWidthPx.value = window.innerWidth;
  dockPanelWidthPx.value = clampDockPanelWidth(dockPanelWidthPx.value);
}

function activateDockPanel(panelId: DockPanelId): void {
  panelVisibility.value[panelId] = true;
  activeDockPanel.value = panelId;
  chromePanelsHidden.value = false;
}

function toggleDockPanel(panelId: DockPanelId): void {
  panelVisibility.value[panelId] = !panelVisibility.value[panelId];
  if (panelVisibility.value[panelId]) {
    activeDockPanel.value = panelId;
    chromePanelsHidden.value = false;
    return;
  }
  if (activeDockPanel.value === panelId) {
    const next = visibleDockPanels.value[0];
    if (next) activeDockPanel.value = next.id;
  }
}

function toggleToolsPanel(): void {
  panelVisibility.value.tools = !panelVisibility.value.tools;
  if (panelVisibility.value.tools) chromePanelsHidden.value = false;
}

function toggleAllPanels(): void {
  chromePanelsHidden.value = !chromePanelsHidden.value;
  operationNotice.value = chromePanelsHidden.value
    ? "Панели скрыты — Tab для возврата"
    : "Панели показаны";
}

function toggleSelectedLayerProperty(property: "locked" | "visible"): void {
  const nodeId = selectedElement.value?.layerId ?? selectedLayerIds.value.at(-1);
  const node = nodeId ? findLayer(nodeId) : undefined;
  if (!node) return;
  mutateProject(property === "locked" ? "Блокировка слоя" : "Видимость слоя", () => {
    node[property] = !node[property];
  });
}

function updateSelectedText(command: "bold" | "italic" | "align-left" | "align-center" | "align-right"): void {
  const element = selectedElement.value;
  if (!element || (element.type !== "text" && element.type !== "month-text")) return;
  mutateProject("Форматирование текста", () => {
    if (command === "bold") {
      element.typography.fontWeight = (element.typography.fontWeight ?? 400) >= 600 ? 400 : 700;
    } else if (command === "italic") {
      element.typography.fontStyle = element.typography.fontStyle === "italic" ? "normal" : "italic";
    } else {
      element.typography.align = command.replace("align-", "") as "left" | "center" | "right";
    }
  });
}

function toggleApplicationMenu(menuId: ApplicationMenuId): void {
  activeMenu.value = activeMenu.value === menuId ? undefined : menuId;
}

function executeMenuCommand(command: MenuCommandId | undefined): void {
  activeMenu.value = undefined;
  if (!command) return;
  switch (command) {
    case "new-project": void createNewProject(); break;
    case "open-project": void requestProjectFile(); break;
    case "save-project": void saveProjectNow(); break;
    case "save-as-project": void saveProjectAs(); break;
    case "download-project": downloadProjectFile(); break;
    case "save-user-template": void saveCurrentDesignAsTemplate(); break;
    case "clone-year": cloneCurrentProjectToYear(); break;
    case "export-pdf": void exportPrintPdf(); break;
    case "undo": undo(); break;
    case "redo": redo(); break;
    case "duplicate": duplicateSelection(); break;
    case "delete": deleteSelection(); break;
    case "full-template": applyFullCalendarTemplate(); break;
    case "add-cover": addCoverTemplatePage(); break;
    case "add-month": addMonthTemplatePage(selectedElement.value?.type === "calendar-grid" ? selectedElement.value.month : 1); break;
    case "delete-page": deleteCurrentPage(); break;
    case "apply-month-master": applySelectedMonthAsMaster(); break;
    case "bring-front": moveSelectionToEdge("front"); break;
    case "send-back": moveSelectionToEdge("back"); break;
    case "group": groupSelectedLayers(); break;
    case "align-object-left": alignSelection("left"); break;
    case "align-object-center": alignSelection("horizontal-center"); break;
    case "align-object-right": alignSelection("right"); break;
    case "align-object-top": alignSelection("top"); break;
    case "align-object-middle": alignSelection("vertical-center"); break;
    case "align-object-bottom": alignSelection("bottom"); break;
    case "distribute-horizontal": distributeSelection("horizontal"); break;
    case "distribute-vertical": distributeSelection("vertical"); break;
    case "toggle-lock": toggleSelectedLayerProperty("locked"); break;
    case "toggle-visible": toggleSelectedLayerProperty("visible"); break;
    case "bold":
    case "italic":
    case "align-left":
    case "align-center":
    case "align-right": updateSelectedText(command); break;
    case "toggle-guides": showGuides.value = !showGuides.value; break;
    case "zoom-in": zoomPercent.value = Math.min(200, zoomPercent.value + 10); break;
    case "zoom-out": zoomPercent.value = Math.max(15, zoomPercent.value - 10); break;
    case "fit-page": zoomPercent.value = 55; break;
    case "toggle-tools": toggleToolsPanel(); break;
    case "toggle-properties": toggleDockPanel("properties"); break;
    case "toggle-library": toggleDockPanel("library"); break;
    case "toggle-layers": toggleDockPanel("layers"); break;
    case "toggle-pages": toggleDockPanel("pages"); break;
    case "toggle-events": toggleDockPanel("events"); break;
    case "toggle-preflight": toggleDockPanel("preflight"); break;
    case "toggle-all-panels": toggleAllPanels(); break;
    case "shortcuts": operationNotice.value = "V выделение · T текст · F изображение · M прямоугольник · Delete удалить · Ctrl+Z отменить · Tab панели"; break;
    case "about": operationNotice.value = "Календарная мастерская — издательский редактор православного календаря"; break;
  }
}

function selectTool(tool: EditorTool): void {
  activeTool.value = tool;
  const labels: Record<EditorTool, string> = {
    selection: "Выделение",
    text: "Текстовый блок",
    image: "Изображение",
    rectangle: "Прямоугольник",
    ellipse: "Эллипс",
    line: "Линия",
    svg: "SVG и декор",
    "calendar-grid": "Календарная сетка",
    hand: "Рука",
    zoom: "Масштаб",
  };
  operationNotice.value = `Инструмент: ${labels[tool]}`;
}

function updateFillColor(color: string): void {
  currentFillColor.value = color;
  const element = selectedElement.value;
  if (!element) return;
  mutateProject("Изменение заливки", () => {
    if (element.type === "text" || element.type === "month-text") {
      element.typography.color = color;
    } else if (element.type === "shape" && element.shape !== "line") {
      element.fillColor = color;
      element.fillGradient = undefined;
    }
  });
}

function supportsElementOpacity(element: typeof selectedElement.value): boolean {
  return element?.type === "text" || element?.type === "month-text" ||
    element?.type === "image" || element?.type === "svg" || element?.type === "shape";
}

function elementOpacityPercent(element: typeof selectedElement.value): number {
  return Math.round(normalizedOpacity(element?.opacity) * 100);
}

function updateSelectedOpacity(event: Event): void {
  const element = selectedElement.value;
  const value = Number((event.target as HTMLInputElement).value);
  if (!element || !supportsElementOpacity(element) || !Number.isFinite(value)) return;
  element.opacity = Math.max(0, Math.min(100, value)) / 100;
}

function updateSelectedShapeFillMode(event: Event): void {
  const element = selectedElement.value;
  if (!element || element.type !== "shape" || element.shape === "line") return;
  const mode = (event.target as HTMLSelectElement).value;
  element.fillGradient = mode === "gradient"
    ? createLinearGradient(element.fillColor ?? currentFillColor.value)
    : undefined;
}

async function applyGoldPaint(): Promise<void> {
  currentFillColor.value = PRINT_GOLD_COLOR;
  const element = selectedElement.value;
  if (!element) {
    operationNotice.value = "Золотой цвет выбран для новых объектов";
    return;
  }
  if (element.type === "svg" && element.libraryItemId) {
    await setSelectedDecorColor(PRINT_GOLD_COLOR);
    return;
  }
  mutateProject("Золотой цвет", () => {
    if (element.type === "text" || element.type === "month-text") {
      element.typography.color = PRINT_GOLD_COLOR;
    } else if (element.type === "shape") {
      if (element.shape === "line") {
        element.strokeColor = PRINT_GOLD_COLOR;
      } else {
        element.fillColor = PRINT_GOLD_COLOR;
        element.fillGradient = createGoldGradient();
      }
    }
  });
  operationNotice.value = element.type === "shape" && element.shape !== "line"
    ? "Применён золотой металлический градиент"
    : "Применён золотой цвет";
}

function updateStrokeColor(color: string): void {
  currentStrokeColor.value = color;
  const element = selectedElement.value;
  if (!element || element.type !== "shape") return;
  mutateProject("Изменение обводки", () => {
    element.strokeColor = color;
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (savedProjectFileSnapshot.value === serializeEditableProject()) return;
  event.preventDefault();
  event.returnValue = "";
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    activeMenu.value = undefined;
    return;
  }
  if (isTypingTarget(event.target)) return;
  if (event.key === "Tab") {
    event.preventDefault();
    toggleAllPanels();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelection();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateSelection();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (event.shiftKey) void saveProjectAs();
    else void saveProjectNow();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
    event.preventDefault();
    void requestProjectFile();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNewProject();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
    event.preventDefault();
    void exportPrintPdf();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "0") {
    event.preventDefault();
    zoomPercent.value = 55;
    return;
  }
  if (selectedElement.value && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    mutateProject("Перемещение с клавиатуры", () => {
      if (event.key === "ArrowLeft") selectedElement.value!.x -= step;
      if (event.key === "ArrowRight") selectedElement.value!.x += step;
      if (event.key === "ArrowUp") selectedElement.value!.y -= step;
      if (event.key === "ArrowDown") selectedElement.value!.y += step;
    });
    return;
  }
  const shortcuts: Partial<Record<string, EditorTool>> = {
    v: "selection",
    t: "text",
    f: "image",
    m: "rectangle",
    l: "ellipse",
    h: "hand",
    z: "zoom",
  };
  const tool = shortcuts[event.key.toLowerCase()];
  if (tool && !event.ctrlKey && !event.metaKey && !event.altKey) selectTool(tool);
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("resize", handleViewportResize);
  void initializeProject();
});
watch(project, scheduleAutosave, { deep: true });
watch(dockPanelMaximumWidthPx, () => {
  dockPanelWidthPx.value = clampDockPanelWidth(dockPanelWidthPx.value);
});
watch(
  [selectedPageId, activeDockPanel, dockPanelWidthPx, zoomPercent, showGuides, selectedTemplateId, panelVisibility],
  ([pageId, dockPanel]) => {
    localStorage.setItem(EDITOR_STATE_KEY, JSON.stringify({
      pageId,
      dockPanel,
      dockPanelWidthPx: dockPanelWidthPx.value,
      zoomPercent: zoomPercent.value,
      showGuides: showGuides.value,
      selectedTemplateId: selectedTemplateId.value,
      panelVisibility: panelVisibility.value,
    }));
  },
  { deep: true },
);
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("resize", handleViewportResize);
  stopDockPanelResize();
  if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
});
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--resizing-dock': dockPanelResizing }" @click="activeMenu = undefined">
    <header class="application-header">
      <nav class="menu-bar" aria-label="Главное меню" @click.stop>
        <div class="menu-bar__brand">КМ</div>
        <div v-for="menu in applicationMenus" :key="menu.id" class="menu-bar__window">
          <button
            type="button"
            :class="{ active: activeMenu === menu.id }"
            @click="toggleApplicationMenu(menu.id)"
          >
            {{ menu.label }}
          </button>
          <div v-if="activeMenu === menu.id" class="window-menu" role="menu">
            <template v-for="(item, itemIndex) in menu.items" :key="`${menu.id}-${itemIndex}`">
              <div v-if="item.separator" class="window-menu__divider"></div>
              <button
                v-else
                type="button"
                role="menuitem"
                :disabled="item.disabled"
                @click="executeMenuCommand(item.command)"
              >
                <span>{{ item.checked ? "✓" : "" }}</span>
                {{ item.label }}
                <kbd>{{ item.shortcut }}</kbd>
              </button>
            </template>
          </div>
        </div>
        <span class="menu-bar__workspace">Рабочая среда: Издательская</span>
      </nav>

      <div class="control-bar">
        <div class="brand">
          <div class="brand__mark" aria-hidden="true">К</div>
          <div>
            <strong>Календарная мастерская</strong>
            <span>{{ project.name }}</span>
          </div>
        </div>
        <div class="context-controls" aria-label="Контекстные параметры">
          <span class="context-controls__icon">
            {{ activeTool === "text" ? "T" : activeTool === "image" ? "▧" : "↖" }}
          </span>
          <label><span>X</span><input :value="selectedElement?.x ?? '—'" :disabled="!selectedElement" type="number" step="0.1" @change="updateElementNumber('x', $event)" /></label>
          <label><span>Y</span><input :value="selectedElement?.y ?? '—'" :disabled="!selectedElement" type="number" step="0.1" @change="updateElementNumber('y', $event)" /></label>
          <label><span>W</span><input :value="selectedElement?.width ?? '—'" :disabled="!selectedElement" type="number" step="0.1" @change="updateElementNumber('width', $event)" /></label>
          <label><span>H</span><input :value="selectedElement?.height ?? '—'" :disabled="!selectedElement" type="number" step="0.1" @change="updateElementNumber('height', $event)" /></label>
          <span class="context-controls__unit">мм</span>
        </div>
        <div class="control-bar__status">
          <span class="status-chip">{{ selectedPage.formatId }} · {{ orientationLabel }}</span>
          <span class="status-chip status-chip--accent">Источник: мм</span>
          <span v-if="calendarLoadState === 'ready'" class="status-chip">
            XML: {{ calendarDataset?.statistics.recordCount }}
          </span>
        </div>
        <div class="control-bar__controls">
          <label class="toggle-control">
            <input v-model="showGuides" type="checkbox" />
            Направляющие
          </label>
          <label class="zoom-control">
            <span>{{ zoomPercent }}%</span>
            <input v-model.number="zoomPercent" type="range" min="35" max="100" step="5" />
          </label>
        </div>
      </div>

      <div class="document-tabs">
        <button class="document-tab document-tab--active" type="button">
          <span>×</span>{{ selectedPage.name }} — {{ project.name }} @ {{ zoomPercent }}%
        </button>
      </div>
    </header>

    <div class="editor-shell" :style="{ gridTemplateColumns: editorGridColumns }">
      <ToolsPanel
        v-if="showToolsPanel"
        :active-tool="activeTool"
        :fill-color="currentFillColor"
        :stroke-color="currentStrokeColor"
        @select="selectTool"
        @update-fill="updateFillColor"
        @update-stroke="updateStrokeColor"
        @apply-gold="applyGoldPaint"
      />

      <DocumentWorkspace
        :page="selectedPage"
        :assets="project.assets"
        :food-marker-pack-id="project.foodMarkerPackId"
        :food-marker-assets="project.foodMarkerAssets"
        :fasting-profile-id="project.fastingProfileId"
        :calendar-year="displayedCalendarYear"
        :pixels-per-mm="pixelsPerMm"
        :show-guides="showGuides"
        :active-tool="activeTool"
        :selected-element-id="selectedElementId"
        @create="createElement"
        @select="selectElement"
        @update-geometry="updateElementGeometry"
        @geometry-start="beginContinuousEdit"
        @geometry-end="endContinuousEdit"
      />

      <div
        v-if="showDock"
        class="inspector-resizer"
        :class="{ 'inspector-resizer--active': dockPanelResizing }"
        role="separator"
        aria-label="Изменить ширину правой панели"
        aria-orientation="vertical"
        :aria-valuemin="DOCK_PANEL_MIN_WIDTH_PX"
        :aria-valuemax="dockPanelMaximumWidthPx"
        :aria-valuenow="dockPanelWidthPx"
        tabindex="0"
        data-testid="inspector-resizer"
        title="Потяните для изменения ширины; двойной щелчок — исходная ширина"
        @pointerdown="startDockPanelResize"
        @keydown.stop="resizeDockPanelWithKeyboard"
        @dblclick="resetDockPanelWidth"
      ></div>

      <aside v-if="showDock" class="inspector-panel">
        <div class="dock-tabs" role="tablist" aria-label="Панели документа">
          <button
            v-for="panel in visibleDockPanels"
            :key="panel.id"
            type="button"
            role="tab"
            :aria-selected="activeDockPanel === panel.id"
            :class="{ active: activeDockPanel === panel.id }"
            @click="activateDockPanel(panel.id)"
          >
            {{ panel.label }}
          </button>
        </div>

        <div v-if="activeDockPanel === 'properties'" class="dock-content">
          <details class="inspector-group" open>
            <summary>Свойства</summary>
            <section class="inspector-section">
              <h2>{{ selectedElement ? "Объект" : "Страница" }}</h2>
              <template v-if="selectedElement">
                <dl class="property-list property-list--object">
                  <div><dt>Тип</dt><dd>{{ selectedElement.type }}</dd></div>
                  <label><span>X</span><input :value="selectedElement.x" type="number" step="0.1" @change="updateElementNumber('x', $event)" /></label>
                  <label><span>Y</span><input :value="selectedElement.y" type="number" step="0.1" @change="updateElementNumber('y', $event)" /></label>
                  <label><span>Ширина</span><input :value="selectedElement.width" type="number" min="0.2" step="0.1" @change="updateElementNumber('width', $event)" /></label>
                  <label><span>Высота</span><input :value="selectedElement.height" type="number" min="0.2" step="0.1" @change="updateElementNumber('height', $event)" /></label>
                  <label><span>Поворот</span><input :value="selectedElement.rotation" type="number" step="1" @change="updateElementNumber('rotation', $event)" /></label>
                </dl>

                <div v-if="supportsElementOpacity(selectedElement)" class="opacity-controls">
                  <label class="field-control">
                    <span>Непрозрачность, %</span>
                    <input data-testid="object-opacity" :value="elementOpacityPercent(selectedElement)" type="number" min="0" max="100" step="1" @input="updateSelectedOpacity" />
                  </label>
                  <input
                    class="opacity-controls__range"
                    aria-label="Непрозрачность объекта"
                    :value="elementOpacityPercent(selectedElement)"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    @input="updateSelectedOpacity"
                  />
                </div>

                <div v-if="selectedElement.type === 'text' || selectedElement.type === 'month-text'" class="object-properties">
                  <label class="field-stack"><span>Текст</span><textarea v-model="selectedElement.content.title" rows="3"></textarea></label>
                  <label v-if="selectedElement.type === 'month-text'" class="field-stack"><span>Автор / источник</span><input v-model="selectedElement.attribution" type="text" /></label>
                  <label class="field-control"><span>Шрифт</span><select v-model="selectedElement.typography.fontFamily" :style="{ fontFamily: selectedElement.typography.fontFamily }"><optgroup v-for="group in fontOptionGroups" :key="group.label" :label="group.label"><option v-for="option in group.options" :key="option.family" :value="option.family" :style="{ fontFamily: option.family }">{{ option.label }}</option></optgroup></select></label>
                  <label class="field-control"><span>Размер, pt</span><input v-model.number="selectedElement.typography.fontSizePt" type="number" min="3" max="300" step="0.5" /></label>
                  <label class="field-control"><span>Начертание</span><select v-model.number="selectedElement.typography.fontWeight"><option :value="400">Обычное</option><option :value="700">Полужирное</option></select></label>
                  <label class="field-control"><span>Стиль</span><select v-model="selectedElement.typography.fontStyle"><option value="normal">Прямой</option><option value="italic">Курсив</option></select></label>
                  <label class="field-control"><span>Интерлиньяж</span><input v-model.number="selectedElement.typography.lineHeight" type="number" min="0.7" max="3" step="0.05" /></label>
                  <label class="field-control"><span>Трекинг, pt</span><input v-model.number="selectedElement.typography.letterSpacingPt" type="number" min="-5" max="30" step="0.1" /></label>
                  <label class="field-control"><span>Отступ, мм</span><input v-model.number="selectedElement.typography.paddingMm" type="number" min="0" max="30" step="0.1" /></label>
                  <label class="field-control"><span>Цвет</span><input v-model="selectedElement.typography.color" type="color" /></label>
                  <button type="button" class="gold-preset-button" @click="applyGoldPaint">Золотой цвет</button>
                  <label class="field-control"><span>Выравнивание</span><select v-model="selectedElement.typography.align"><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option><option value="justify">По ширине</option></select></label>
                  <label class="field-control"><span>По вертикали</span><select v-model="selectedElement.typography.verticalAlign"><option value="top">Сверху</option><option value="middle">По центру</option><option value="bottom">Снизу</option></select></label>
                </div>

                <div v-else-if="selectedElement.type === 'image' || selectedElement.type === 'svg'" class="object-properties">
                  <button class="primary-action" type="button" @click="requestAssetFile">
                    {{ selectedElement.assetId ? "Заменить файл…" : "Выбрать файл…" }}
                  </button>
                  <label v-if="selectedElement.type === 'image'" class="field-control"><span>Заполнение</span><select v-model="selectedElement.fit"><option value="crop">С обрезкой</option><option value="fit">Вписать</option><option value="fill">Растянуть</option></select></label>
                  <label v-if="selectedElement.type === 'svg' && selectedElement.libraryItemId" class="field-control">
                    <span>Цвет SVG</span>
                    <input :value="selectedElement.decorColor ?? '#17201d'" type="color" @change="updateSelectedDecorColor" />
                  </label>
                  <button v-if="selectedElement.type === 'svg' && selectedElement.libraryItemId" type="button" class="gold-preset-button" @click="applyGoldPaint">Золотой цвет SVG</button>
                  <p v-if="selectedElement.type === 'svg' && selectedElement.libraryItemId" class="property-help">Векторный элемент из библиотеки: цвет меняется без потери качества.</p>
                  <p v-if="selectedAssetInfo()" class="property-help">{{ selectedAssetInfo() }}</p>
                </div>

                <div v-else-if="selectedElement.type === 'calendar-grid'" class="object-properties">
                  <label class="field-control"><span>Месяц</span><select v-model.number="selectedElement.month"><option v-for="(month, index) in monthNames" :key="month" :value="index + 1">{{ month }}</option></select></label>
                  <label class="field-control"><span>Недель</span><select v-model.number="selectedElement.weekRows"><option :value="4">4</option><option :value="5">5</option><option :value="6">6</option></select></label>
                  <label class="checkbox-field"><input v-model="selectedElement.showWeekdayHeader" type="checkbox" /><span>Заголовки дней недели</span></label>
                  <label class="field-control"><span>Названия</span><select v-model="selectedElement.weekdayLabelMode"><option value="full">Полные</option><option value="short">Короткие</option><option value="custom">Свои</option></select></label>
                  <label class="field-control"><span>Стиль сетки</span><select v-model="selectedElement.gridStyle"><option value="editorial">Издательская</option><option value="boxed">Табличная</option><option value="minimal">Без линий</option></select></label>
                  <label class="field-control"><span>Шрифт заголовков</span><select v-model="selectedElement.weekdayFontFamily" :style="{ fontFamily: selectedElement.weekdayFontFamily }"><optgroup v-for="group in fontOptionGroups" :key="group.label" :label="group.label"><option v-for="option in group.options" :key="option.family" :value="option.family" :style="{ fontFamily: option.family }">{{ option.label }}</option></optgroup></select></label>
                  <label class="field-control"><span>Заголовки, pt</span><input v-model.number="selectedElement.weekdayFontSizePt" type="number" step="0.5" /></label>
                  <div v-if="selectedElement.weekdayLabelMode === 'custom'" class="weekday-label-editor">
                    <input
                      v-for="(_, index) in 7"
                      :key="index"
                      :value="selectedElement.customWeekdayLabels?.[index] ?? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][index]"
                      type="text"
                      @input="updateWeekdayLabel(selectedElement, index, ($event.target as HTMLInputElement).value)"
                    />
                  </div>
                  <label class="field-control"><span>Событий в ячейке</span><input v-model.number="selectedElement.maxVisibleEvents" type="number" step="1" /></label>
                  <label class="field-control"><span>Состав памятей</span><select :value="selectedElement.commemorationDetail ?? 'standard'" @change="updateCommemorationPreset(selectedElement, ($event.target as HTMLSelectElement).value)"><option value="main">Пасха, двунадесятые и великие</option><option value="standard">Великие и средние</option><option value="full">Все допустимые</option><option value="custom">Свой выбор</option></select></label>
                  <div class="commemoration-filter">
                    <label v-for="option in commemorationFilterOptions" :key="option.id" class="checkbox-field">
                      <input :checked="commemorationFilterEnabled(selectedElement, option.id)" type="checkbox" @change="updateCommemorationFilter(selectedElement, option.id, ($event.target as HTMLInputElement).checked)" />
                      <span>{{ option.label }}</span>
                    </label>
                    <label class="field-control"><span>Малых памятей в пустой день</span><input v-model.number="selectedElement.minorCommemorationFallback" type="number" step="1" /></label>
                  </div>
                  <label class="field-control"><span>Шрифт числа</span><select v-model="selectedElement.dayNumberFontFamily" :style="{ fontFamily: selectedElement.dayNumberFontFamily }"><optgroup v-for="group in fontOptionGroups" :key="group.label" :label="group.label"><option v-for="option in group.options" :key="option.family" :value="option.family" :style="{ fontFamily: option.family }">{{ option.label }}</option></optgroup></select></label>
                  <label class="field-control"><span>Размер числа, pt</span><input v-model.number="selectedElement.dayNumberFontSizePt" data-testid="day-number-size" type="number" step="0.5" /></label>
                  <div class="cell-object-controls">
                    <strong>Число дня — положение от левого верхнего угла</strong>
                    <label class="field-control"><span>X, мм</span><input v-model.number="selectedElement.dayNumberXOffsetMm" type="number" step="0.1" /></label>
                    <label class="field-control"><span>Y, мм</span><input v-model.number="selectedElement.dayNumberYOffsetMm" type="number" step="0.1" /></label>
                  </div>
                  <label class="field-control"><span>Шрифт событий</span><select v-model="selectedElement.eventFontFamily" :style="{ fontFamily: selectedElement.eventFontFamily }"><optgroup v-for="group in fontOptionGroups" :key="group.label" :label="group.label"><option v-for="option in group.options" :key="option.family" :value="option.family" :style="{ fontFamily: option.family }">{{ option.label }}</option></optgroup></select></label>
                  <label class="field-control"><span>Текст событий, pt</span><input v-model.number="selectedElement.eventFontSizePt" data-testid="event-font-size" type="number" step="0.25" /></label>
                  <label class="checkbox-field"><input :checked="selectedElement.autoFitText !== false" type="checkbox" @change="selectedElement.autoFitText = ($event.target as HTMLInputElement).checked" /><span>Автоподбор кегля</span></label>
                  <label v-if="selectedElement.autoFitText !== false" class="field-control"><span>Не уменьшать ниже, pt</span><input :value="selectedElement.minimumEventFontSizePt ?? 9" data-testid="event-minimum-size" type="number" step="0.25" @input="selectedElement.minimumEventFontSizePt = Number(($event.target as HTMLInputElement).value)" /></label>
                  <p v-if="selectedElement.autoFitText !== false" class="property-help">Автоподбор уменьшает заданный выше кегль только тогда, когда важный текст не помещается.</p>
                  <label class="field-control"><span>Между строками, pt</span><input v-model.number="selectedElement.eventLineSpacingPt" type="number" step="0.25" /></label>
                  <label class="field-control"><span>Между событиями, pt</span><input v-model.number="selectedElement.eventGapPt" type="number" step="0.25" /></label>
                  <div class="cell-object-controls">
                    <strong>Текст событий — независимая область</strong>
                    <label class="field-control"><span>X, мм</span><input v-model.number="selectedElement.eventTextXOffsetMm" type="number" step="0.1" /></label>
                    <label class="field-control"><span>Y, мм</span><input v-model.number="selectedElement.eventTextYOffsetMm" type="number" step="0.1" /></label>
                    <label class="field-control"><span>Поле справа, мм</span><input v-model.number="selectedElement.eventTextRightInsetMm" type="number" step="0.1" /></label>
                    <label class="field-control"><span>Поле снизу, мм</span><input v-model.number="selectedElement.eventTextBottomInsetMm" type="number" step="0.1" /></label>
                  </div>
                  <label class="checkbox-field"><input v-model="selectedElement.showOldStyleDate" type="checkbox" /><span>Дата по старому стилю</span></label>
                  <div v-if="selectedElement.showOldStyleDate" class="cell-object-controls">
                    <strong>Дата по старому стилю</strong>
                    <label class="field-control"><span>Шрифт</span><select v-model="selectedElement.oldStyleFontFamily" :style="{ fontFamily: selectedElement.oldStyleFontFamily }"><optgroup v-for="group in fontOptionGroups" :key="group.label" :label="group.label"><option v-for="option in group.options" :key="option.family" :value="option.family" :style="{ fontFamily: option.family }">{{ option.label }}</option></optgroup></select></label>
                    <label class="field-control"><span>Размер, pt</span><input v-model.number="selectedElement.oldStyleFontSizePt" type="number" step="0.25" /></label>
                    <label class="field-control"><span>X, мм</span><input v-model.number="selectedElement.oldStyleXOffsetMm" type="number" step="0.1" /></label>
                    <label class="field-control"><span>Y, мм</span><input v-model.number="selectedElement.oldStyleYOffsetMm" type="number" step="0.1" /></label>
                  </div>
                  <label class="checkbox-field"><input v-model="selectedElement.showFeastColors" type="checkbox" /><span>Цвета праздников</span></label>
                  <label class="checkbox-field"><input v-model="selectedElement.showTypikonIcons" type="checkbox" /><span>Включить знаки типикона</span></label>
                  <div v-if="selectedElement.showTypikonIcons" class="cell-object-controls">
                    <strong>Знак типикона</strong>
                    <label class="field-control"><span>Размер, мм</span><input v-model.number="selectedElement.typikonMarkerSizeMm" data-testid="typikon-marker-size" type="number" step="0.1" /></label>
                    <label class="field-control"><span>X, мм</span><input v-model.number="selectedElement.typikonMarkerXOffsetMm" data-testid="typikon-marker-x" type="number" step="0.1" /></label>
                    <label class="field-control"><span>Y, мм</span><input v-model.number="selectedElement.typikonMarkerYOffsetMm" data-testid="typikon-marker-y" type="number" step="0.1" /></label>
                  </div>
                  <label class="checkbox-field"><input v-model="selectedElement.showFoodIcons" type="checkbox" /><span>Значки пищи и поста</span></label>
                  <div v-if="selectedElement.showFoodIcons" class="cell-object-controls">
                    <strong>Значок пищи / поста</strong>
                    <label class="field-control"><span>Размер, мм</span><input v-model.number="selectedElement.foodMarkerSizeMm" data-testid="food-marker-size" type="number" step="0.1" /></label>
                    <label class="field-control"><span>X, мм</span><input v-model.number="selectedElement.foodMarkerXOffsetMm" data-testid="food-marker-x" type="number" step="0.1" /></label>
                    <label class="field-control"><span>Y, мм</span><input v-model.number="selectedElement.foodMarkerYOffsetMm" data-testid="food-marker-y" type="number" step="0.1" /></label>
                  </div>
                  <label class="checkbox-field"><input v-model="selectedElement.showFastingText" type="checkbox" /><span>Текстовые записи о посте</span></label>
                  <label class="checkbox-field"><input v-model="selectedElement.showMarriageRules" type="checkbox" /><span>Правила венчания</span></label>
                  <label class="checkbox-field"><input v-model="selectedElement.showScriptureReadings" type="checkbox" /><span>Чтения Священного Писания</span></label>
                  <button class="primary-action" type="button" @click="applyGridPresentationToAllMonths">Применить оформление ко всем месяцам</button>
                  <div v-if="selectedElement.showFoodIcons" class="food-marker-editor">
                    <strong class="food-marker-editor__heading">Набор картинок</strong>
                    <label class="field-control">
                      <span>Стиль</span>
                      <select data-testid="food-marker-pack" :value="activeFoodMarkerPack.id" @change="updateFoodMarkerPack(($event.target as HTMLSelectElement).value)">
                        <option v-for="pack in foodMarkerPackOptions" :key="pack.id" :value="pack.id">{{ pack.label }}</option>
                      </select>
                    </label>
                    <div class="food-marker-pack-current">
                      <span class="food-marker-pack-option__preview">
                        <img v-for="rule in foodMarkerPackPreviewRules" :key="rule" :src="foodMarkerPackSource(activeFoodMarkerPack.id, rule)" alt="" />
                      </span>
                      <strong>{{ activeFoodMarkerPack.label }}</strong>
                      <small>{{ activeFoodMarkerPack.description }}</small>
                    </div>
                    <p class="property-help">Выбранный набор сразу применяется ко всем месяцам. Легенда показывает только знаки, используемые в выбранном месяце.</p>
                    <div v-for="rule in foodRuleOptions" :key="rule.id" class="food-marker-editor__row">
                      <img :src="foodMarkerPreviewSource(rule.id)" :alt="rule.label" />
                      <span><strong>{{ rule.label }}</strong><small>{{ foodMarkerAssetName(rule.id) }}</small></span>
                      <div class="food-marker-editor__actions">
                        <button type="button" @click="requestFoodMarkerFile(rule.id)">Заменить…</button>
                        <button v-if="hasCustomFoodMarker(rule.id)" type="button" @click="clearFoodMarkerAsset(rule.id)">Сбросить</button>
                      </div>
                    </div>
                  </div>
                  <p class="property-help">Данные дней и праздников берутся из рассчитанного календаря {{ project.year }} года.</p>
                </div>

                <div v-else-if="selectedElement.type === 'shape'" class="object-properties">
                  <label v-if="selectedElement.shape !== 'line'" class="field-control"><span>Тип заливки</span><select data-testid="shape-fill-mode" :value="selectedElement.fillGradient ? 'gradient' : 'solid'" @change="updateSelectedShapeFillMode"><option value="solid">Сплошной цвет</option><option value="gradient">Линейный градиент</option></select></label>
                  <label v-if="selectedElement.shape !== 'line' && !selectedElement.fillGradient" class="field-control"><span>Заливка</span><input v-model="selectedElement.fillColor" type="color" /></label>
                  <div v-if="selectedElement.shape !== 'line' && selectedElement.fillGradient" class="gradient-controls">
                    <label class="field-control"><span>Начало</span><input v-model="selectedElement.fillGradient.startColor" type="color" /></label>
                    <label class="field-control"><span>Блик</span><input v-model="selectedElement.fillGradient.centerColor" type="color" /></label>
                    <label class="field-control"><span>Конец</span><input v-model="selectedElement.fillGradient.endColor" type="color" /></label>
                    <label class="field-control"><span>Направление</span><select v-model="selectedElement.fillGradient.direction"><option value="horizontal">Слева направо</option><option value="vertical">Сверху вниз</option></select></label>
                  </div>
                  <button v-if="selectedElement.shape !== 'line'" type="button" class="gold-preset-button" @click="applyGoldPaint">Золотой металлический градиент</button>
                  <label class="field-control"><span>Обводка</span><input v-model="selectedElement.strokeColor" type="color" /></label>
                  <label class="field-control"><span>Толщина, мм</span><input v-model.number="selectedElement.strokeWidthMm" type="number" min="0" max="20" step="0.05" /></label>
                </div>

                <div v-else-if="selectedElement.type === 'legend'" class="object-properties">
                  <div class="button-pair">
                    <button type="button" @click="placeSelectedLegend('top')">Сверху</button>
                    <button type="button" @click="placeSelectedLegend('bottom')">Снизу</button>
                  </div>
                  <p class="property-help">Легенда располагает только применённые в этом месяце знаки в одну строку и собирает их у правого края. Свободное место остаётся слева; саму легенду можно двигать мышью.</p>
                </div>

                <div class="overflow-indicator" :class="`overflow-indicator--${selectedElementOverflowState}`">
                  Переполнение: {{ selectedElementOverflowState === "none" ? "нет" : selectedElementOverflowState === "error" ? "ошибка" : "требует внимания" }}
                  <small v-if="selectedElementIssues.length">{{ selectedElementIssues.map((item) => item.message).join(' ') }}</small>
                </div>
              </template>
              <template v-else>
              <label class="field-stack"><span>Название проекта</span><input v-model="project.name" type="text" /></label>
              <label class="field-control"><span>Календарный год</span><input :value="project.year" type="number" min="1900" max="2200" @change="updateProjectYear" /></label>
              <label class="field-control"><span>Правила поста</span><select v-model="project.fastingProfileId"><option v-for="profile in fastingProfileOptions" :key="profile.id" :value="profile.id">{{ profile.label }}</option></select></label>
              <p class="property-help">{{ FASTING_PROFILES[project.fastingProfileId ?? 'typikon-strict'].description }} Версия правил {{ FASTING_PROFILES[project.fastingProfileId ?? 'typikon-strict'].rulesVersion }}.</p>
              <label class="field-stack"><span>Издатель / монастырь</span><input v-model="project.publisherProfile.name" type="text" /></label>
              <h2 class="property-subheading">Шрифты проекта</h2>
              <button type="button" @click="requestCustomFontFile">Добавить TTF/OTF/WOFF…</button>
              <div v-for="font in project.customFonts" :key="font.assetId" class="saved-template-row">
                <span>{{ font.family }}</span>
                <button type="button" title="Удалить шрифт" @click="removeProjectFont(font.assetId)">×</button>
              </div>
              <label class="field-stack"><span>Название страницы</span><input v-model="selectedPage.name" type="text" /></label>
              <button class="primary-action" type="button" @click="activateDockPanel('events')">Дополнительные даты и события…</button>
              <div class="inspector-divider"></div>
              <label class="field-control">
                <span>Формат</span>
                <select
                  :value="selectedPage.formatId"
                  @change="updateFormat(($event.target as HTMLSelectElement).value as PageFormatId)"
                >
                  <option v-for="format in Object.keys(PAGE_FORMATS)" :key="format" :value="format">
                    {{ format }}
                  </option>
                </select>
              </label>
              <div class="segmented-control" aria-label="Ориентация страницы">
                <button
                  type="button"
                  :class="{ active: selectedPage.orientation === 'portrait' }"
                  @click="updateOrientation('portrait')"
                >
                  Книжная
                </button>
                <button
                  type="button"
                  :class="{ active: selectedPage.orientation === 'landscape' }"
                  @click="updateOrientation('landscape')"
                >
                  Альбомная
                </button>
              </div>
              <div class="inspector-divider"></div>
              <h2>Размер и служебные зоны</h2>
              <dl class="property-list">
                <div><dt>Единицы</dt><dd>{{ project.document.unit }}</dd></div>
                <div><dt>Ширина</dt><dd>{{ selectedPage.width }} мм</dd></div>
                <div><dt>Высота</dt><dd>{{ selectedPage.height }} мм</dd></div>
              </dl>
              <h2 class="property-subheading">Вылеты, мм</h2>
              <div class="insets-editor">
                <label><span>Верх</span><input v-model.number="selectedPage.bleed.top" type="number" min="0" max="30" step="0.5" /></label>
                <label><span>Право</span><input v-model.number="selectedPage.bleed.right" type="number" min="0" max="30" step="0.5" /></label>
                <label><span>Низ</span><input v-model.number="selectedPage.bleed.bottom" type="number" min="0" max="30" step="0.5" /></label>
                <label><span>Лево</span><input v-model.number="selectedPage.bleed.left" type="number" min="0" max="30" step="0.5" /></label>
              </div>
              <h2 class="property-subheading">Безопасная область, мм</h2>
              <div class="insets-editor">
                <label><span>Верх</span><input v-model.number="selectedPage.safeArea.top" type="number" min="0" step="0.5" /></label>
                <label><span>Право</span><input v-model.number="selectedPage.safeArea.right" type="number" min="0" step="0.5" /></label>
                <label><span>Низ</span><input v-model.number="selectedPage.safeArea.bottom" type="number" min="0" step="0.5" /></label>
                <label><span>Лево</span><input v-model.number="selectedPage.safeArea.left" type="number" min="0" step="0.5" /></label>
              </div>
              <h2 class="property-subheading">Метки реза</h2>
              <label class="checkbox-field"><input v-model="cropMarksEnabled" type="checkbox" /><span>Добавлять в печатный PDF</span></label>
              <div v-if="cropMarksEnabled" class="insets-editor insets-editor--two">
                <label><span>Длина</span><input v-model.number="cropMarkLengthMm" type="number" min="0.5" max="10" step="0.5" /></label>
                <label><span>Отступ</span><input v-model.number="cropMarkOffsetMm" type="number" min="0" max="10" step="0.5" /></label>
              </div>
              <h2 class="property-subheading">Переплёт и типография</h2>
              <label class="field-control"><span>Сторона переплёта</span><select v-model="bindingEdge"><option value="none">Без переплёта</option><option value="top">Сверху / пружина</option><option value="left">Слева</option><option value="right">Справа</option></select></label>
              <label v-if="bindingEdge !== 'none'" class="field-control"><span>Защитная зона, мм</span><input v-model.number="bindingSafeMm" type="number" min="0" max="40" step="0.5" /></label>
              <label class="field-control"><span>Стандарт PDF</span><select v-model="pdfStandard"><option value="PDF-1.7">PDF 1.7</option><option value="PDF/X-4">PDF/X-4</option></select></label>
              <button type="button" @click="requestIccProfileFile">{{ iccProfileName ? 'Заменить ICC-профиль…' : 'Загрузить ICC-профиль типографии…' }}</button>
              <p class="property-help">{{ iccProfileName ? `Встроен профиль: ${iccProfileName}` : 'Для PDF/X-4 нужен ICC/ICM-файл типографии.' }}</p>
              </template>
            </section>
          </details>
          <p class="inspector-footnote">
            Линейки, bleed и safe area являются только интерфейсом редактора.
          </p>
        </div>

        <div v-else-if="activeDockPanel === 'library'" class="dock-content decor-library-dock">
          <div class="dock-content__heading">Библиотека элементов</div>
          <DecorLibraryPanel :items="decorLibraryItems" @insert="insertDecorLibraryItem" />
        </div>

        <div v-else-if="activeDockPanel === 'layers'" class="dock-content">
          <div class="dock-content__heading">Слои текущей страницы</div>
          <LayersPanel
            :page="selectedPage"
            :selected-layer-ids="selectedLayerIds"
            @select="selectLayer"
            @add="addLayer"
            @add-group="addLayerGroup"
            @group-selected="groupSelectedLayers"
            @delete-selected="deleteSelection"
            @bring-front="moveSelectionToEdge('front')"
            @send-back="moveSelectionToEdge('back')"
            @rename="renameLayer"
            @move="moveLayer"
            @toggle-expanded="(id) => { const layer = findLayer(id); if (layer?.kind === 'group') layer.expanded = !layer.expanded; }"
            @toggle-visible="(id) => { const layer = findLayer(id); if (layer) layer.visible = !layer.visible; }"
            @toggle-locked="(id) => { const layer = findLayer(id); if (layer) layer.locked = !layer.locked; }"
          />
        </div>

        <div v-else-if="activeDockPanel === 'events'" class="dock-content events-dock">
          <div class="dock-content__heading dock-content__heading--actions">
            <span>События монастыря</span>
            <button type="button" title="Добавить событие" @click="addMonasteryEvent">＋</button>
          </div>
          <p v-if="project.monasteryEvents.length === 0" class="empty-panel-message">
            Ежегодных и разовых событий пока нет.
          </p>
          <article v-for="event in project.monasteryEvents" :key="event.id" class="event-card">
            <div class="event-card__header">
              <strong>{{ event.title || "Без названия" }}</strong>
              <button type="button" title="Удалить событие" @click="removeMonasteryEvent(event.id)">⌫</button>
            </div>
            <label class="field-stack"><span>Название</span><input v-model="event.title" type="text" /></label>
            <label class="field-stack"><span>Кратко</span><input v-model="event.shortTitle" type="text" /></label>
            <label class="field-stack"><span>Очень кратко</span><input v-model="event.veryShortTitle" type="text" /></label>
            <label class="field-control">
              <span>Повтор</span>
              <select :value="event.dateRule.type" @change="changeMonasteryEventRule(event, ($event.target as HTMLSelectElement).value as 'annual' | 'once')">
                <option value="annual">Каждый год</option>
                <option value="once">Один раз</option>
              </select>
            </label>
            <div v-if="event.dateRule.type === 'annual'" class="event-card__date-pair">
              <label><span>Месяц</span><input v-model.number="event.dateRule.month" type="number" min="1" max="12" /></label>
              <label><span>День</span><input v-model.number="event.dateRule.day" type="number" min="1" max="31" /></label>
            </div>
            <label v-else class="field-stack"><span>Дата</span><input v-model="event.dateRule.date" type="date" /></label>
            <label class="field-control"><span>Стиль</span><select v-model="event.styleToken"><option v-for="token in project.styleTheme.tokens" :key="token.id" :value="token.id">{{ token.label }}</option></select></label>
            <label class="field-control"><span>Приоритет</span><input v-model.number="event.priority" type="number" min="1" max="1000" /></label>
          </article>
        </div>

        <div v-else-if="activeDockPanel === 'preflight'" class="dock-content preflight-dock">
          <div class="dock-content__heading">Предпечатная проверка</div>
          <div class="preflight-summary" :class="{ 'preflight-summary--error': preflightErrorCount > 0 }">
            <strong v-if="preflightErrorCount">{{ preflightErrorCount }} ошибок</strong>
            <strong v-else>Критических ошибок нет</strong>
            <span>{{ preflightWarningCount }} предупреждений</span>
          </div>
          <p v-if="preflightIssues.length === 0" class="empty-panel-message">
            Документ готов к печатному экспорту.
          </p>
          <button
            v-for="item in preflightIssues"
            :key="item.id"
            type="button"
            class="preflight-item"
            :class="`preflight-item--${item.severity}`"
            @click="selectPreflightIssue(item)"
          >
            <span class="preflight-item__icon">{{ item.severity === 'error' ? '×' : '!' }}</span>
            <span><strong>{{ item.pageName }}</strong><small>{{ item.message }}</small></span>
          </button>
        </div>

        <div v-else class="dock-content pages-dock">
          <div class="dock-content__heading">Страницы</div>
          <section class="template-picker">
            <h3>Шаблон календаря</h3>
            <label
              v-for="preset in calendarTemplatePresets"
              :key="preset.id"
              class="template-option"
              :class="{ 'template-option--active': selectedTemplateId === preset.id }"
            >
              <input v-model="selectedTemplateId" type="radio" :value="preset.id" />
              <span><strong>{{ preset.name }}</strong><small>{{ preset.description }}</small></span>
            </label>
            <button class="primary-action" type="button" @click="applyFullCalendarTemplate">
              Создать обложку и 12 месяцев
            </button>
            <button v-if="selectedPage.kind === 'month'" type="button" @click="applySelectedMonthAsMaster">
              Сделать этот месяц мастер-страницей…
            </button>
          </section>
          <section class="template-picker">
            <h3>Мои шаблоны</h3>
            <button class="primary-action" type="button" @click="saveCurrentDesignAsTemplate">Сохранить текущий дизайн…</button>
            <p v-if="userProjectTemplates.length === 0" class="empty-panel-message">Сохранённых шаблонов пока нет.</p>
            <div v-for="template in userProjectTemplates" :key="template.id" class="saved-template-row">
              <button type="button" @click="applyUserProjectTemplate(template)">{{ template.name }}</button>
              <button type="button" title="Удалить шаблон" @click="removeUserProjectTemplate(template)">×</button>
            </div>
          </section>
          <section class="template-picker">
            <h3>Шаблоны календарной сетки</h3>
            <button class="primary-action" type="button" :disabled="selectedElement?.type !== 'calendar-grid'" @click="saveSelectedGridAsTemplate">Сохранить выбранную сетку…</button>
            <p v-if="userCalendarGridTemplates.length === 0" class="empty-panel-message">Сохранённых сеток пока нет.</p>
            <div v-for="template in userCalendarGridTemplates" :key="template.id" class="grid-template-row">
              <button type="button" :title="`Применить «${template.name}» к выбранной сетке`" @click="applyCalendarGridTemplate(template, false)">{{ template.name }}</button>
              <button type="button" title="Применить ко всем месяцам" @click="applyCalendarGridTemplate(template, true)">12×</button>
              <button type="button" title="Удалить шаблон сетки" @click="removeCalendarGridTemplate(template)">×</button>
            </div>
          </section>
          <section v-if="projectBackups.length" class="template-picker">
            <h3>Восстановление</h3>
            <button v-for="backup in projectBackups.slice(0, 5)" :key="backup.id" type="button" class="backup-row" :title="backup.label" @click="restoreProjectBackup(backup)">
              {{ formatBackupTime(backup.createdAt) }}
            </button>
          </section>
          <button
            v-for="(page, pageIndex) in project.document.pages"
            :key="page.id"
            class="page-card"
            :class="{ 'page-card--active': page.id === selectedPage.id }"
            type="button"
            @click="selectPage(page.id)"
          >
            <span
              class="page-card__thumbnail"
              :class="{ 'page-card__thumbnail--landscape': page.orientation === 'landscape' }"
            >
              <span class="page-card__safe"></span>
            </span>
            <span>
              <strong>{{ pageIndex + 1 }}. {{ page.name }}</strong>
              <small>{{ page.width }} × {{ page.height }} мм</small>
            </span>
          </button>
        </div>
      </aside>
    </div>

    <footer class="status-bar">
      <button
        type="button"
        class="status-bar__preflight"
        :class="{ 'status-bar__preflight--warning': preflightWarningCount > 0, 'status-bar__preflight--error': preflightErrorCount > 0 }"
        @click="activateDockPanel('preflight')"
      ><i></i> Проверка: {{ preflightErrorCount ? `${preflightErrorCount} ошибок` : preflightWarningCount ? `${preflightWarningCount} предупреждений` : "без ошибок" }}</button>
          <span>Страница {{ selectedPageIndex + 1 }} из {{ project.document.pages.length }}</span>
      <span class="status-bar__notice">{{ operationNotice }}</span>
      <span>{{ projectFileStatus }}</span>
      <span>Автовосстановление: {{ persistenceState }}</span>
      <span v-if="pdfExportState !== 'idle'">PDF: {{ pdfExportState }}</span>
      <span v-if="calendarLoadState === 'ready'">{{ calendarEventCount }} размещений событий · Пасха {{ calendarYear?.pascha.day }}.{{ calendarYear?.pascha.month }}.{{ calendarYear?.pascha.year }}</span>
      <span v-else>{{ selectedPage.width }} × {{ selectedPage.height }} мм · календарные данные: {{ calendarLoadState }}</span>
    </footer>
    <input
      ref="assetFileInput"
      class="visually-hidden"
      type="file"
      accept="image/*,.svg"
      @change="importSelectedAsset"
    />
    <input
      ref="projectFileInput"
      class="visually-hidden"
      type="file"
      accept=".kalendar,.json,.kalendar.json,application/json"
      @change="openProjectFile"
    />
    <input
      ref="foodMarkerFileInput"
      class="visually-hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      @change="importFoodMarkerAsset"
    />
    <input ref="fontFileInput" class="visually-hidden" type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf" @change="importCustomFont" />
    <input ref="iccProfileFileInput" class="visually-hidden" type="file" accept=".icc,.icm,application/vnd.iccprofile" @change="importIccProfile" />
  </div>
</template>
