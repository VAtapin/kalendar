<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import DocumentWorkspace from "./components/DocumentWorkspace.vue";
import DecorLibraryPanel from "./components/DecorLibraryPanel.vue";
import LayersPanel from "./components/LayersPanel.vue";
import ToolsPanel from "./components/ToolsPanel.vue";
import TextEffectsEditor from "./components/TextEffectsEditor.vue";
import FoodMarkerPackSelect from "./components/FoodMarkerPackSelect.vue";
import ApplicationHelpDialog, { type HelpDialogPage } from "./components/ApplicationHelpDialog.vue";
import PageThumbnail from "./components/PageThumbnail.vue";
import RecoveryDialog from "./components/RecoveryDialog.vue";
import WelcomePage from "./components/WelcomePage.vue";
import EmailVerificationDialog from "./components/EmailVerificationDialog.vue";
import SharedProjectDialog from "./components/SharedProjectDialog.vue";
import LinkResultDialog from "./components/LinkResultDialog.vue";
import ProgramSettingsDialog from "./components/ProgramSettingsDialog.vue";
import CalendarGridTemplateCard from "./components/CalendarGridTemplateCard.vue";
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
  CalendarLanguage,
  CalendarProject,
  CommemorationRankFilterId,
  CornerRadiiMm,
  DocumentAsset,
  ImageElement,
  InterfaceLanguage,
  MonasteryEvent,
  PageFormatId,
  PageModel,
  PageLayerNode,
  PageObjectLayer,
  PageOrientation,
  SvgElement,
} from "./document/types";
import {
  CALENDAR_LANGUAGE_OPTIONS,
  calendarMonthHeading,
  normalizeCalendarLanguage,
} from "./calendar/localization/calendar-language";
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
  foodMarkerPackPreviewSource,
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
  clearActiveProjectFileReference,
  loadActiveProjectFileReference,
  saveActiveProjectFileReference,
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
import {
  defaultGlobalCalendarGridTemplates,
  type GlobalCalendarGridTemplate,
} from "./templates/calendar-grid-presets";
import {
  calendarWorkshopBrandProtectedLayerIds,
  ensureCalendarWorkshopBranding,
  isCalendarWorkshopBrandElement,
} from "./document/branding";
import { compactProjectAssets } from "./document/project-assets";
import { ProjectHistoryCodec } from "./persistence/project-history";
import {
  SharedProjectApiError,
  confirmEmailVerification,
  copySharedProject,
  createGlobalCalendarGridTemplate,
  createSharedProject,
  deleteGlobalCalendarGridTemplate,
  heartbeatSharedProject,
  loadGlobalCalendarGridTemplates,
  loadUserProgramSettings,
  openSharedProject,
  releaseSharedProject,
  replaceSharedProjectInLocation,
  requestEmailVerification,
  saveSharedProject,
  saveUserProgramSettings,
  sharedProjectIdFromLocation,
  sharedProjectUrl,
  updateGlobalCalendarGridTemplate,
  uploadPdfExport,
  verificationTokenFromLocation,
} from "./collaboration/shared-project-client";
import type {
  PdfExportReady,
  SharedEditorPresence,
  SharedProjectLease,
  SharedProjectLeaseGranted,
} from "./collaboration/shared-project-types";
import { DECOR_LIBRARY_ITEMS, type DecorLibraryItem } from "./decor/decor-library";
import { recolorSvgMarkup, svgMarkupDataUrl } from "./decor/svg-recolor";
import { FONT_OPTIONS } from "./typography/font-catalog";
import {
  applyMonthMaster,
  cloneProjectForYear,
  describeMonthMasterApplication,
  updatePageCalendarYear,
} from "./templates/project-templates";
import {
  INTERFACE_LANGUAGE_STORAGE_KEY,
  INTERFACE_LANGUAGE_LOCALES,
  interfaceLanguage,
  setInterfaceLanguage,
  translateInterfaceText,
} from "./i18n/interface-language";

const project = ref(createBlankCalendarProject());
project.value.programSettings = { interfaceLanguage: interfaceLanguage.value };
const zoomPercent = ref(55);
const showGuides = ref(true);
const activeTool = ref<EditorTool>("selection");
const selectedLayerIds = ref(["layer-1"]);
const selectedPageId = ref(project.value.document.pages[0]?.id ?? "");
const openPageIds = ref<string[]>(selectedPageId.value ? [selectedPageId.value] : []);
const selectedElementId = ref<string>();
const assetFileInput = ref<HTMLInputElement>();
const layerMaskFileInput = ref<HTMLInputElement>();
const pendingLayerMaskTarget = ref<{ pageId: string; layerId: string }>();
const projectFileInput = ref<HTMLInputElement>();
const projectFileName = ref<string>();
const savedProjectFileSnapshot = ref<string>();
const foodMarkerFileInput = ref<HTMLInputElement>();
const fontFileInput = ref<HTMLInputElement>();
const iccProfileFileInput = ref<HTMLInputElement>();
const pendingFoodMarkerRule = ref<FoodRuleId>();
const MEBIBYTE = 1024 * 1024;
const MAX_PROJECT_FILE_BYTES = 100 * MEBIBYTE;
const MAX_IMAGE_FILE_BYTES = 50 * MEBIBYTE;
const MAX_SVG_FILE_BYTES = 10 * MEBIBYTE;
const MAX_FONT_FILE_BYTES = 20 * MEBIBYTE;
const MAX_ICC_FILE_BYTES = 20 * MEBIBYTE;
const MAX_RASTER_PIXELS = 80_000_000;
const activeDockPanel = ref<DockPanelId>("properties");
const DOCK_PANEL_DEFAULT_WIDTH_PX = 284;
const DOCK_PANEL_MIN_WIDTH_PX = 180;
const COMPACT_VIEWPORT_MAX_WIDTH_PX = 1000;
const EDITOR_MIN_WORKSPACE_WIDTH_PX = 640;
const EDITOR_RESIZER_WIDTH_PX = 7;
const dockPanelWidthPx = ref(DOCK_PANEL_DEFAULT_WIDTH_PX);
const viewportWidthPx = ref(typeof window === "undefined" ? 1440 : window.innerWidth);
const compactViewport = computed(() => viewportWidthPx.value <= COMPACT_VIEWPORT_MAX_WIDTH_PX);
const dockPanelResizing = ref(false);
let dockResizePointerId: number | undefined;
let dockResizeStartX = 0;
let dockResizeStartWidth = DOCK_PANEL_DEFAULT_WIDTH_PX;
const selectedTemplateId = ref<CalendarTemplateId>("editorial-photo");
const userProjectTemplates = ref<UserProjectTemplate[]>([]);
const userCalendarGridTemplates = ref<UserCalendarGridTemplate[]>([]);
const globalCalendarGridTemplates = ref<GlobalCalendarGridTemplate[]>(defaultGlobalCalendarGridTemplates());
const canManageGlobalGridTemplates = ref(false);
const globalGridTemplatesBusy = ref(false);
const globalGridTemplatesError = ref<string>();
const projectBackups = ref<ProjectBackup[]>([]);
const RECENT_PROJECTS_KEY = "orthodox-calendar-layout:recent-projects";
const recentProjectNames = ref<string[]>([]);
type ApplicationMenuId = "file" | "edit" | "layout" | "object" | "text" | "view" | "window" | "help";
type MenuCommandId =
  | "new-project" | "open-project" | "save-project" | "save-as-project" | "download-project" | "recovery" | "share-project" | "export-pdf" | "program-settings"
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
  | "toggle-tools" | "toggle-properties" | "toggle-library" | "toggle-layers" | "toggle-templates" | "toggle-pages" | "toggle-events" | "toggle-preflight" | "toggle-all-panels"
  | "help-guide" | "shortcuts" | "about";

interface WritableProjectFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface ProjectFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableProjectFile>;
  queryPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
}

interface ProjectPickerWindow extends Window {
  showSaveFilePicker?: (options: unknown) => Promise<ProjectFileHandle>;
  showOpenFilePicker?: (options: unknown) => Promise<ProjectFileHandle[]>;
}

let activeProjectFileHandle: ProjectFileHandle | undefined;
let projectFileReferenceUpdate: Promise<void> = Promise.resolve();
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
const helpDialogPage = ref<HelpDialogPage>();
const recoveryDialogOpen = ref(false);
const programSettingsOpen = ref(false);
const programSettingsBusy = ref(false);
const programSettingsError = ref<string>();
const welcomeVisible = ref(compactViewport.value || (!sharedProjectIdFromLocation() && !verificationTokenFromLocation()));
const hasAutosavedProject = ref(false);
const emailVerificationOpen = ref(false);
const emailVerificationBusy = ref(false);
const emailVerificationSentTo = ref<string>();
const emailVerificationError = ref<string>();
const developmentVerificationUrl = ref<string>();
type PendingVerifiedAction = "new" | "share" | "export" | "global-grid-templates";
const pendingVerifiedAction = ref<PendingVerifiedAction>();
const EMAIL_ACCESS_TOKEN_KEY = "orthodox-calendar-layout:verified-email-token";
const VERIFIED_EMAIL_KEY = "orthodox-calendar-layout:verified-email";
const PENDING_VERIFIED_ACTION_KEY = "orthodox-calendar-layout:pending-verified-action";
const SHARED_PROJECTS_KEY = "orthodox-calendar-layout:shared-projects";
const sharedRecentProjects = ref<Array<{ id: string; name: string }>>([]);
const sharedLease = ref<SharedProjectLease>();
const sharedAccessMode = ref<"none" | "loading" | "editing" | "locked" | "waiting" | "error">("none");
const sharedLockEditor = ref<SharedEditorPresence>();
const sharedAccessError = ref<string>();
const sharedActionBusy = ref(false);
const linkResult = ref<{ kind: "share" | "pdf"; url: string; detail?: string }>();
const editorSessionId = crypto.randomUUID();
const editorLabel = `Редактор ${editorSessionId.slice(0, 4).toUpperCase()}`;
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
  {
    label: "Декоративные кириллические",
    options: FONT_OPTIONS.filter(
      (option) => option.kind === "decorative" && (option.scriptSupport ?? "full-cyrillic") === "full-cyrillic",
    ),
  },
  {
    label: "Декоративные — неполная кириллица",
    options: FONT_OPTIONS.filter(
      (option) => option.kind === "decorative" && option.scriptSupport === "partial-cyrillic",
    ),
  },
  {
    label: "Декоративные — латиница",
    options: FONT_OPTIONS.filter(
      (option) => option.kind === "decorative" && option.scriptSupport === "latin",
    ),
  },
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
const historyCodec = new ProjectHistoryCodec();
let continuousEditSnapshot: string | undefined;
let continuousEditPageId: string | undefined;
let autosaveTimer: number | undefined;
let sharedSaveTimer: number | undefined;
let sharedHeartbeatTimer: number | undefined;
let sharedWaitTimer: number | undefined;
let sharedSaveInFlight: Promise<void> | undefined;
let sharedSaveRequested = false;
let sharedSaveShowNotice = false;
let sharedLastSavedSnapshot: string | undefined;
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
  templates: true,
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
const monthNames = computed(() => Array.from({ length: 12 }, (_, month) => {
  const label = new Intl.DateTimeFormat(INTERFACE_LANGUAGE_LOCALES[interfaceLanguage.value], { month: "long" })
    .format(new Date(Date.UTC(2027, month, 1)));
  return label.charAt(0).toLocaleUpperCase(INTERFACE_LANGUAGE_LOCALES[interfaceLanguage.value]) + label.slice(1);
}));
const foodRuleOptions = Object.values(FOOD_RULES).filter((rule) => rule.id !== "no-fast");
const activeFoodMarkerPack = computed(() => getFoodMarkerPack(project.value.foodMarkerPackId));
const calendarTemplatePresets = CALENDAR_TEMPLATE_PRESETS;
const commemorationFilterOptions = COMMEMORATION_FILTER_OPTIONS;
const fastingProfileOptions = Object.values(FASTING_PROFILES);
const calendarLanguageOptions = CALENDAR_LANGUAGE_OPTIONS;
const decorLibraryItems = DECOR_LIBRARY_ITEMS;

