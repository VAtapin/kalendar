import type { CalendarProject, LayoutElementNode, PageModel } from '../document/types';
import { isCalendarWorkshopBrandElement } from '../document/branding';
import { translateInterfaceText } from '../i18n/interface-language';
export type ApplicationMenuId = "file" | "edit" | "layout" | "object" | "text" | "view" | "window" | "help";
export type MenuCommandId = "order-print" | "administrator" | "new-project" | "open-project" | "save-project" | "save-as-project" | "download-project" | "recovery" | "share-project" | "export-pdf" | "program-settings" | "save-user-template" | "clone-year" | "undo" | "redo" | "duplicate" | "delete" | "full-template" | "add-cover" | "add-month" | "add-blank-page" | "delete-page" | "apply-month-master" | "bring-front" | "send-back" | "group" | "toggle-lock" | "toggle-visible" | "align-object-left" | "align-object-center" | "align-object-right" | "align-object-top" | "align-object-middle" | "align-object-bottom" | "distribute-horizontal" | "distribute-vertical" | "bold" | "italic" | "align-left" | "align-center" | "align-right" | "toggle-guides" | "zoom-in" | "zoom-out" | "fit-page" | "calendar-properties" | "toggle-tools" | "toggle-properties" | "toggle-library" | "toggle-layers" | "toggle-templates" | "toggle-pages" | "toggle-events" | "toggle-preflight" | "toggle-all-panels" | "help-guide" | "video-lessons" | "shortcuts" | "about";
export interface MenuItemDefinition {
    command?: MenuCommandId;
    label?: string;
    shortcut?: string;
    checked?: boolean;
    disabled?: boolean;
    separator?: boolean;
}
export interface ApplicationMenuDefinition {
    id: ApplicationMenuId;
    label: string;
    items: MenuItemDefinition[];
}
interface MenuState {
    selectedElement: LayoutElementNode | undefined;
    selectedLayerIds: string[];
    selectionIncludesProtectedBrand: boolean;
    selectedLayerElements: LayoutElementNode[];
    selectedPage: PageModel;
    accountUser: unknown;
    projectBackups: unknown[];
    pdfExportState: string;
    undoStack: unknown[];
    redoStack: unknown[];
    project: CalendarProject;
    showGuides: boolean;
    panelVisibility: Record<string, boolean>;
    chromePanelsHidden: boolean;
}
export function createApplicationMenus(state: MenuState): ApplicationMenuDefinition[] {
    const hasSelection = Boolean(state.selectedElement || state.selectedLayerIds.length > 0);
    const protectedSelection = state.selectionIncludesProtectedBrand;
    const protectedElementSelection = state.selectedLayerElements.some((element) => isCalendarWorkshopBrandElement(state.selectedPage, element));
    const textSelected = state.selectedElement?.type === "text" || state.selectedElement?.type === "month-text";
    const menus: ApplicationMenuDefinition[] = [
        {
            id: "file",
            label: "Файл",
            items: [
                { command: "new-project", label: "Новый календарь", shortcut: "Ctrl+N" },
                { command: "open-project", label: "Импортировать файл календаря…", shortcut: "Ctrl+O" },
                { command: "save-project", label: "Сохранить", shortcut: "Ctrl+S" },
                { command: "save-as-project", label: "Скачать копию…", shortcut: "Ctrl+Shift+S" },
                { command: "recovery", label: "Восстановление…", disabled: !state.accountUser && state.projectBackups.length === 0 },
                { command: "program-settings", label: "Настройки программы…" },
                { command: "administrator", label: "Администратор…" },
                { separator: true },
                { command: "save-user-template", label: "Сохранить дизайн как шаблон…" },
                { command: "clone-year", label: "Создать копию для другого года…" },
                { separator: true },
                { command: "export-pdf", label: "Экспортировать печатный PDF…", shortcut: "Ctrl+E", disabled: state.pdfExportState === "exporting" },
                { label: "Заказать печать календаря…", command: "order-print" },
            ],
        },
        {
            id: "edit",
            label: "Правка",
            items: [
                { command: "calendar-properties", label: "Свойства календаря" },
                { separator: true },
                { command: "undo", label: "Отменить", shortcut: "Ctrl+Z", disabled: state.undoStack.length === 0 },
                { command: "redo", label: "Повторить", shortcut: "Ctrl+Y", disabled: state.redoStack.length === 0 },
                { separator: true },
                { command: "duplicate", label: "Дублировать", shortcut: "Ctrl+D", disabled: !state.selectedElement || protectedSelection },
                { command: "delete", label: "Удалить", shortcut: "Delete", disabled: !hasSelection || protectedSelection },
            ],
        },
        {
            id: "layout",
            label: "Макет",
            items: [
                { command: "apply-month-master", label: "Сделать выбранный месяц мастер-страницей", disabled: state.selectedPage.kind !== "month" },
                { separator: true },
                { command: "full-template", label: "Создать календарь: обложка + 12 месяцев" },
                { command: "add-cover", label: "Добавить обложку" },
                { command: "add-month", label: "Добавить страницу месяца" },
                { command: "add-blank-page", label: "Добавить пустую страницу" },
                { separator: true },
                { command: "delete-page", label: "Удалить текущую страницу", disabled: state.project.document.pages.length <= 1 },
            ],
        },
        {
            id: "object",
            label: "Объект",
            items: [
                { command: "bring-front", label: "На самый верх", disabled: !hasSelection || protectedSelection },
                { command: "send-back", label: "На самый низ", disabled: !hasSelection || protectedSelection },
                { command: "group", label: "Объединить слои в папку", disabled: state.selectedLayerIds.length < 2 || protectedSelection },
                { separator: true },
                { command: "align-object-left", label: "Выровнять по левому краю", disabled: state.selectedLayerElements.length < 2 || protectedElementSelection },
                { command: "align-object-center", label: "Выровнять по центру горизонтально", disabled: state.selectedLayerElements.length < 2 || protectedElementSelection },
                { command: "align-object-right", label: "Выровнять по правому краю", disabled: state.selectedLayerElements.length < 2 || protectedElementSelection },
                { command: "align-object-top", label: "Выровнять по верхнему краю", disabled: state.selectedLayerElements.length < 2 || protectedElementSelection },
                { command: "align-object-middle", label: "Выровнять по центру вертикально", disabled: state.selectedLayerElements.length < 2 || protectedElementSelection },
                { command: "align-object-bottom", label: "Выровнять по нижнему краю", disabled: state.selectedLayerElements.length < 2 || protectedElementSelection },
                { command: "distribute-horizontal", label: "Распределить по горизонтали", disabled: state.selectedLayerElements.length < 3 || protectedElementSelection },
                { command: "distribute-vertical", label: "Распределить по вертикали", disabled: state.selectedLayerElements.length < 3 || protectedElementSelection },
                { separator: true },
                { command: "toggle-lock", label: "Блокировать / разблокировать", disabled: !hasSelection || protectedSelection },
                { command: "toggle-visible", label: "Показать / скрыть", disabled: !hasSelection || protectedSelection },
                { command: "duplicate", label: "Дублировать", disabled: !state.selectedElement || protectedSelection },
                { command: "delete", label: "Удалить", disabled: !hasSelection || protectedSelection },
            ],
        },
        {
            id: "text",
            label: "Текст",
            items: [
                { command: "bold", label: "Полужирный", checked: textSelected && (state.selectedElement?.type === "text" || state.selectedElement?.type === "month-text") ? (state.selectedElement.typography.fontWeight ?? 400) >= 600 : false, disabled: !textSelected },
                { command: "italic", label: "Курсив", checked: textSelected && (state.selectedElement?.type === "text" || state.selectedElement?.type === "month-text") ? state.selectedElement.typography.fontStyle === "italic" : false, disabled: !textSelected },
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
                { command: "toggle-guides", label: "Направляющие", checked: state.showGuides },
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
                { command: "toggle-tools", label: "Инструменты", checked: state.panelVisibility.tools },
                { separator: true },
                { command: "toggle-properties", label: "Свойства", checked: state.panelVisibility.properties },
                { command: "toggle-library", label: "Библиотека элементов", checked: state.panelVisibility.library },
                { command: "toggle-layers", label: "Слои", checked: state.panelVisibility.layers },
                { command: "toggle-templates", label: "Шаблоны", checked: state.panelVisibility.templates },
                { command: "toggle-pages", label: "Страницы", checked: state.panelVisibility.pages },
                { command: "toggle-events", label: "События монастыря", checked: state.panelVisibility.events },
                { command: "toggle-preflight", label: "Предпечатная проверка", checked: state.panelVisibility.preflight },
                { separator: true },
                { command: "toggle-all-panels", label: state.chromePanelsHidden ? "Показать все панели" : "Скрыть все панели", shortcut: "Tab" },
            ],
        },
        {
            id: "help",
            label: "Помощь",
            items: [
                { command: "help-guide", label: "Как пользоваться?" },
                { command: "video-lessons", label: "Видеоуроки" },
                { command: "shortcuts", label: "Горячие клавиши…" },
                { separator: true },
                { command: "about", label: "О программе" },
            ],
        },
    ];
    return menus.map(menu => ({ ...menu, label: translateInterfaceText(menu.label), items: menu.items.map(item => ({ ...item, label: item.label ? translateInterfaceText(item.label) : undefined })) }));
}