const selectedPage = computed(() => {
  const page =
    project.value.document.pages.find((item) => item.id === selectedPageId.value) ??
    project.value.document.pages[0];
  if (!page) throw new Error("Документ должен содержать хотя бы одну страницу");
  return page;
});
const openPages = computed(() => openPageIds.value.flatMap((pageId) => {
  const page = project.value.document.pages.find((item) => item.id === pageId);
  return page ? [page] : [];
}));
const selectedPageIndex = computed(() =>
  Math.max(0, project.value.document.pages.findIndex((page) => page.id === selectedPage.value.id)),
);
const selectedElement = computed(() =>
  selectedPage.value.elements.find((element) => element.id === selectedElementId.value),
);
const protectedBrandLayerIds = computed(() =>
  calendarWorkshopBrandProtectedLayerIds(selectedPage.value),
);
const protectedBrandLayerIdSet = computed(() => new Set(protectedBrandLayerIds.value));
const selectedElementIsProtectedBrand = computed(() =>
  isCalendarWorkshopBrandElement(selectedPage.value, selectedElement.value),
);
const selectionIncludesProtectedBrand = computed(() =>
  selectedElementIsProtectedBrand.value ||
  selectedLayerIds.value.some((layerId) => protectedBrandLayerIdSet.value.has(layerId)),
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
  () => (visibleDockPanels.value.length > 0 || panelVisibility.value.templates) && !chromePanelsHidden.value,
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
  const protectedSelection = selectionIncludesProtectedBrand.value;
  const protectedElementSelection = selectedLayerElements.value.some((element) =>
    isCalendarWorkshopBrandElement(selectedPage.value, element),
  );
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
        { command: "recovery", label: "Восстановление…", disabled: projectBackups.value.length === 0 },
        { command: "program-settings", label: "Настройки программы…" },
        { separator: true },
        { command: "share-project", label: sharedLease.value ? "Ссылка для совместной работы…" : "Поделиться для совместной работы…" },
        { separator: true },
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
        { command: "duplicate", label: "Дублировать", shortcut: "Ctrl+D", disabled: !selectedElement.value || protectedSelection },
        { command: "delete", label: "Удалить", shortcut: "Delete", disabled: !hasSelection || protectedSelection },
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
        { command: "bring-front", label: "На самый верх", disabled: !hasSelection || protectedSelection },
        { command: "send-back", label: "На самый низ", disabled: !hasSelection || protectedSelection },
        { command: "group", label: "Объединить слои в папку", disabled: selectedLayerIds.value.length < 2 || protectedSelection },
        { separator: true },
        { command: "align-object-left", label: "Выровнять по левому краю", disabled: selectedLayerElements.value.length < 2 || protectedElementSelection },
        { command: "align-object-center", label: "Выровнять по центру горизонтально", disabled: selectedLayerElements.value.length < 2 || protectedElementSelection },
        { command: "align-object-right", label: "Выровнять по правому краю", disabled: selectedLayerElements.value.length < 2 || protectedElementSelection },
        { command: "align-object-top", label: "Выровнять по верхнему краю", disabled: selectedLayerElements.value.length < 2 || protectedElementSelection },
        { command: "align-object-middle", label: "Выровнять по центру вертикально", disabled: selectedLayerElements.value.length < 2 || protectedElementSelection },
        { command: "align-object-bottom", label: "Выровнять по нижнему краю", disabled: selectedLayerElements.value.length < 2 || protectedElementSelection },
        { command: "distribute-horizontal", label: "Распределить по горизонтали", disabled: selectedLayerElements.value.length < 3 || protectedElementSelection },
        { command: "distribute-vertical", label: "Распределить по вертикали", disabled: selectedLayerElements.value.length < 3 || protectedElementSelection },
        { separator: true },
        { command: "toggle-lock", label: "Блокировать / разблокировать", disabled: !hasSelection || protectedSelection },
        { command: "toggle-visible", label: "Показать / скрыть", disabled: !hasSelection || protectedSelection },
        { command: "duplicate", label: "Дублировать", disabled: !selectedElement.value || protectedSelection },
        { command: "delete", label: "Удалить", disabled: !hasSelection || protectedSelection },
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
        { command: "toggle-templates", label: "Шаблоны", checked: panelVisibility.value.templates },
        { command: "toggle-pages", label: "Страницы", checked: panelVisibility.value.pages },
        { command: "toggle-events", label: "События монастыря", checked: panelVisibility.value.events },
        { command: "toggle-preflight", label: "Предпечатная проверка", checked: panelVisibility.value.preflight },
        { separator: true },
        { command: "toggle-all-panels", label: chromePanelsHidden.value ? "Показать все панели" : "Скрыть все панели", shortcut: "Tab" },
      ],
    },
    {
      id: "help",
      label: "Помощь",
      items: [
        { command: "help-guide", label: "Как пользоваться?" },
        { command: "shortcuts", label: "Горячие клавиши…" },
        { separator: true },
        { command: "about", label: "О программе" },
      ],
    },
  ];
});

function serializeEditableProject(): string {
  return historyCodec.serialize(project.value);
}

function clearProjectHistory(): void {
  undoStack.value = [];
  redoStack.value = [];
  historyCodec.clear();
}

function pruneProjectHistoryAssets(): void {
  historyCodec.prune([
    ...undoStack.value.map((entry) => entry.snapshot),
    ...redoStack.value.map((entry) => entry.snapshot),
    ...(continuousEditSnapshot ? [continuousEditSnapshot] : []),
  ], project.value);
}

function mutateProject<T>(label: string, mutation: () => T): T {
  const before = serializeEditableProject();
  const result = mutation();
  compactProjectAssets(project.value);
  const after = serializeEditableProject();
  if (before !== after) {
    undoStack.value.push({ snapshot: before, label, pageId: selectedPageId.value });
    if (undoStack.value.length > 40) undoStack.value.shift();
    redoStack.value = [];
    pruneProjectHistoryAssets();
  }
  return result;
}

function restoreProjectSnapshot(snapshot: string, pageId?: string): void {
  const currentProgramSettings = project.value.programSettings;
  const restored = normalizeCalendarProject(historyCodec.deserialize(snapshot));
  restored.programSettings = currentProgramSettings;
  ensureCalendarWorkshopBranding(restored);
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
  pruneProjectHistoryAssets();
  operationNotice.value = `Отменено: ${entry.label}`;
}

function redo(): void {
  const entry = redoStack.value.pop();
  if (!entry) return;
  undoStack.value.push({ snapshot: serializeEditableProject(), label: entry.label, pageId: selectedPageId.value });
  restoreProjectSnapshot(entry.snapshot, entry.pageId);
  pruneProjectHistoryAssets();
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
  pruneProjectHistoryAssets();
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

function verifiedAccessToken(): string | undefined {
  return localStorage.getItem(EMAIL_ACCESS_TOKEN_KEY) ?? undefined;
}

function confirmInterface(message: string): boolean {
  return window.confirm(translateInterfaceText(message));
}

function promptInterface(message: string, defaultValue?: string): string | null {
  return window.prompt(translateInterfaceText(message), defaultValue);
}

function applyInterfaceLanguage(language: InterfaceLanguage, updateProject = true): void {
  setInterfaceLanguage(language);
  if (updateProject) project.value.programSettings = { interfaceLanguage: language };
}

function applyProjectInterfaceLanguage(calendarProject: CalendarProject): void {
  applyInterfaceLanguage(calendarProject.programSettings?.interfaceLanguage ?? "ru", false);
}

async function loadVerifiedProgramSettings(): Promise<void> {
  const accessToken = verifiedAccessToken();
  if (!accessToken) return;
  try {
    const settings = await loadUserProgramSettings(accessToken);
    applyInterfaceLanguage(settings.interfaceLanguage);
  } catch {
    // A local preference remains usable while the server is temporarily down.
  }
}

async function refreshGlobalCalendarGridTemplates(): Promise<void> {
  globalGridTemplatesBusy.value = true;
  globalGridTemplatesError.value = undefined;
  try {
    const result = await loadGlobalCalendarGridTemplates(verifiedAccessToken());
    if (result.templates.length >= 5) globalCalendarGridTemplates.value = result.templates;
    canManageGlobalGridTemplates.value = result.canManage;
  } catch (error) {
    // The five bundled layouts remain available even while the server is down.
    canManageGlobalGridTemplates.value = false;
    globalGridTemplatesError.value = error instanceof Error ? error.message : String(error);
  } finally {
    globalGridTemplatesBusy.value = false;
  }
}

async function saveProgramSettingsFromDialog(language: InterfaceLanguage): Promise<void> {
  programSettingsBusy.value = true;
  programSettingsError.value = undefined;
  applyInterfaceLanguage(language);
  try {
    const accessToken = verifiedAccessToken();
    if (accessToken) await saveUserProgramSettings(accessToken, { interfaceLanguage: language });
    programSettingsOpen.value = false;
    operationNotice.value = accessToken
      ? "Настройки программы сохранены на сервере и в календаре"
      : "Настройки программы сохранены на этом компьютере и в календаре";
  } catch (error) {
    if (error instanceof SharedProjectApiError && error.status === 401) {
      localStorage.removeItem(EMAIL_ACCESS_TOKEN_KEY);
      localStorage.removeItem(VERIFIED_EMAIL_KEY);
      programSettingsOpen.value = false;
      operationNotice.value = "Настройки сохранены локально; для сохранения на сервере подтвердите e-mail";
      return;
    }
    programSettingsError.value = error instanceof Error ? error.message : String(error);
  } finally {
    programSettingsBusy.value = false;
  }
}

async function changeInterfaceLanguageFromWelcome(language: InterfaceLanguage): Promise<void> {
  applyInterfaceLanguage(language);
  const accessToken = verifiedAccessToken();
  if (!accessToken) return;
  try {
    await saveUserProgramSettings(accessToken, { interfaceLanguage: language });
  } catch {
    // The explicit local choice remains active and can be synchronized later.
  }
}

function requestVerifiedAction(action: PendingVerifiedAction): boolean {
  if (verifiedAccessToken()) return true;
  pendingVerifiedAction.value = action;
  localStorage.setItem(PENDING_VERIFIED_ACTION_KEY, action);
  emailVerificationSentTo.value = undefined;
  emailVerificationError.value = undefined;
  developmentVerificationUrl.value = undefined;
  emailVerificationOpen.value = true;
  return false;
}

async function submitEmailVerification(email: string): Promise<void> {
  emailVerificationBusy.value = true;
  emailVerificationError.value = undefined;
  try {
    const result = await requestEmailVerification(email);
    emailVerificationSentTo.value = email;
    developmentVerificationUrl.value = result.developmentVerificationUrl;
  } catch (error) {
    emailVerificationError.value = error instanceof Error ? error.message : String(error);
  } finally {
    emailVerificationBusy.value = false;
  }
}

function closeEmailVerification(): void {
  if (emailVerificationBusy.value) return;
  emailVerificationOpen.value = false;
}

function rememberSharedProject(projectId: string, name: string): void {
  sharedRecentProjects.value = [
    { id: projectId, name },
    ...sharedRecentProjects.value.filter((item) => item.id !== projectId),
  ].slice(0, 12);
  localStorage.setItem(SHARED_PROJECTS_KEY, JSON.stringify(sharedRecentProjects.value));
}

function loadSharedProjectHistory(): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARED_PROJECTS_KEY) ?? "[]") as unknown;
    sharedRecentProjects.value = Array.isArray(parsed)
      ? parsed.filter((item): item is { id: string; name: string } => Boolean(
        item && typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { name?: unknown }).name === "string",
      )).slice(0, 12)
      : [];
  } catch {
    sharedRecentProjects.value = [];
  }
}

function stopSharedTimers(): void {
  if (sharedSaveTimer !== undefined) window.clearTimeout(sharedSaveTimer);
  if (sharedHeartbeatTimer !== undefined) window.clearInterval(sharedHeartbeatTimer);
  if (sharedWaitTimer !== undefined) window.clearTimeout(sharedWaitTimer);
  sharedSaveTimer = undefined;
  sharedHeartbeatTimer = undefined;
  sharedWaitTimer = undefined;
}

async function loadProjectForSharedEditing(sharedProject: CalendarProject): Promise<void> {
  const normalized = normalizeCalendarProject(sharedProject);
  ensureCalendarWorkshopBranding(normalized);
  project.value = normalized;
  applyProjectInterfaceLanguage(normalized);
  await registerProjectFonts(project.value);
  detachActiveProjectFile();
  resetPageTabs();
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
  clearProjectHistory();
  await loadCalendarData();
  await saveAutosaveNow();
}

function establishSharedLease(result: SharedProjectLeaseGranted): void {
  stopSharedTimers();
  sharedLease.value = {
    projectId: result.projectId,
    leaseToken: result.leaseToken,
    revision: result.revision,
    expiresAt: result.expiresAt,
  };
  sharedLastSavedSnapshot = serializeEditableProject();
  sharedAccessMode.value = "editing";
  sharedAccessError.value = undefined;
  sharedLockEditor.value = undefined;
  replaceSharedProjectInLocation(result.projectId);
  rememberSharedProject(result.projectId, project.value.name);
  sharedHeartbeatTimer = window.setInterval(() => void refreshSharedLease(), 15_000);
  operationNotice.value = "Общий календарь открыт для редактирования";
}

async function saveSharedProjectNow(showNotice = false): Promise<void> {
  if (!sharedLease.value || sharedAccessMode.value !== "editing") return;
  sharedSaveRequested = true;
  sharedSaveShowNotice ||= showNotice;
  if (!sharedSaveInFlight) {
    sharedSaveInFlight = (async () => {
      // At most one large immutable project copy is kept while a save is in
      // flight. Further edits coalesce into one latest follow-up save.
      while (sharedSaveRequested) {
        sharedSaveRequested = false;
        const shouldShowNotice = sharedSaveShowNotice;
        sharedSaveShowNotice = false;
        if (!sharedLease.value || sharedAccessMode.value !== "editing") return;
        const snapshot = serializeEditableProject();
        if (snapshot === sharedLastSavedSnapshot) continue;
        const leaseAtStart = sharedLease.value;
        const projectAtStart = createPersistentProjectSnapshot(project.value);
        try {
          const saved = await saveSharedProject(leaseAtStart, projectAtStart);
          if (sharedLease.value?.projectId !== leaseAtStart.projectId) return;
          sharedLease.value.revision = saved.revision;
          sharedLastSavedSnapshot = snapshot;
          if (shouldShowNotice) operationNotice.value = "Изменения сохранены в общем календаре";
        } catch (error) {
          operationNotice.value = `Общий календарь не сохранён: ${error instanceof Error ? error.message : String(error)}`;
          if (error instanceof SharedProjectApiError && [403, 409].includes(error.status)) {
            stopSharedTimers();
            sharedLease.value = undefined;
            sharedAccessMode.value = "error";
            sharedAccessError.value = "Право редактирования потеряно. Проверьте доступ к календарю ещё раз.";
          }
          return;
        }
      }
    })().finally(() => { sharedSaveInFlight = undefined; });
  }
  await sharedSaveInFlight;
}

function scheduleSharedSave(): void {
  if (sharedAccessMode.value !== "editing" || !sharedLease.value) return;
  if (sharedSaveTimer !== undefined) window.clearTimeout(sharedSaveTimer);
  sharedSaveTimer = window.setTimeout(() => void saveSharedProjectNow(), 1_200);
}

async function refreshSharedLease(): Promise<void> {
  const lease = sharedLease.value;
  if (!lease) return;
  try {
    const refreshed = await heartbeatSharedProject(lease);
    if (sharedLease.value?.projectId === lease.projectId) sharedLease.value.expiresAt = refreshed.expiresAt;
  } catch (error) {
    if (error instanceof SharedProjectApiError && [403, 409].includes(error.status)) {
      stopSharedTimers();
      sharedLease.value = undefined;
      sharedAccessMode.value = "error";
      sharedAccessError.value = "Сервер больше не подтверждает право редактирования. Возможно, документ уже открыт в другом месте.";
    } else {
      operationNotice.value = "Нет связи с сервером совместной работы; повторяем автоматически";
    }
  }
}

async function leaveSharedProject(removeFromAddress = true): Promise<void> {
  stopSharedTimers();
  const lease = sharedLease.value;
  if (lease) {
    await saveSharedProjectNow();
    void releaseSharedProject(lease).catch(() => undefined);
  }
  sharedLease.value = undefined;
  sharedAccessMode.value = "none";
  sharedLockEditor.value = undefined;
  sharedAccessError.value = undefined;
  sharedLastSavedSnapshot = undefined;
  sharedSaveRequested = false;
  sharedSaveShowNotice = false;
  if (removeFromAddress) replaceSharedProjectInLocation();
}

async function attemptOpenSharedProject(projectId: string, loadPreview = true): Promise<void> {
  if (sharedWaitTimer !== undefined) window.clearTimeout(sharedWaitTimer);
  try {
    const result = await openSharedProject(projectId, editorSessionId, editorLabel);
    if (loadPreview || result.status === "editing") await loadProjectForSharedEditing(result.project);
    if (result.status === "editing") {
      establishSharedLease(result);
      return;
    }
    sharedLease.value = undefined;
    sharedLockEditor.value = result.editor;
    sharedAccessMode.value = sharedAccessMode.value === "waiting" ? "waiting" : "locked";
    if (sharedAccessMode.value === "waiting") {
      sharedWaitTimer = window.setTimeout(() => void attemptOpenSharedProject(projectId, false), 5_000);
    }
  } catch (error) {
    sharedAccessMode.value = "error";
    sharedAccessError.value = error instanceof Error ? error.message : String(error);
  }
}

async function openSharedProjectById(projectId: string): Promise<void> {
  if (compactViewport.value) {
    welcomeVisible.value = true;
    return;
  }
  await leaveSharedProject(false);
  welcomeVisible.value = false;
  replaceSharedProjectInLocation(projectId);
  sharedAccessMode.value = "loading";
  await attemptOpenSharedProject(projectId);
}

function waitForSharedProject(): void {
  const projectId = sharedProjectIdFromLocation();
  if (!projectId) return;
  sharedAccessMode.value = "waiting";
  void attemptOpenSharedProject(projectId, false);
}

async function copyCurrentSharedProject(): Promise<void> {
  const projectId = sharedProjectIdFromLocation();
  if (!projectId) return;
  sharedActionBusy.value = true;
  try {
    const result = await copySharedProject(projectId, editorSessionId, editorLabel);
    await loadProjectForSharedEditing(result.project);
    establishSharedLease(result);
    linkResult.value = { kind: "share", url: result.shareUrl, detail: "Создана независимая копия. Изменения исходного календаря в неё больше не попадут." };
  } catch (error) {
    sharedAccessMode.value = "error";
    sharedAccessError.value = error instanceof Error ? error.message : String(error);
  } finally {
    sharedActionBusy.value = false;
  }
}

async function shareCurrentProject(): Promise<void> {
  if (!requestVerifiedAction("share")) return;
  ensureCalendarWorkshopBranding(project.value);
  if (sharedLease.value) {
    await saveSharedProjectNow(true);
    linkResult.value = { kind: "share", url: sharedProjectUrl(sharedLease.value.projectId) };
    return;
  }
  sharedActionBusy.value = true;
  operationNotice.value = "Сохраняем календарь на сервере…";
  try {
    const result = await createSharedProject(
      createPersistentProjectSnapshot(project.value),
      verifiedAccessToken()!,
      editorSessionId,
      editorLabel,
    );
    establishSharedLease(result);
    linkResult.value = { kind: "share", url: result.shareUrl };
  } catch (error) {
    if (error instanceof SharedProjectApiError && error.code === "email_required") {
      localStorage.removeItem(EMAIL_ACCESS_TOKEN_KEY);
      requestVerifiedAction("share");
    } else operationNotice.value = `Не удалось создать общую ссылку: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sharedActionBusy.value = false;
  }
}

async function copyResultLink(): Promise<void> {
  if (!linkResult.value) return;
  try {
    await navigator.clipboard.writeText(linkResult.value.url);
    operationNotice.value = "Ссылка скопирована";
  } catch {
    operationNotice.value = "Выделите ссылку и скопируйте её вручную";
  }
}

function continueFromWelcome(): void {
  welcomeVisible.value = false;
}

async function openLocalProjectFromWelcome(): Promise<void> {
  await requestProjectFile();
}

async function showWelcomePage(): Promise<void> {
  await leaveSharedProject();
  welcomeVisible.value = true;
}

function retrySharedProject(): void {
  const projectId = sharedProjectIdFromLocation();
  if (!projectId) return;
  sharedAccessMode.value = "loading";
  void attemptOpenSharedProject(projectId, false);
}

async function initializeProject(): Promise<void> {
  try {
    const restored = await loadAutosavedProject();
    hasAutosavedProject.value = Boolean(restored);
    let savedPageId: string | undefined;
    let savedOpenPageIds: string[] | undefined;
    let savedDockPanel: DockPanelId | undefined;
    try {
      const editorState = JSON.parse(localStorage.getItem(EDITOR_STATE_KEY) ?? "{}") as {
        pageId?: string;
        openPageIds?: string[];
        dockPanel?: DockPanelId;
        dockPanelWidthPx?: number;
        zoomPercent?: number;
        showGuides?: boolean;
        selectedTemplateId?: CalendarTemplateId;
        panelVisibility?: Partial<typeof panelVisibility.value>;
      };
      savedPageId = editorState.pageId;
      savedOpenPageIds = Array.isArray(editorState.openPageIds)
        ? editorState.openPageIds.filter((pageId): pageId is string => typeof pageId === "string")
        : undefined;
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
      ensureCalendarWorkshopBranding(project.value);
      operationNotice.value = "Восстановлено последнее автосохранение";
      await registerProjectFonts(project.value);
      try {
        const storedFile = await loadActiveProjectFileReference<ProjectFileHandle>();
        if (storedFile?.handle) {
          activeProjectFileHandle = storedFile.handle;
          projectFileName.value = storedFile.name;
          // The autosave may contain edits made after the last explicit file
          // save, so keep the restored document marked as changed.
          savedProjectFileSnapshot.value = undefined;
        }
      } catch {
        // Browsers without serializable File System Access handles still keep
        // the handle for the lifetime of the current editor session.
      }
    }
    selectedPageId.value =
      project.value.document.pages.find((page) => page.id === savedPageId)?.id ??
      project.value.document.pages.find((page) => page.id === selectedPageId.value)?.id ??
      project.value.document.pages[0]?.id ??
      "";
    const availablePageIds = new Set(project.value.document.pages.map((page) => page.id));
    openPageIds.value = [...new Set((savedOpenPageIds ?? []).filter((pageId) => availablePageIds.has(pageId)))];
    if (selectedPageId.value && !openPageIds.value.includes(selectedPageId.value)) {
      openPageIds.value.push(selectedPageId.value);
    }
    if (savedDockPanel && (savedDockPanel === "templates" || dockPanels.some((panel) => panel.id === savedDockPanel))) {
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

async function runPendingVerifiedAction(action: PendingVerifiedAction | undefined): Promise<void> {
  if (!action) return;
  pendingVerifiedAction.value = undefined;
  localStorage.removeItem(PENDING_VERIFIED_ACTION_KEY);
  if (action === "new") await createNewProject();
  else if (action === "share") await shareCurrentProject();
  else if (action === "export") await exportPrintPdf();
  else {
    activeDockPanel.value = "templates";
    await refreshGlobalCalendarGridTemplates();
    operationNotice.value = canManageGlobalGridTemplates.value
      ? "Управление общими макетами открыто"
      : "Этот e-mail не является владельцем мастерской";
  }
}

async function initializeApplication(): Promise<void> {
  loadSharedProjectHistory();
  await initializeProject();
  const verificationToken = verificationTokenFromLocation();
  if (verificationToken) {
    try {
      const confirmed = await confirmEmailVerification(verificationToken);
      localStorage.setItem(EMAIL_ACCESS_TOKEN_KEY, confirmed.accessToken);
      localStorage.setItem(VERIFIED_EMAIL_KEY, confirmed.email);
      try {
        if (localStorage.getItem(INTERFACE_LANGUAGE_STORAGE_KEY)) {
          await saveUserProgramSettings(confirmed.accessToken, {
            interfaceLanguage: interfaceLanguage.value,
          });
        } else {
          const settings = await loadUserProgramSettings(confirmed.accessToken);
          applyInterfaceLanguage(settings.interfaceLanguage);
        }
      } catch {
        // E-mail verification remains valid if preference synchronization is
        // temporarily unavailable; the local language is kept and retried later.
      }
      operationNotice.value = `E-mail ${confirmed.email} подтверждён`;
      replaceSharedProjectInLocation(sharedProjectIdFromLocation());
      const pending = localStorage.getItem(PENDING_VERIFIED_ACTION_KEY) as PendingVerifiedAction | null;
      if (!compactViewport.value) await runPendingVerifiedAction(pending ?? undefined);
      else welcomeVisible.value = true;
    } catch (error) {
      welcomeVisible.value = true;
      operationNotice.value = `Ссылка подтверждения недействительна: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    await loadVerifiedProgramSettings();
  }
  await refreshGlobalCalendarGridTemplates();
  const projectId = sharedProjectIdFromLocation();
  if (projectId && sharedAccessMode.value === "none" && !compactViewport.value) {
    await openSharedProjectById(projectId);
  }
}

function projectFileBlob(): Blob {
  ensureCalendarWorkshopBranding(project.value);
  const persistentProject = { ...project.value, calendarData: null } as CalendarProject;
  return new Blob([JSON.stringify({
    format: "orthodox-calendar-project",
    archiveVersion: 1,
    savedAt: new Date().toISOString(),
    project: persistentProject,
    manifest: {
      embeddedAssetCount: project.value.assets.filter((asset) => asset.source.startsWith("data:")).length,
      embeddedFontCount: project.value.customFonts?.length ?? 0,
    },
  }, null, 2)], {
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

async function ensureProjectFileWritePermission(handle: ProjectFileHandle): Promise<void> {
  if (!handle.queryPermission) return;
  let permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission === "prompt" && handle.requestPermission) {
    permission = await handle.requestPermission({ mode: "readwrite" });
  }
  if (permission !== "granted") {
    throw new Error("Нет разрешения на запись в выбранный файл. Используйте «Сохранить как…» или разрешите запись.");
  }
}

async function rememberActiveProjectFile(handle: ProjectFileHandle): Promise<void> {
  projectFileReferenceUpdate = projectFileReferenceUpdate
    .then(() => saveActiveProjectFileReference(handle, handle.name))
    .catch(() => undefined);
  await projectFileReferenceUpdate;
}

function detachActiveProjectFile(): void {
  activeProjectFileHandle = undefined;
  projectFileName.value = undefined;
  savedProjectFileSnapshot.value = undefined;
  projectFileReferenceUpdate = projectFileReferenceUpdate
    .then(() => clearActiveProjectFileReference())
    .catch(() => undefined);
}

async function writeProjectFile(handle: ProjectFileHandle): Promise<void> {
  await ensureProjectFileWritePermission(handle);
  const writable = await handle.createWritable();
  await writable.write(projectFileBlob());
  await writable.close();
  activeProjectFileHandle = handle;
  projectFileName.value = handle.name;
  savedProjectFileSnapshot.value = serializeEditableProject();
  rememberProjectName(handle.name);
  await rememberActiveProjectFile(handle);
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

async function exportPrintPdf(): Promise<void> {
  if (!requestVerifiedAction("export")) return;
  if (!displayedCalendarYear.value) {
    operationNotice.value = "PDF пока не создан: календарные данные ещё загружаются";
    return;
  }
  pdfExportState.value = "exporting";
  operationNotice.value = `Формируется PDF: ${project.value.document.pages.length} стр.`;
  try {
    ensureCalendarWorkshopBranding(project.value);
    const { collectBundledFontFamilies, exportCalendarProjectPdf, loadPdfFontFiles } = await import("./export/pdf-exporter");
    const snapshot = createPersistentProjectSnapshot(project.value);
    const fonts = await loadPdfFontFiles("/fonts", collectBundledFontFamilies(snapshot));
    const result = await exportCalendarProjectPdf(
      snapshot,
      displayedCalendarYear.value,
      fonts,
    );
    const safeName = project.value.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const fileName = `${safeName}-${project.value.year}-print.pdf`;
    // Blob accepts the exporter buffer directly. Uint8Array.from used to make
    // another full in-memory copy, which was particularly costly for 100+ MB PDFs.
    const pdfBlob = new Blob([result.bytes as BlobPart], { type: "application/pdf" });
    operationNotice.value = `PDF сформирован; передаём на сервер: 0%`;
    const ready: PdfExportReady = await uploadPdfExport(
      pdfBlob,
      fileName,
      verifiedAccessToken()!,
      (percent) => { operationNotice.value = `PDF сформирован; передаём на сервер: ${percent}%`; },
    );
    pdfExportState.value = "ready";
    linkResult.value = {
      kind: "pdf",
      url: ready.downloadUrl,
      detail: `${(ready.size / 1024 / 1024).toFixed(1)} МБ${result.warnings.length ? ` · предпечатных предупреждений: ${result.warnings.length}` : " · без предпечатных предупреждений"}`,
    };
    operationNotice.value = "PDF сохранён на сервере; ссылка на скачивание готова";
  } catch (error) {
    pdfExportState.value = "error";
    if (error instanceof SharedProjectApiError && error.code === "email_required") {
      localStorage.removeItem(EMAIL_ACCESS_TOKEN_KEY);
      requestVerifiedAction("export");
    }
    operationNotice.value = `Ошибка PDF: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function selectPreflightIssue(item: PreflightIssue): void {
  selectPage(item.pageId);
  if (item.elementId) selectElement(item.elementId);
  operationNotice.value = item.message;
}

async function loadProjectFromFile(file: File, handle?: ProjectFileHandle): Promise<void> {
  assertFileSize(file, MAX_PROJECT_FILE_BYTES, "Файл календаря");
  await leaveSharedProject();
  await createRecoveryPoint(`Перед открытием ${file.name}`);
  const candidate: unknown = JSON.parse(await file.text());
  const loadedProject = parseProjectArchive(candidate);
  if (!loadedProject) throw new Error("Неподдерживаемый формат проекта");
  project.value = loadedProject;
  applyProjectInterfaceLanguage(loadedProject);
  ensureCalendarWorkshopBranding(project.value);
  await registerProjectFonts(project.value);
  resetPageTabs();
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
  clearProjectHistory();
  activeProjectFileHandle = handle;
  projectFileName.value = file.name;
  savedProjectFileSnapshot.value = serializeEditableProject();
  if (handle) await rememberActiveProjectFile(handle);
  else {
    projectFileReferenceUpdate = projectFileReferenceUpdate
      .then(() => clearActiveProjectFileReference())
      .catch(() => undefined);
  }
  rememberProjectName(file.name);
  await loadCalendarData();
  await saveAutosaveNow();
  hasAutosavedProject.value = true;
  welcomeVisible.value = false;
  operationNotice.value = `Открыт файл проекта: ${file.name}`;
}

async function requestProjectFile(): Promise<void> {
  if (
    savedProjectFileSnapshot.value !== serializeEditableProject() &&
    project.value.document.pages.some((page) => page.elements.length > 0) &&
    !confirmInterface("Открыть другой проект? Несохранённые в файл изменения текущего проекта будут потеряны.")
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
  if (!requestVerifiedAction("new")) return;
  if (
    project.value.document.pages.some((page) =>
      page.elements.some((element) => !isCalendarWorkshopBrandElement(page, element)),
    ) &&
    !confirmInterface("Создать новый проект? Текущий проект будет закрыт. Если он ещё не сохранён в файл, сначала нажмите «Сохранить как…».")
  ) return;
  await leaveSharedProject();
  await createRecoveryPoint("Перед созданием нового проекта");
  project.value = createBlankCalendarProject(new Date().getFullYear() + 1);
  project.value.programSettings = { interfaceLanguage: interfaceLanguage.value };
  detachActiveProjectFile();
  resetPageTabs();
  selectedElementId.value = undefined;
  selectedLayerIds.value = ["layer-1"];
  clearProjectHistory();
  hasAutosavedProject.value = true;
  welcomeVisible.value = false;
  void loadCalendarData();
  operationNotice.value = "Создан новый проект";
}

function resetPageTabs(pageId = project.value.document.pages[0]?.id ?? ""): void {
  selectedPageId.value = pageId;
  openPageIds.value = pageId ? [pageId] : [];
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
}

function selectPage(pageId: string): void {
  if (!project.value.document.pages.some((page) => page.id === pageId)) return;
  if (!openPageIds.value.includes(pageId)) openPageIds.value = [...openPageIds.value, pageId];
  selectedPageId.value = pageId;
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
}

function closePageTab(pageId: string): void {
  const tabIndex = openPageIds.value.indexOf(pageId);
  if (tabIndex < 0) return;
  const wasActive = selectedPageId.value === pageId;
  const remaining = openPageIds.value.filter((id) => id !== pageId);
  openPageIds.value = remaining;

  if (!wasActive) return;
  const nextPageId = remaining[Math.min(tabIndex, remaining.length - 1)];
  if (nextPageId) {
    selectedPageId.value = nextPageId;
  } else {
    selectedPageId.value = "";
    activateDockPanel("pages");
  }
  selectedElementId.value = undefined;
  selectedLayerIds.value = [];
  operationNotice.value = "Вкладка закрыта; страница осталась в календаре";
}

async function applyFullCalendarTemplate(): Promise<void> {
  if (
    project.value.document.pages.some((page) =>
      page.elements.some((element) => !isCalendarWorkshopBrandElement(page, element)),
    ) &&
    !confirmInterface("Заменить все текущие страницы новой обложкой и 12 месяцами? Изменённые страницы будут удалены. После создания действие можно отменить через Ctrl+Z.")
  ) return;
  await createRecoveryPoint("Перед заменой страниц полным шаблоном");
  mutateProject("Создание полного календаря", () => {
    project.value.document.pages = createFullCalendarTemplate(
      selectedPage.value.formatId,
      selectedPage.value.orientation,
      project.value.year,
      project.value.publisherProfile.name,
      selectedTemplateId.value,
      project.value.calendarLanguage,
    );
  });
  resetPageTabs();
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
      undefined,
      project.value.calendarLanguage,
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
    ensureCalendarWorkshopBranding(project.value);
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
    const oldYear = project.value.year;
    project.value.year = value;
    project.value.document.pages.forEach((page) => updatePageCalendarYear(page, oldYear, value, project.value.calendarLanguage));
  });
  void loadCalendarData();
  operationNotice.value = `Календарь пересчитан на ${value} год`;
}

function updateCalendarLanguage(event: Event): void {
  const language = normalizeCalendarLanguage((event.target as HTMLSelectElement).value) as CalendarLanguage;
  if (language === project.value.calendarLanguage) return;
  mutateProject("Изменение языка календаря", () => {
    project.value.calendarLanguage = language;
    for (const page of project.value.document.pages) {
      if (page.kind !== "month") continue;
      const month = page.elements.find((element) => element.type === "calendar-grid")?.month;
      if (month) page.name = calendarMonthHeading(month, project.value.year, language);
    }
  });
  operationNotice.value = `Язык календаря: ${calendarLanguageOptions.find((item) => item.id === language)?.label ?? language}`;
}

function findLayer(layerId: string) {
  return findLayerLocation(selectedPage.value, layerId)?.node;
}

function rejectProtectedBrandChange(): void {
  operationNotice.value = "Фирменный знак обязателен: он всегда виден, заблокирован и находится выше остальных слоёв";
}

function isProtectedBrandLayer(layerId: string | undefined): boolean {
  return Boolean(layerId && protectedBrandLayerIdSet.value.has(layerId));
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
  if (selectionIncludesProtectedBrand.value) {
    rejectProtectedBrandChange();
    return;
  }
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
  if (isProtectedBrandLayer(sourceId) || isProtectedBrandLayer(targetId)) {
    rejectProtectedBrandChange();
    return;
  }
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
  if (isProtectedBrandLayer(layerId)) {
    rejectProtectedBrandChange();
    return;
  }
  const layer = findLayer(layerId);
  if (layer) mutateProject("Переименование слоя", () => (layer.name = name));
}

function deleteSelection(): void {
  const ids = selectedElement.value
    ? [selectedElement.value.layerId]
    : [...selectedLayerIds.value];
  if (ids.length === 0) return;
  if (ids.some((id) => isProtectedBrandLayer(id))) {
    rejectProtectedBrandChange();
    return;
  }
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
  if (isProtectedBrandLayer(nodeId)) {
    rejectProtectedBrandChange();
    return;
  }
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
  if (selectedLayerElements.value.some((element) => isCalendarWorkshopBrandElement(selectedPage.value, element))) {
    rejectProtectedBrandChange();
    return;
  }
  mutateProject("Выравнивание объектов", () => alignElements(selectedLayerElements.value, mode));
  operationNotice.value = `Выровнено объектов: ${selectedLayerElements.value.length}`;
}

function distributeSelection(mode: DistributeMode): void {
  if (selectedLayerElements.value.length < 3) return;
  if (selectedLayerElements.value.some((element) => isCalendarWorkshopBrandElement(selectedPage.value, element))) {
    rejectProtectedBrandChange();
    return;
  }
  mutateProject("Распределение объектов", () => distributeElements(selectedLayerElements.value, mode));
  operationNotice.value = `Распределено объектов: ${selectedLayerElements.value.length}`;
}

function duplicateSelection(): void {
  const elementId = selectedElementId.value;
  if (!elementId) return;
  if (selectedElementIsProtectedBrand.value) {
    rejectProtectedBrandChange();
    return;
  }
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
  if (!element) return;
  selectedLayerIds.value = [element.layerId];
  activateDockPanel("properties");
}

function updateElementNumber(
  property: "x" | "y" | "width" | "height" | "rotation",
  event: Event,
): void {
  const element = selectedElement.value;
  const value = Number((event.target as HTMLInputElement).value);
  if (!element || !Number.isFinite(value)) return;
  if (selectedElementIsProtectedBrand.value) {
    rejectProtectedBrandChange();
    return;
  }
  element[property] = property === "width" || property === "height" ? Math.max(0.2, value) : value;
}

function updateElementGeometry(elementId: string, frame: ElementFrame): void {
  const element = selectedPage.value.elements.find((item) => item.id === elementId);
  if (!element) return;
  if (isCalendarWorkshopBrandElement(selectedPage.value, element)) {
    rejectProtectedBrandChange();
    return;
  }
  element.x = frame.x;
  element.y = frame.y;
  element.width = Math.max(0.2, frame.width);
  element.height = Math.max(0.2, frame.height);
  if (element.type === "month-text") element.placement = "fixed-frame";
  if (element.type === "shape" && element.shape === "line" && frame.lineDirection) {
    element.lineDirection = frame.lineDirection;
  }
}

function imageCropPositionPercent(element: ImageElement, axis: "x" | "y"): number {
  const normalized = element.crop?.[axis] ?? 0.5;
  return Math.round((Math.max(0, Math.min(1, normalized)) - 0.5) * 200);
}

function updateImageCropPosition(element: ImageElement, axis: "x" | "y", event: Event): void {
  if (selectedElementIsProtectedBrand.value) {
    rejectProtectedBrandChange();
    return;
  }
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  element.crop ??= { x: 0.5, y: 0.5, width: 1, height: 1 };
  element.crop[axis] = Math.max(0, Math.min(1, value / 200 + 0.5));
}

function resetImageCropPosition(element: ImageElement): void {
  if (selectedElementIsProtectedBrand.value) {
    rejectProtectedBrandChange();
    return;
  }
  mutateProject("Центрирование кадра", () => {
    element.crop = { x: 0.5, y: 0.5, width: 1, height: 1 };
  });
  operationNotice.value = "Кадр снова расположен по центру";
}

function updateSelectedCornerRadius(event: Event): void {
  const element = selectedElement.value;
  const value = Number((event.target as HTMLInputElement).value);
  if (!element || selectedElementIsProtectedBrand.value || !Number.isFinite(value)) return;
  element.cornerRadiusMm = Math.max(0, Math.min(value, element.width / 2, element.height / 2));
}

function toggleSelectedCornerRadii(): void {
  const element = selectedElement.value;
  if (!element || selectedElementIsProtectedBrand.value) return;
  mutateProject(element.cornerRadiiMm ? "Связать скругления углов" : "Разделить скругления углов", () => {
    if (element.cornerRadiiMm) {
      element.cornerRadiusMm = element.cornerRadiiMm.topLeft;
      element.cornerRadiiMm = undefined;
      return;
    }
    const radius = Math.max(0, Math.min(element.cornerRadiusMm ?? 0, element.width / 2, element.height / 2));
    element.cornerRadiiMm = {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    };
  });
}

function updateSelectedIndividualCorner(corner: keyof CornerRadiiMm, event: Event): void {
  const element = selectedElement.value;
  const value = Number((event.target as HTMLInputElement).value);
  if (!element?.cornerRadiiMm || selectedElementIsProtectedBrand.value || !Number.isFinite(value)) return;
  element.cornerRadiiMm[corner] = Math.max(0, Math.min(value, element.width / 2, element.height / 2));
}

function editableLayerMaskTarget(page: PageModel, layerId: string): PageObjectLayer | undefined {
  const location = findLayerLocation(page, layerId);
  if (
    location?.node.kind !== "layer" ||
    !location.node.elementId ||
    location.node.locked ||
    location.node.protected ||
    location.ancestors.some((group) => group.locked || group.protected)
  ) return undefined;
  return location.node;
}

function projectUsesLayerMaskAsset(assetId: string): boolean {
  const usesAsset = (nodes: PageLayerNode[]): boolean => nodes.some((node) =>
    node.kind === "group" ? usesAsset(node.children) : node.mask?.assetId === assetId,
  );
  return project.value.document.pages.some((page) => usesAsset(page.layers));
}

function removeUnusedLayerMaskAsset(assetId: string | undefined): void {
  if (!assetId || !assetId.startsWith("asset-layer-mask-") || projectUsesLayerMaskAsset(assetId)) return;
  project.value.assets = project.value.assets.filter((asset) => asset.id !== assetId);
}

function layerMaskAssetCopy(asset: DocumentAsset, label: string): DocumentAsset {
  return {
    ...asset,
    id: `asset-layer-mask-${crypto.randomUUID()}`,
    name: `Маска — ${label}`,
  };
}

function applyLayerMaskFromElement(targetLayerId: string, sourceElementId: string): void {
  const page = selectedPage.value;
  const target = editableLayerMaskTarget(page, targetLayerId);
  const sourceElement = page.elements.find((element) => element.id === sourceElementId);
  if (!target || !sourceElement || (sourceElement.type !== "image" && sourceElement.type !== "svg")) {
    operationNotice.value = "Не удалось применить маску: выберите обычный незаблокированный слой и PNG/SVG-элемент";
    return;
  }
  const sourceAsset = project.value.assets.find((asset) => asset.id === sourceElement.assetId);
  if (!sourceAsset) {
    operationNotice.value = "У выбранного элемента нет доступного изображения";
    return;
  }
  const sourceLayer = findLayerLocation(page, sourceElement.layerId)?.node;
  const maskAsset = layerMaskAssetCopy(sourceAsset, sourceLayer?.name ?? sourceAsset.name);
  mutateProject("Маска слоя из элемента", () => {
    const previousAssetId = target.mask?.assetId;
    project.value.assets.push(maskAsset);
    target.mask = { enabled: true, assetId: maskAsset.id };
    removeUnusedLayerMaskAsset(previousAssetId);
  });
  selectedLayerIds.value = [target.id];
  selectedElementId.value = target.elementId;
  operationNotice.value = `К слою «${target.name}» применена маска из «${sourceLayer?.name ?? sourceAsset.name}»`;
}

function requestLayerMaskFile(targetLayerId: string): void {
  const target = editableLayerMaskTarget(selectedPage.value, targetLayerId);
  if (!target) {
    operationNotice.value = "Маску можно добавить только к незаблокированному объектному слою";
    return;
  }
  pendingLayerMaskTarget.value = { pageId: selectedPage.value.id, layerId: targetLayerId };
  layerMaskFileInput.value?.click();
}

async function importLayerMaskFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const pending = pendingLayerMaskTarget.value;
  try {
    if (!file || !pending) return;
    const page = project.value.document.pages.find((candidate) => candidate.id === pending.pageId);
    const target = page ? editableLayerMaskTarget(page, pending.layerId) : undefined;
    if (!page || !target) {
      operationNotice.value = "Слой для маски больше недоступен";
      return;
    }
    const svg = /svg/iu.test(file.type) || /\.svg$/iu.test(file.name);
    assertFileSize(file, svg ? MAX_SVG_FILE_BYTES : MAX_IMAGE_FILE_BYTES, "Файл маски");
    const source = await readFileAsDataUrl(file);
    const dimensions = svg ? undefined : await readRasterDimensions(source);
    if (!svg) assertRasterDimensions(dimensions, file.name);
    const asset: DocumentAsset = {
      id: `asset-layer-mask-${crypto.randomUUID()}`,
      name: `Маска — ${file.name}`,
      mimeType: file.type || (svg ? "image/svg+xml" : "image/png"),
      source,
      kind: svg ? "svg" : "image",
      ...dimensions,
    };
    mutateProject("Загрузка маски слоя", () => {
      const previousAssetId = target.mask?.assetId;
      project.value.assets.push(asset);
      target.mask = { enabled: true, assetId: asset.id };
      removeUnusedLayerMaskAsset(previousAssetId);
    });
    operationNotice.value = `Чёрно-белая маска добавлена к слою «${target.name}»`;
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось загрузить маску";
  } finally {
    pendingLayerMaskTarget.value = undefined;
    input.value = "";
  }
}

function setLayerMaskEnabled(targetLayerId: string, enabled: boolean): void {
  const target = editableLayerMaskTarget(selectedPage.value, targetLayerId);
  if (!target?.mask) return;
  mutateProject(enabled ? "Включение маски слоя" : "Отключение маски слоя", () => {
    target.mask!.enabled = enabled;
  });
  operationNotice.value = enabled ? "Маска слоя включена" : "Маска слоя временно отключена";
}

function removeLayerMask(targetLayerId: string): void {
  const target = editableLayerMaskTarget(selectedPage.value, targetLayerId);
  if (!target?.mask) return;
  mutateProject("Удаление маски слоя", () => {
    const previousAssetId = target.mask?.assetId;
    target.mask = undefined;
    removeUnusedLayerMaskAsset(previousAssetId);
  });
  operationNotice.value = `Маска удалена со слоя «${target.name}»`;
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
  const name = promptInterface("Название шаблона календарной сетки", translateInterfaceText("Моя календарная сетка"));
  if (!name?.trim()) return;
  const saved = await saveUserCalendarGridTemplate(name.trim(), grid);
  userCalendarGridTemplates.value = [saved, ...userCalendarGridTemplates.value];
  operationNotice.value = `Шаблон сетки «${saved.name}» сохранён`;
}

function applyCalendarGridTemplate(
  template: Pick<UserCalendarGridTemplate, "name" | "grid">,
  allMonths: boolean,
): void {
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

function requestGlobalGridTemplateManagement(): void {
  if (canManageGlobalGridTemplates.value) {
    operationNotice.value = "Управление общими макетами уже открыто";
    return;
  }
  pendingVerifiedAction.value = "global-grid-templates";
  localStorage.setItem(PENDING_VERIFIED_ACTION_KEY, "global-grid-templates");
  emailVerificationSentTo.value = undefined;
  emailVerificationError.value = undefined;
  developmentVerificationUrl.value = undefined;
  emailVerificationOpen.value = true;
}

function selectedCalendarGrid(): CalendarGridElement | undefined {
  return selectedElement.value?.type === "calendar-grid" ? selectedElement.value : undefined;
}

async function saveSelectedGridForEveryone(): Promise<void> {
  const grid = selectedCalendarGrid();
  if (!grid) {
    operationNotice.value = "Сначала выберите и настройте календарную сетку";
    return;
  }
  const accessToken = verifiedAccessToken();
  if (!canManageGlobalGridTemplates.value || !accessToken) {
    requestGlobalGridTemplateManagement();
    return;
  }
  const name = promptInterface("Название общего макета календарной сетки", "Новый макет");
  if (!name?.trim()) return;
  const description = promptInterface("Кратко опишите отличие макета", "Авторский макет календарной сетки") ?? "";
  globalGridTemplatesBusy.value = true;
  try {
    const saved = await createGlobalCalendarGridTemplate(accessToken, {
      name: name.trim(),
      description: description.trim(),
      grid,
    });
    globalCalendarGridTemplates.value = [...globalCalendarGridTemplates.value, saved];
    operationNotice.value = `Общий макет «${saved.name}» сохранён и доступен всем`;
  } catch (error) {
    operationNotice.value = `Не удалось сохранить общий макет: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    globalGridTemplatesBusy.value = false;
  }
}

async function overwriteGlobalCalendarGridTemplate(template: GlobalCalendarGridTemplate): Promise<void> {
  const grid = selectedCalendarGrid();
  const accessToken = verifiedAccessToken();
  if (!grid) {
    operationNotice.value = "Сначала примените макет, измените выбранную сетку и снова нажмите «Обновить»";
    return;
  }
  if (!canManageGlobalGridTemplates.value || !accessToken) return requestGlobalGridTemplateManagement();
  if (!confirmInterface(`Заменить общий макет «${template.name}» оформлением выбранной сетки? Изменение увидят все пользователи.`)) return;
  globalGridTemplatesBusy.value = true;
  try {
    const saved = await updateGlobalCalendarGridTemplate(accessToken, template.id, {
      name: template.name,
      description: template.description,
      grid,
    });
    globalCalendarGridTemplates.value = globalCalendarGridTemplates.value.map((item) => item.id === saved.id ? saved : item);
    operationNotice.value = `Общий макет «${saved.name}» обновлён для всех`;
  } catch (error) {
    operationNotice.value = `Не удалось обновить общий макет: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    globalGridTemplatesBusy.value = false;
  }
}

async function removeGlobalCalendarGridTemplate(template: GlobalCalendarGridTemplate): Promise<void> {
  const accessToken = verifiedAccessToken();
  if (template.builtIn || !canManageGlobalGridTemplates.value || !accessToken) return;
  if (!confirmInterface(`Удалить общий макет «${template.name}»? Он исчезнет у всех пользователей.`)) return;
  globalGridTemplatesBusy.value = true;
  try {
    await deleteGlobalCalendarGridTemplate(accessToken, template.id);
    globalCalendarGridTemplates.value = globalCalendarGridTemplates.value.filter((item) => item.id !== template.id);
    operationNotice.value = `Общий макет «${template.name}» удалён`;
  } catch (error) {
    operationNotice.value = `Не удалось удалить общий макет: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    globalGridTemplatesBusy.value = false;
  }
}

async function removeCalendarGridTemplate(template: UserCalendarGridTemplate): Promise<void> {
  if (!confirmInterface(`Удалить шаблон сетки «${template.name}»?`)) return;
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
  if (!confirmInterface(`${summary}\n\nПрименить мастер-страницу?`)) return;
  const result = mutateProject("Применение мастер-страницы", () =>
    applyMonthMaster(project.value, selectedPage.value.id),
  );
  operationNotice.value = `Мастер применён к ${result.changedPages} страницам; сохранено назначений фотографий: ${result.preservedImages}`;
}

async function saveCurrentDesignAsTemplate(): Promise<void> {
  const name = promptInterface("Название пользовательского шаблона", `${project.value.name} — ${translateInterfaceText("дизайн")}`);
  if (!name?.trim()) return;
  const saved = await saveUserProjectTemplate(name.trim(), project.value);
  userProjectTemplates.value = [saved, ...userProjectTemplates.value];
  operationNotice.value = `Шаблон «${saved.name}» сохранён локально`;
}

function applyUserProjectTemplate(template: UserProjectTemplate): void {
  if (!confirmInterface(`Применить шаблон «${template.name}» ко всему документу? Текущие страницы будут заменены; действие можно отменить.`)) return;
  const current = project.value;
  const prepared = cloneProjectForYear(template.project, current.year);
  mutateProject("Применение пользовательского шаблона", () => {
    project.value = {
      ...prepared,
      id: current.id,
      name: current.name,
      programSettings: current.programSettings,
      publisherProfile: current.publisherProfile,
      monasteryEvents: current.monasteryEvents,
      assets: [...prepared.assets, ...current.assets.filter((asset) => !prepared.assets.some((item) => item.id === asset.id))],
      customFonts: [
        ...(prepared.customFonts ?? []),
        ...(current.customFonts ?? []).filter((font) => !(prepared.customFonts ?? []).some((item) => item.assetId === font.assetId)),
      ],
    };
    ensureCalendarWorkshopBranding(project.value);
  });
  resetPageTabs();
  void registerProjectFonts(project.value);
  operationNotice.value = `Применён шаблон «${template.name}»`;
}

async function removeUserProjectTemplate(template: UserProjectTemplate): Promise<void> {
  if (!confirmInterface(`Удалить шаблон «${template.name}»?`)) return;
  await deleteUserProjectTemplate(template.id);
  userProjectTemplates.value = userProjectTemplates.value.filter((item) => item.id !== template.id);
  operationNotice.value = `Шаблон «${template.name}» удалён`;
}

function cloneCurrentProjectToYear(): void {
  const answer = promptInterface("Год для копии проекта", String(project.value.year + 1));
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
  ensureCalendarWorkshopBranding(project.value);
  detachActiveProjectFile();
  clearProjectHistory();
  resetPageTabs();
  void registerProjectFonts(project.value);
  void loadCalendarData();
  operationNotice.value = `Создана независимая копия проекта на ${year} год; выберите «Сохранить как…»`;
}

function restoreProjectBackup(backup: ProjectBackup): void {
  if (!confirmInterface(`Восстановить резервную копию «${backup.label}» от ${new Date(backup.createdAt).toLocaleString(INTERFACE_LANGUAGE_LOCALES[interfaceLanguage.value])}?`)) return;
  mutateProject("Восстановление резервной копии", () => {
    const currentProgramSettings = project.value.programSettings;
    project.value = normalizeCalendarProject(createPersistentProjectSnapshot(backup.project));
    project.value.programSettings = currentProgramSettings;
    ensureCalendarWorkshopBranding(project.value);
  });
  detachActiveProjectFile();
  resetPageTabs();
  void registerProjectFonts(project.value);
  void loadCalendarData();
  operationNotice.value = `Восстановлена копия «${backup.label}»; сохраните её в новый файл`;
}

function restoreProjectBackupFromDialog(backup: ProjectBackup): void {
  recoveryDialogOpen.value = false;
  restoreProjectBackup(backup);
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
  if (selectedElementIsProtectedBrand.value) {
    rejectProtectedBrandChange();
    return;
  }
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

function formatFileSize(bytes: number): string {
  return `${Math.ceil(bytes / MEBIBYTE)} МБ`;
}

function assertFileSize(file: File, maximumBytes: number, label: string): void {
  if (file.size <= maximumBytes) return;
  throw new Error(`${label} слишком большой: ${formatFileSize(file.size)}. Допустимо не более ${formatFileSize(maximumBytes)}.`);
}

function assertRasterDimensions(
  dimensions: { widthPx: number; heightPx: number } | undefined,
  label: string,
): void {
  if (!dimensions) throw new Error(`${label}: браузер не смог прочитать изображение`);
  if (dimensions.widthPx * dimensions.heightPx > MAX_RASTER_PIXELS) {
    throw new Error(`${label} слишком большое по разрешению: ${dimensions.widthPx} × ${dimensions.heightPx} px`);
  }
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
    assertFileSize(file, MAX_FONT_FILE_BYTES, "Файл шрифта");
    const suggested = file.name.replace(/\.(?:ttf|otf|woff2?)$/iu, "").replace(/[-_]+/gu, " ").trim();
    const family = promptInterface("Название семейства шрифта", suggested);
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
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось добавить шрифт";
  } finally {
    input.value = "";
  }
}

async function importIccProfile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    assertFileSize(file, MAX_ICC_FILE_BYTES, "ICC-профиль");
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
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось добавить ICC-профиль";
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

async function loadDecorImage(item: DecorLibraryItem): Promise<string> {
  const response = await fetch(item.source);
  if (!response.ok) throw new Error(`Не удалось прочитать ${item.label}`);
  const blob = await response.blob();
  return readFileAsDataUrl(new File([blob], `${item.id}.png`, { type: blob.type || "image/png" }));
}

async function insertDecorLibraryItem(item: DecorLibraryItem): Promise<void> {
  try {
    if (item.kind === "image") {
      const reusableAsset = project.value.assets.find(
        (asset) => asset.kind === "image" && asset.libraryItemId === item.id,
      );
      const asset = reusableAsset ?? {
          id: `asset-decor-${crypto.randomUUID()}`,
          name: `${item.label}.png`,
          mimeType: "image/png",
          source: await loadDecorImage(item),
          kind: "image" as const,
          widthPx: item.widthPx,
          heightPx: item.heightPx,
          libraryItemId: item.id,
        };
      const created = mutateProject("Вставка печатного декора из библиотеки", () => {
        if (!reusableAsset) project.value.assets.push(asset);
        const result = createElementOnOwnLayer(selectedPage.value, "image", frameForDecor(item));
        result.layer.name = item.label;
        const element = result.element as ImageElement;
        element.assetId = asset.id;
        element.fit = "fit";
        return result;
      });
      selectedLayerIds.value = [created.layer.id];
      selectedElementId.value = created.element.id;
      activeTool.value = "selection";
      activeDockPanel.value = "properties";
      operationNotice.value = `Добавлен печатный элемент «${item.label}» · ${item.nominalDpi ?? 300} dpi`;
      return;
    }
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
  if (isCalendarWorkshopBrandElement(selectedPage.value, element)) {
    input.value = "";
    rejectProtectedBrandChange();
    return;
  }
  try {
    const svgFile = /svg/iu.test(file.type) || /\.svg$/iu.test(file.name);
    assertFileSize(file, svgFile ? MAX_SVG_FILE_BYTES : MAX_IMAGE_FILE_BYTES, "Изображение");
    const source = await readFileAsDataUrl(file);
    const dimensions = element.type === "image" && !svgFile
      ? await readRasterDimensions(source)
      : undefined;
    if (element.type === "image" && !svgFile) assertRasterDimensions(dimensions, file.name);
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
  } catch (error) {
    operationNotice.value = error instanceof Error ? error.message : "Не удалось поместить файл";
  } finally {
    input.value = "";
  }
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
    assertFileSize(file, MAX_IMAGE_FILE_BYTES, "Изображение знака пищи");
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
  return customAsset?.source ?? foodMarkerPackPreviewSource(project.value.foodMarkerPackId, rule);
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
  const wasCompact = compactViewport.value;
  viewportWidthPx.value = window.innerWidth;
  dockPanelWidthPx.value = clampDockPanelWidth(dockPanelWidthPx.value);
  if (!wasCompact && compactViewport.value) {
    welcomeVisible.value = true;
    if (sharedAccessMode.value !== "none") void leaveSharedProject(false);
    return;
  }
  if (wasCompact && !compactViewport.value) {
    const projectId = sharedProjectIdFromLocation();
    if (projectId && sharedAccessMode.value === "none") void openSharedProjectById(projectId);
  }
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
  if (isProtectedBrandLayer(nodeId)) {
    rejectProtectedBrandChange();
    return;
  }
  mutateProject(property === "locked" ? "Блокировка слоя" : "Видимость слоя", () => {
    node[property] = !node[property];
  });
}

function toggleLayerPropertyById(layerId: string, property: "locked" | "visible"): void {
  if (isProtectedBrandLayer(layerId)) {
    rejectProtectedBrandChange();
    return;
  }
  const layer = findLayer(layerId);
  if (!layer) return;
  mutateProject(property === "locked" ? "Блокировка слоя" : "Видимость слоя", () => {
    layer[property] = !layer[property];
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
    case "recovery": recoveryDialogOpen.value = true; break;
    case "program-settings":
      programSettingsError.value = undefined;
      programSettingsOpen.value = true;
      break;
    case "share-project": void shareCurrentProject(); break;
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
    case "toggle-templates": toggleDockPanel("templates"); break;
    case "toggle-pages": toggleDockPanel("pages"); break;
    case "toggle-events": toggleDockPanel("events"); break;
    case "toggle-preflight": toggleDockPanel("preflight"); break;
    case "toggle-all-panels": toggleAllPanels(); break;
    case "help-guide": helpDialogPage.value = "guide"; break;
    case "shortcuts": helpDialogPage.value = "shortcuts"; break;
    case "about": helpDialogPage.value = "about"; break;
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
  if (isCalendarWorkshopBrandElement(selectedPage.value, element)) return false;
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
  if (sharedLease.value && sharedLastSavedSnapshot === serializeEditableProject()) return;
  if (savedProjectFileSnapshot.value === serializeEditableProject()) return;
  event.preventDefault();
  event.returnValue = "";
}

function handlePageHide(): void {
  if (sharedLease.value) void releaseSharedProject(sharedLease.value).catch(() => undefined);
}

function handleKeydown(event: KeyboardEvent): void {
  if (helpDialogPage.value || recoveryDialogOpen.value || programSettingsOpen.value || emailVerificationOpen.value || sharedAccessMode.value === "locked" || sharedAccessMode.value === "waiting" || sharedAccessMode.value === "loading") {
    if (event.key === "Escape") {
      helpDialogPage.value = undefined;
      recoveryDialogOpen.value = false;
      programSettingsOpen.value = false;
    }
    return;
  }
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
  if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "+" || event.key === "=")) {
    event.preventDefault();
    zoomPercent.value = Math.min(200, zoomPercent.value + 10);
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "-" || event.key === "−")) {
    event.preventDefault();
    zoomPercent.value = Math.max(15, zoomPercent.value - 10);
    return;
  }
  if (selectedElement.value && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    if (selectedElementIsProtectedBrand.value) {
      rejectProtectedBrandChange();
      return;
    }
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
    "\\": "line",
    h: "hand",
    z: "zoom",
  };
  const tool = shortcuts[event.key.toLowerCase()];
  if (tool && !event.ctrlKey && !event.metaKey && !event.altKey) selectTool(tool);
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("resize", handleViewportResize);
  void initializeApplication();
});
watch(project, () => {
  scheduleAutosave();
  scheduleSharedSave();
}, { deep: true });
watch(interfaceLanguage, (language) => {
  if (project.value.programSettings?.interfaceLanguage !== language) {
    project.value.programSettings = { interfaceLanguage: language };
  }
});
watch(
  [() => project.value.document.pages.map((page) => page.id), selectedPageId],
  ([pageIds, activePageId]) => {
    const available = new Set(pageIds);
    const nextOpenPageIds = openPageIds.value.filter((pageId) => available.has(pageId));
    if (activePageId && available.has(activePageId) && !nextOpenPageIds.includes(activePageId)) {
      nextOpenPageIds.push(activePageId);
    }
    if (
      nextOpenPageIds.length !== openPageIds.value.length ||
      nextOpenPageIds.some((pageId, index) => pageId !== openPageIds.value[index])
    ) {
      openPageIds.value = nextOpenPageIds;
    }
  },
);
watch(dockPanelMaximumWidthPx, () => {
  dockPanelWidthPx.value = clampDockPanelWidth(dockPanelWidthPx.value);
});
watch(
  [selectedPageId, openPageIds, activeDockPanel, dockPanelWidthPx, zoomPercent, showGuides, selectedTemplateId, panelVisibility],
  ([pageId, , dockPanel]) => {
    localStorage.setItem(EDITOR_STATE_KEY, JSON.stringify({
      pageId,
      openPageIds: openPageIds.value,
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
  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("resize", handleViewportResize);
  stopDockPanelResize();
  if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
  const lease = sharedLease.value;
  stopSharedTimers();
  if (lease) void releaseSharedProject(lease).catch(() => undefined);
});
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--resizing-dock': dockPanelResizing,
      'app-shell--mobile-welcome': compactViewport,
    }"
    @click="activeMenu = undefined"
  >
    <WelcomePage
      v-if="welcomeVisible"
      :current-project-name="hasAutosavedProject ? project.name : undefined"
      :recent-project-names="recentProjectNames"
      :shared-projects="sharedRecentProjects"
      :compact-mode="compactViewport"
      @create="createNewProject"
      @continue="continueFromWelcome"
      @open="openLocalProjectFromWelcome"
      @open-shared="openSharedProjectById"
      @help="helpDialogPage = 'guide'"
      @language-change="changeInterfaceLanguageFromWelcome"
    />
    <header class="application-header">
      <nav class="menu-bar" aria-label="Главное меню" @click.stop>
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
                :data-testid="item.command ? `menu-command-${item.command}` : undefined"
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
          <button class="brand__home" type="button" title="На стартовую страницу" @click="showWelcomePage">
            <img class="brand__logo" src="/brand/logo-symbol-256.webp" alt="Календарная мастерская" />
          </button>
          <div>
            <strong>Календарная мастерская</strong>
            <span>{{ project.name }}</span>
          </div>
        </div>
        <div class="context-controls" aria-label="Контекстные параметры">
          <span class="context-controls__icon">
            {{ activeTool === "text" ? "T" : activeTool === "image" ? "▧" : "↖" }}
          </span>
          <label><span>X</span><input :value="selectedElement?.x ?? '—'" :disabled="!selectedElement || selectedElementIsProtectedBrand" type="number" step="0.1" @change="updateElementNumber('x', $event)" /></label>
          <label><span>Y</span><input :value="selectedElement?.y ?? '—'" :disabled="!selectedElement || selectedElementIsProtectedBrand" type="number" step="0.1" @change="updateElementNumber('y', $event)" /></label>
          <label><span>W</span><input :value="selectedElement?.width ?? '—'" :disabled="!selectedElement || selectedElementIsProtectedBrand" type="number" step="0.1" @change="updateElementNumber('width', $event)" /></label>
          <label><span>H</span><input :value="selectedElement?.height ?? '—'" :disabled="!selectedElement || selectedElementIsProtectedBrand" type="number" step="0.1" @change="updateElementNumber('height', $event)" /></label>
          <span class="context-controls__unit">мм</span>
        </div>
        <div class="control-bar__status">
          <span class="status-chip">{{ selectedPage.formatId }} · {{ orientationLabel }}</span>
          <span class="status-chip status-chip--accent">Источник: мм</span>
          <span v-if="calendarLoadState === 'ready'" class="status-chip">
            XML: {{ calendarDataset?.statistics.recordCount }}
          </span>
          <span v-if="sharedAccessMode === 'editing'" class="status-chip status-chip--online">● Общий календарь</span>
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

      <div class="document-tabs" role="tablist" aria-label="Открытые страницы">
        <div
          v-for="page in openPages"
          :key="page.id"
          class="document-tab"
          :class="{ 'document-tab--active': page.id === selectedPageId }"
        >
          <button
            class="document-tab__close"
            type="button"
            :aria-label="`Закрыть вкладку «${page.name}»`"
            :title="`Закрыть вкладку «${page.name}» — сама страница останется в календаре`"
            @click="closePageTab(page.id)"
          >×</button>
          <button
            class="document-tab__label"
            type="button"
            role="tab"
            :aria-selected="page.id === selectedPageId"
            :title="`${page.name} — ${project.name}`"
            @click="selectPage(page.id)"
          >
            <span class="document-tab__name">{{ page.name }}</span>
            <span v-if="page.id === selectedPageId" class="document-tab__zoom">{{ zoomPercent }}%</span>
          </button>
        </div>
        <span v-if="openPages.length === 0" class="document-tabs__empty">Нет открытых страниц</span>
      </div>
    </header>

    <div class="editor-shell" :style="{ gridTemplateColumns: editorGridColumns }">
      <ToolsPanel
        v-if="showToolsPanel"
        :active-tool="activeTool"
        :templates-active="activeDockPanel === 'templates'"
        :fill-color="currentFillColor"
        :stroke-color="currentStrokeColor"
        @select="selectTool"
        @update-fill="updateFillColor"
        @update-stroke="updateStrokeColor"
        @apply-gold="applyGoldPaint"
        @open-templates="activateDockPanel('templates')"
      />

      <DocumentWorkspace
        v-if="openPages.length > 0"
        :page="selectedPage"
        :assets="project.assets"
        :food-marker-pack-id="project.foodMarkerPackId"
        :food-marker-assets="project.foodMarkerAssets"
        :fasting-profile-id="project.fastingProfileId"
        :calendar-language="project.calendarLanguage"
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
      <div v-else class="workspace-empty">
        <div class="workspace-empty__card">
          <strong>Все вкладки закрыты</strong>
          <span>Страницы календаря не удалены. Выберите нужную страницу в списке справа.</span>
          <button class="primary-action" type="button" @click="activateDockPanel('pages')">Открыть список страниц</button>
        </div>
      </div>

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
            :title="panel.label"
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
                <details class="inspector-subgroup" data-testid="geometry-section" open>
                  <summary>Геометрия</summary>
                  <div class="inspector-subgroup__body">
                    <div class="geometry-controls">
                      <div class="geometry-controls__type"><span>Тип</span><strong>{{ selectedElement.type }}</strong></div>
                      <label><span>Поворот</span><input :value="selectedElement.rotation" :disabled="selectedElementIsProtectedBrand" type="number" step="1" @change="updateElementNumber('rotation', $event)" /></label>
                      <label><span>X</span><input :value="selectedElement.x" :disabled="selectedElementIsProtectedBrand" type="number" step="0.1" @change="updateElementNumber('x', $event)" /></label>
                      <label><span>Y</span><input :value="selectedElement.y" :disabled="selectedElementIsProtectedBrand" type="number" step="0.1" @change="updateElementNumber('y', $event)" /></label>
                      <label><span>Ширина</span><input :value="selectedElement.width" :disabled="selectedElementIsProtectedBrand" type="number" min="0.2" step="0.1" @change="updateElementNumber('width', $event)" /></label>
                      <label><span>Высота</span><input :value="selectedElement.height" :disabled="selectedElementIsProtectedBrand" type="number" min="0.2" step="0.1" @change="updateElementNumber('height', $event)" /></label>
                    </div>
                  </div>
                </details>

                <details class="inspector-subgroup" data-testid="appearance-section" open>
                  <summary>Внешний вид</summary>
                  <div class="inspector-subgroup__body">
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

                    <div v-if="!selectedElementIsProtectedBrand" class="corner-radius-control" data-testid="corner-radius-controls">
                      <div class="corner-radius-control__main">
                        <span>Скругление, мм</span>
                        <div>
                          <input
                            v-if="!selectedElement.cornerRadiiMm"
                            data-testid="corner-radius"
                            :value="selectedElement.cornerRadiusMm ?? 0"
                            type="number"
                            min="0"
                            :max="Math.min(selectedElement.width, selectedElement.height) / 2"
                            step="0.5"
                            @input="updateSelectedCornerRadius"
                          />
                          <span v-else class="corner-radius-control__separate">4 угла</span>
                          <button
                            data-testid="corner-radius-link"
                            type="button"
                            :title="selectedElement.cornerRadiiMm ? 'Связать углы: использовать значение верхнего левого угла' : 'Настроить каждый угол отдельно'"
                            :aria-label="selectedElement.cornerRadiiMm ? 'Связать скругления углов' : 'Разделить скругления углов'"
                            :class="{ active: !selectedElement.cornerRadiiMm }"
                            @click="toggleSelectedCornerRadii"
                          >
                            {{ selectedElement.cornerRadiiMm ? "⛓" : "🔗" }}
                          </button>
                        </div>
                      </div>
                      <div v-if="selectedElement.cornerRadiiMm" class="corner-radius-grid">
                        <label title="Верхний левый"><span>↖</span><input data-testid="corner-radius-top-left" :value="selectedElement.cornerRadiiMm.topLeft" type="number" min="0" step="0.5" @input="updateSelectedIndividualCorner('topLeft', $event)" /></label>
                        <label title="Верхний правый"><span>↗</span><input data-testid="corner-radius-top-right" :value="selectedElement.cornerRadiiMm.topRight" type="number" min="0" step="0.5" @input="updateSelectedIndividualCorner('topRight', $event)" /></label>
                        <label title="Нижний левый"><span>↙</span><input data-testid="corner-radius-bottom-left" :value="selectedElement.cornerRadiiMm.bottomLeft" type="number" min="0" step="0.5" @input="updateSelectedIndividualCorner('bottomLeft', $event)" /></label>
                        <label title="Нижний правый"><span>↘</span><input data-testid="corner-radius-bottom-right" :value="selectedElement.cornerRadiiMm.bottomRight" type="number" min="0" step="0.5" @input="updateSelectedIndividualCorner('bottomRight', $event)" /></label>
                      </div>
                    </div>
                  </div>
                </details>

                <details v-if="selectedElement.type === 'text' || selectedElement.type === 'month-text'" class="inspector-subgroup object-properties" open>
                  <summary>{{ selectedElement.type === "text" ? "Текст" : "Текст месяца" }}</summary>
                  <div class="inspector-subgroup__body">
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
                  <TextEffectsEditor
                    v-if="selectedElement.type === 'text'"
                    v-model="selectedElement.textEffects"
                    title="Эффекты крупного заголовка"
                    test-id-prefix="title"
                  />
                  <label class="field-control"><span>Выравнивание</span><select v-model="selectedElement.typography.align"><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option><option value="justify">По ширине</option></select></label>
                    <label class="field-control"><span>По вертикали</span><select v-model="selectedElement.typography.verticalAlign"><option value="top">Сверху</option><option value="middle">По центру</option><option value="bottom">Снизу</option></select></label>
                  </div>
                </details>

                <details v-else-if="selectedElement.type === 'image' || selectedElement.type === 'svg'" class="inspector-subgroup object-properties" open>
                  <summary>{{ selectedElement.type === "image" ? "Изображение" : "SVG и декор" }}</summary>
                  <div class="inspector-subgroup__body">
                  <div v-if="selectedElementIsProtectedBrand" class="protected-brand-notice" data-testid="protected-brand-notice">
                    <strong>Обязательный фирменный знак</strong>
                    <span>Всегда виден и находится на самом верхнем слое.</span>
                  </div>
                  <template v-else>
                    <button class="primary-action" type="button" @click="requestAssetFile">
                      {{ selectedElement.assetId ? "Заменить файл…" : "Выбрать файл…" }}
                    </button>
                    <label v-if="selectedElement.type === 'image'" class="field-control"><span>Заполнение</span><select v-model="selectedElement.fit"><option value="crop">С обрезкой</option><option value="fit">Вписать</option><option value="fill">Растянуть</option></select></label>
                    <div v-if="selectedElement.type === 'image' && selectedElement.fit === 'crop'" class="crop-position-controls" data-testid="crop-position-controls">
                      <strong>Положение кадра</strong>
                      <label class="field-control">
                        <span>По горизонтали: {{ imageCropPositionPercent(selectedElement, 'x') }}%</span>
                        <input :value="imageCropPositionPercent(selectedElement, 'x')" data-testid="crop-position-x" type="range" min="-100" max="100" step="1" @input="updateImageCropPosition(selectedElement, 'x', $event)" />
                      </label>
                      <label class="field-control">
                        <span>По вертикали: {{ imageCropPositionPercent(selectedElement, 'y') }}%</span>
                        <input :value="imageCropPositionPercent(selectedElement, 'y')" data-testid="crop-position-y" type="range" min="-100" max="100" step="1" @input="updateImageCropPosition(selectedElement, 'y', $event)" />
                      </label>
                      <button type="button" @click="resetImageCropPosition(selectedElement)">По центру</button>
                    </div>
                    <label v-if="selectedElement.type === 'svg' && selectedElement.libraryItemId" class="field-control">
                      <span>Цвет SVG</span>
                      <input :value="selectedElement.decorColor ?? '#17201d'" type="color" @change="updateSelectedDecorColor" />
                    </label>
                    <button v-if="selectedElement.type === 'svg' && selectedElement.libraryItemId" type="button" class="gold-preset-button" @click="applyGoldPaint">Золотой цвет SVG</button>
                    <p v-if="selectedElement.type === 'svg' && selectedElement.libraryItemId" class="property-help">Векторный элемент из библиотеки: цвет меняется без потери качества.</p>
                  </template>
                    <p v-if="selectedAssetInfo()" class="property-help">{{ selectedAssetInfo() }}</p>
                  </div>
                </details>

                <details v-else-if="selectedElement.type === 'calendar-grid'" class="inspector-subgroup object-properties" open>
                  <summary>Календарная сетка</summary>
                  <div class="inspector-subgroup__body">
                  <label class="field-control"><span>Месяц</span><select v-model.number="selectedElement.month"><option v-for="(month, index) in monthNames" :key="month" :value="index + 1">{{ month }}</option></select></label>
                  <label class="field-control"><span>Недель</span><select v-model.number="selectedElement.weekRows"><option :value="4">4</option><option :value="5">5</option><option :value="6">6</option></select></label>
                  <label class="checkbox-field"><input v-model="selectedElement.showWeekdayHeader" type="checkbox" /><span>Заголовки дней недели</span></label>
                  <label class="field-control"><span>Названия</span><select v-model="selectedElement.weekdayLabelMode"><option value="full">Полные</option><option value="short">Короткие</option><option value="custom">Свои</option></select></label>
                  <label class="field-control"><span>Стиль сетки</span><select v-model="selectedElement.gridStyle"><option value="editorial">Издательская</option><option value="boxed">Табличная</option><option value="minimal">Без линий</option></select></label>
                  <label class="field-control"><span>Шрифт заголовков</span><select v-model="selectedElement.weekdayFontFamily" :style="{ fontFamily: selectedElement.weekdayFontFamily }"><optgroup v-for="group in fontOptionGroups" :key="group.label" :label="group.label"><option v-for="option in group.options" :key="option.family" :value="option.family" :style="{ fontFamily: option.family }">{{ option.label }}</option></optgroup></select></label>
                  <label class="field-control"><span>Заголовки, pt</span><input v-model.number="selectedElement.weekdayFontSizePt" type="number" step="0.5" /></label>
                  <TextEffectsEditor
                    v-model="selectedElement.weekdayTextEffects"
                    title="Эффекты названий дней недели"
                    test-id-prefix="weekday"
                  />
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
                  <TextEffectsEditor
                    v-model="selectedElement.dayNumberTextEffects"
                    title="Эффекты числа дня"
                    test-id-prefix="day-number"
                  />
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
                    <FoodMarkerPackSelect
                      :model-value="activeFoodMarkerPack.id"
                      @update:model-value="updateFoodMarkerPack"
                    />
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
                </details>

                <details v-else-if="selectedElement.type === 'shape'" class="inspector-subgroup object-properties" open>
                  <summary>Фигура</summary>
                  <div class="inspector-subgroup__body">
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
                </details>

                <details v-else-if="selectedElement.type === 'legend'" class="inspector-subgroup object-properties" open>
                  <summary>Легенда</summary>
                  <div class="inspector-subgroup__body">
                  <div class="button-pair">
                    <button type="button" @click="placeSelectedLegend('top')">Сверху</button>
                    <button type="button" @click="placeSelectedLegend('bottom')">Снизу</button>
                  </div>
                    <p class="property-help">Легенда располагает только применённые в этом месяце знаки в одну строку и собирает их у правого края. Свободное место остаётся слева; саму легенду можно двигать мышью.</p>
                  </div>
                </details>

                <div class="overflow-indicator" :class="`overflow-indicator--${selectedElementOverflowState}`">
                  Переполнение: {{ selectedElementOverflowState === "none" ? "нет" : selectedElementOverflowState === "error" ? "ошибка" : "требует внимания" }}
                  <small v-if="selectedElementIssues.length">{{ selectedElementIssues.map((item) => item.message).join(' ') }}</small>
                </div>
              </template>
              <template v-else>
              <label class="field-stack"><span>Название проекта</span><input v-model="project.name" type="text" /></label>
              <label class="field-control"><span>Календарный год</span><input :value="project.year" type="number" min="1900" max="2200" @change="updateProjectYear" /></label>
              <label class="field-control"><span>Язык календаря</span><select data-testid="calendar-language-select" :value="project.calendarLanguage ?? 'ru'" @change="updateCalendarLanguage"><option v-for="language in calendarLanguageOptions" :key="language.id" :value="language.id">{{ language.label }}</option></select></label>
              <p class="property-help">Язык месяцев, дней недели, праздников, постов и имён святых. Он не зависит от языка программы.</p>
              <label class="field-control"><span>Правила поста</span><select v-model="project.fastingProfileId"><option v-for="profile in fastingProfileOptions" :key="profile.id" :value="profile.id">{{ profile.label }}</option></select></label>
              <p class="property-help">{{ FASTING_PROFILES[project.fastingProfileId ?? 'typikon-strict'].description }} Версия правил {{ FASTING_PROFILES[project.fastingProfileId ?? 'typikon-strict'].rulesVersion }}.</p>
              <label class="field-stack"><span>Издатель / монастырь</span><input v-model="project.publisherProfile.name" type="text" /></label>
              <h2 class="property-subheading">Шрифты проекта</h2>
              <button class="font-upload-button" type="button" @click="requestCustomFontFile">
                <span class="font-upload-button__preview" aria-hidden="true">Аа</span>
                <span class="font-upload-button__copy">
                  <strong>Добавить шрифт</strong>
                  <small>TTF · OTF · WOFF</small>
                </span>
                <span class="font-upload-button__plus" aria-hidden="true">＋</span>
              </button>
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
            :assets="project.assets"
            :selected-layer-ids="selectedLayerIds"
            :protected-layer-ids="protectedBrandLayerIds"
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
            @toggle-visible="toggleLayerPropertyById($event, 'visible')"
            @toggle-locked="toggleLayerPropertyById($event, 'locked')"
            @upload-mask="requestLayerMaskFile"
            @apply-mask="applyLayerMaskFromElement"
            @toggle-mask="setLayerMaskEnabled"
            @remove-mask="removeLayerMask"
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

        <div v-else-if="activeDockPanel === 'templates'" class="dock-content templates-dock">
          <div class="dock-content__heading">Шаблоны</div>
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
            <h3>Макеты календарной сетки</h3>
            <p class="property-help">Выберите макет для текущей сетки или сразу для всех двенадцати месяцев. После применения все параметры можно менять в «Свойствах».</p>
            <div class="global-grid-template-list" :class="{ 'global-grid-template-list--busy': globalGridTemplatesBusy }">
              <CalendarGridTemplateCard
                v-for="template in globalCalendarGridTemplates"
                :key="template.id"
                :template="template"
                :can-manage="canManageGlobalGridTemplates"
                :has-selected-grid="selectedElement?.type === 'calendar-grid'"
                @apply="applyCalendarGridTemplate(template, false)"
                @apply-all="applyCalendarGridTemplate(template, true)"
                @update="overwriteGlobalCalendarGridTemplate(template)"
                @remove="removeGlobalCalendarGridTemplate(template)"
              />
            </div>
            <p v-if="globalGridTemplatesError" class="template-server-note">Сервер общих макетов временно недоступен. Пять встроенных макетов продолжают работать.</p>
            <div v-if="canManageGlobalGridTemplates" class="template-owner-tools">
              <strong>Управление владельца</strong>
              <small>Только вы можете изменять набор, который видят все пользователи.</small>
              <button class="primary-action" type="button" :disabled="selectedElement?.type !== 'calendar-grid' || globalGridTemplatesBusy" @click="saveSelectedGridForEveryone">Сохранить выбранную сетку для всех…</button>
            </div>
            <button v-else type="button" @click="requestGlobalGridTemplateManagement">Управление общими макетами…</button>
          </section>
          <section class="template-picker">
            <h3>Личные макеты сетки</h3>
            <button class="primary-action" type="button" :disabled="selectedElement?.type !== 'calendar-grid'" @click="saveSelectedGridAsTemplate">Сохранить выбранную сетку…</button>
            <p v-if="userCalendarGridTemplates.length === 0" class="empty-panel-message">Сохранённых сеток пока нет.</p>
            <div v-for="template in userCalendarGridTemplates" :key="template.id" class="grid-template-row">
              <button type="button" :title="`Применить «${template.name}» к выбранной сетке`" @click="applyCalendarGridTemplate(template, false)">{{ template.name }}</button>
              <button type="button" title="Применить ко всем месяцам" @click="applyCalendarGridTemplate(template, true)">12×</button>
              <button type="button" title="Удалить шаблон сетки" @click="removeCalendarGridTemplate(template)">×</button>
            </div>
          </section>
        </div>

        <div v-else class="dock-content pages-dock">
          <div class="dock-content__heading">Страницы</div>
          <button
            v-for="(page, pageIndex) in project.document.pages"
            :key="page.id"
            class="page-card"
            :class="{ 'page-card--active': page.id === selectedPage.id }"
            type="button"
            @click="selectPage(page.id)"
          >
            <PageThumbnail :page="page" :assets="project.assets" :year="project.year" :calendar-language="project.calendarLanguage" />
            <span>
              <strong>{{ pageIndex + 1 }}. {{ page.name }}</strong>
              <small>{{ page.width }} × {{ page.height }} мм</small>
            </span>
          </button>
        </div>
      </aside>
    </div>

    <ApplicationHelpDialog
      v-if="helpDialogPage"
      :page="helpDialogPage"
      @close="helpDialogPage = undefined"
    />
    <RecoveryDialog
      v-if="recoveryDialogOpen"
      :backups="projectBackups"
      @close="recoveryDialogOpen = false"
      @restore="restoreProjectBackupFromDialog"
    />
    <ProgramSettingsDialog
      v-if="programSettingsOpen"
      :language="interfaceLanguage"
      :verified="Boolean(verifiedAccessToken())"
      :busy="programSettingsBusy"
      :error="programSettingsError"
      @close="programSettingsOpen = false"
      @save="saveProgramSettingsFromDialog"
    />
    <EmailVerificationDialog
      v-if="emailVerificationOpen"
      :busy="emailVerificationBusy"
      :sent-to="emailVerificationSentTo"
      :error="emailVerificationError"
      :development-verification-url="developmentVerificationUrl"
      @submit="submitEmailVerification"
      @close="closeEmailVerification"
    />
    <SharedProjectDialog
      v-if="sharedAccessMode === 'loading' || sharedAccessMode === 'locked' || sharedAccessMode === 'waiting' || sharedAccessMode === 'error'"
      :mode="sharedAccessMode"
      :editor="sharedLockEditor"
      :error="sharedAccessError"
      :busy="sharedActionBusy"
      @wait="waitForSharedProject"
      @retry="retrySharedProject"
      @copy="copyCurrentSharedProject"
      @home="showWelcomePage"
    />
    <LinkResultDialog
      v-if="linkResult"
      :kind="linkResult.kind"
      :url="linkResult.url"
      :detail="linkResult.detail"
      @copy="copyResultLink"
      @close="linkResult = undefined"
    />

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
      ref="layerMaskFileInput"
      class="visually-hidden"
      data-testid="layer-mask-file"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
      @change="importLayerMaskFile"
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
