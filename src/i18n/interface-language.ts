import { TRANSLATIONS } from './interface-translations';
import { ref, watch } from "vue";
import type { InterfaceLanguage } from "../document/types";

export type { InterfaceLanguage } from "../document/types";

export const INTERFACE_LANGUAGE_STORAGE_KEY = "orthodox-calendar-layout:interface-language";

export const INTERFACE_LANGUAGE_OPTIONS: ReadonlyArray<{
  id: InterfaceLanguage;
  nativeLabel: string;
}> = [
  { id: "ru", nativeLabel: "Русский" },
  { id: "de", nativeLabel: "Deutsch" },
  { id: "en", nativeLabel: "English" },
  { id: "uk", nativeLabel: "Українська" },
];

export const INTERFACE_LANGUAGE_LOCALES: Record<InterfaceLanguage, string> = {
  ru: "ru-RU",
  de: "de-DE",
  en: "en-GB",
  uk: "uk-UA",
};

export function domainDefaultLanguage(hostname = typeof location === "undefined" ? "" : location.hostname): "de" | "ru" {
  return hostname.toLowerCase().replace(/\.$/, "") === "kalender.georg-kloster.de" ? "de" : "ru";
}

export function resolveInterfaceLanguage(hostname: string, preference: unknown): InterfaceLanguage {
  return isInterfaceLanguage(preference) ? preference : domainDefaultLanguage(hostname);
}

function storedLanguage(): InterfaceLanguage {
  return resolveBrowserLanguage(
    typeof location === 'undefined' ? '/' : location.pathname,
    typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language],
    typeof location === 'undefined' ? '' : location.hostname,
  );
}

export function resolveBrowserLanguage(path: string, _languages: readonly string[], hostname = ''): InterfaceLanguage {
  const explicit = path.split('/')[1]?.toLowerCase();
  if (isInterfaceLanguage(explicit)) return explicit;
  return domainDefaultLanguage(hostname);
}

export const interfaceLanguage = ref<InterfaceLanguage>(storedLanguage());

export function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return value === "ru" || value === "de" || value === "en" || value === "uk";
}

export function setInterfaceLanguage(language: InterfaceLanguage): void {
  interfaceLanguage.value = language;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, language);
  } catch { /* Keep manual switching usable without persistent storage. */ }
  if (typeof document !== "undefined") document.documentElement.lang = language;
}

export function translateInterfaceText(source: string, language = interfaceLanguage.value): string {
  if (language === "ru") return source;
  const exact = TRANSLATIONS[source]?.[language];
  if (exact) return exact;
  const orientation = /^(.*?) · (Книжная|Альбомная)$/.exec(source);
  if (orientation) {
    const translated = translateInterfaceText(orientation[2]!, language);
    return `${orientation[1]} · ${translated}`;
  }
  const millimetres = /^(\d+(?:[.,]\d+)?) мм$/.exec(source);
  if (millimetres) return `${millimetres[1]} mm`;
  const pageCount = /^Страница (\d+) из (\d+)$/.exec(source);
  if (pageCount) {
    if (language === "de") return `Seite ${pageCount[1]} von ${pageCount[2]}`;
    if (language === "en") return `Page ${pageCount[1]} of ${pageCount[2]}`;
    return `Сторінка ${pageCount[1]} з ${pageCount[2]}`;
  }
  const loadedRecords = /^Загружено (\d+) календарных записей$/.exec(source);
  if (loadedRecords) {
    if (language === "de") return `${loadedRecords[1]} Kalendereinträge geladen`;
    if (language === "en") return `${loadedRecords[1]} calendar records loaded`;
    return `Завантажено ${loadedRecords[1]} календарних записів`;
  }
  const preflight = /^Проверка: (.*)$/.exec(source);
  if (preflight) return `${translateInterfaceText("Проверка", language)}: ${translateInterfaceText(preflight[1]!, language)}`;
  const recovery = /^Автовосстановление: (.*)$/.exec(source);
  if (recovery) return `${translateInterfaceText("Автовосстановление", language)}: ${recovery[1]}`;
  const calendarStatus = /^(\d+) размещений событий · Пасха (.*)$/.exec(source);
  if (calendarStatus) {
    if (language === "de") return `${calendarStatus[1]} Ereignisplatzierungen · Pascha ${calendarStatus[2]}`;
    if (language === "en") return `${calendarStatus[1]} event placements · Pascha ${calendarStatus[2]}`;
    return `${calendarStatus[1]} розміщень подій · Пасха ${calendarStatus[2]}`;
  }
  const warningCount = /^(\d+) предупреждений$/.exec(source);
  if (warningCount) {
    if (language === "de") return `${warningCount[1]} Warnungen`;
    if (language === "en") return `${warningCount[1]} warnings`;
    return `${warningCount[1]} попереджень`;
  }
  const librarySummary = /^(\d+) из (\d+) · щелчок вставляет на новый верхний слой$/.exec(source);
  if (librarySummary) {
    if (language === "de") return `${librarySummary[1]} von ${librarySummary[2]} · Klick fügt auf einer neuen obersten Ebene ein`;
    if (language === "en") return `${librarySummary[1]} of ${librarySummary[2]} · click to insert on a new top layer`;
    return `${librarySummary[1]} з ${librarySummary[2]} · клацання вставляє на новий верхній шар`;
  }
  const fontDescription = /^(.*?) — (.+)$/.exec(source);
  if (fontDescription && TRANSLATIONS[fontDescription[2]!]) {
    return `${fontDescription[1]} — ${translateInterfaceText(fontDescription[2]!, language)}`;
  }
  const cropPosition = /^(По горизонтали|По вертикали): (-?\d+)%$/.exec(source);
  if (cropPosition) return `${translateInterfaceText(cropPosition[1]!, language)}: ${cropPosition[2]}%`;
  const calculatedCalendar = /^Данные дней и праздников берутся из рассчитанного календаря (\d{4}) года\.$/.exec(source);
  if (calculatedCalendar) {
    if (language === "de") return `Tage und Feste stammen aus dem berechneten Kalender für ${calculatedCalendar[1]}.`;
    if (language === "en") return `Days and feasts come from the calculated ${calculatedCalendar[1]} calendar.`;
    return `Дані днів і свят беруться з розрахованого календаря на ${calculatedCalendar[1]} рік.`;
  }
  const overflow = /^Переполнение: (.*)$/.exec(source);
  if (overflow) return `${translateInterfaceText("Переполнение", language)}: ${translateInterfaceText(overflow[1]!, language)}`;
  const shortenedFeast = /^На (\d+) дне название обязательного праздника сокращено многоточием\.$/.exec(source);
  if (shortenedFeast) {
    if (language === "de") return `An ${shortenedFeast[1]} Tag wurde der Name eines obligatorischen Festes mit Auslassungspunkten gekürzt.`;
    if (language === "en") return `On ${shortenedFeast[1]} day, a required feast name was shortened with an ellipsis.`;
    return `На ${shortenedFeast[1]} дні назву обов’язкового свята скорочено багатокрапкою.`;
  }
  const namedSet = /^набор: (.*)$/.exec(source);
  if (namedSet) {
    const prefix = language === "de" ? "Satz" : language === "en" ? "set" : "набір";
    return `${prefix}: ${translateInterfaceText(namedSet[1]!, language)}`;
  }
  const deleteGridTemplate = /^Удалить шаблон сетки «(.*)»\?$/.exec(source);
  if (deleteGridTemplate) {
    if (language === "de") return `Rastervorlage „${deleteGridTemplate[1]}“ löschen?`;
    if (language === "en") return `Delete grid template “${deleteGridTemplate[1]}”?`;
    return `Видалити шаблон сітки «${deleteGridTemplate[1]}»?`;
  }
  const overwriteGlobalGridTemplate = /^Заменить общий макет «(.*)» оформлением выбранной сетки\? Изменение увидят все пользователи\.$/.exec(source);
  if (overwriteGlobalGridTemplate) {
    if (language === "de") return `Gemeinsames Layout „${overwriteGlobalGridTemplate[1]}“ durch die Gestaltung des gewählten Rasters ersetzen? Alle Benutzer sehen diese Änderung.`;
    if (language === "en") return `Replace shared layout “${overwriteGlobalGridTemplate[1]}” with the selected grid styling? Every user will see this change.`;
    return `Замінити спільний макет «${overwriteGlobalGridTemplate[1]}» оформленням вибраної сітки? Зміну побачать усі користувачі.`;
  }
  const deleteGlobalGridTemplate = /^Удалить общий макет «(.*)»\? Он исчезнет у всех пользователей\.$/.exec(source);
  if (deleteGlobalGridTemplate) {
    if (language === "de") return `Gemeinsames Layout „${deleteGlobalGridTemplate[1]}“ löschen? Es verschwindet für alle Benutzer.`;
    if (language === "en") return `Delete shared layout “${deleteGlobalGridTemplate[1]}”? It will disappear for every user.`;
    return `Видалити спільний макет «${deleteGlobalGridTemplate[1]}»? Він зникне для всіх користувачів.`;
  }
  const deleteTemplate = /^Удалить шаблон «(.*)»\?$/.exec(source);
  if (deleteTemplate) {
    if (language === "de") return `Vorlage „${deleteTemplate[1]}“ löschen?`;
    if (language === "en") return `Delete template “${deleteTemplate[1]}”?`;
    return `Видалити шаблон «${deleteTemplate[1]}»?`;
  }
  const applyTemplate = /^Применить шаблон «(.*)» ко всему документу\? Текущие страницы будут заменены; действие можно отменить\.$/.exec(source);
  if (applyTemplate) {
    if (language === "de") return `Vorlage „${applyTemplate[1]}“ auf das ganze Dokument anwenden? Die aktuellen Seiten werden ersetzt; der Vorgang kann rückgängig gemacht werden.`;
    if (language === "en") return `Apply template “${applyTemplate[1]}” to the entire document? Current pages will be replaced; you can undo this action.`;
    return `Застосувати шаблон «${applyTemplate[1]}» до всього документа? Поточні сторінки буде замінено; дію можна скасувати.`;
  }
  const restoreBackup = /^Восстановить резервную копию «(.*)» от (.*)\?$/.exec(source);
  if (restoreBackup) {
    if (language === "de") return `Sicherung „${restoreBackup[1]}“ vom ${restoreBackup[2]} wiederherstellen?`;
    if (language === "en") return `Restore backup “${restoreBackup[1]}” from ${restoreBackup[2]}?`;
    return `Відновити резервну копію «${restoreBackup[1]}» від ${restoreBackup[2]}?`;
  }
  const masterSummary = /^Мастер «(.*)» будет применён к (\d+) страницам\. Названия месяцев и содержимое текстовых рамок останутся своими\. (\d+) назначенных изображений будут сохранены, а пустые фоторамки останутся пустыми\. Геометрия, сетка, шрифты и декор остальных месяцев будут заменены; действие можно отменить\.\n\nПрименить мастер-страницу\?$/.exec(source);
  if (masterSummary) {
    if (language === "de") return `Die Musterseite „${masterSummary[1]}“ wird auf ${masterSummary[2]} Seiten angewendet. Monatsnamen und Inhalte der Textrahmen bleiben erhalten. ${masterSummary[3]} zugewiesene Bilder bleiben erhalten und leere Fotorahmen bleiben leer. Geometrie, Raster, Schriften und Dekor der übrigen Monate werden ersetzt; der Vorgang kann rückgängig gemacht werden.\n\nMusterseite anwenden?`;
    if (language === "en") return `Master page “${masterSummary[1]}” will be applied to ${masterSummary[2]} pages. Month names and text-frame content will remain unchanged. ${masterSummary[3]} assigned images will be preserved and empty photo frames will stay empty. Geometry, grid, fonts and decoration in the other months will be replaced; you can undo this action.\n\nApply master page?`;
    return `Майстер «${masterSummary[1]}» буде застосовано до ${masterSummary[2]} сторінок. Назви місяців і вміст текстових рамок залишаться власними. ${masterSummary[3]} призначених зображень буде збережено, а порожні фоторамки залишаться порожніми. Геометрію, сітку, шрифти й декор інших місяців буде замінено; дію можна скасувати.\n\nЗастосувати майстер-сторінку?`;
  }
  return source;
}

const reverseTranslations = new Map<string, string>();
for (const [source, translation] of Object.entries(TRANSLATIONS)) {
  reverseTranslations.set(translation.de, source);
  reverseTranslations.set(translation.en, source);
  reverseTranslations.set(translation.uk, source);
}

interface TranslationState {
  source: string;
  rendered: string;
}

const textStateByNode = new WeakMap<Node, TranslationState>();
const attributeStatesByElement = new WeakMap<Element, Map<string, TranslationState>>();

function parts(value: string): { before: string; core: string; after: string } {
  const matched = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  return matched
    ? { before: matched[1]!, core: matched[2]!, after: matched[3]! }
    : { before: "", core: value, after: "" };
}

function translateTextNode(node: Node): void {
  if (!node.nodeValue) return;
  if (node.parentElement?.closest(".page-scene, [data-no-translate], [contenteditable]")) return;
  const current = parts(node.nodeValue);
  const previous = textStateByNode.get(node);
  const source = previous && current.core === previous.rendered
    ? previous.source
    : TRANSLATIONS[current.core]
      ? current.core
      : reverseTranslations.get(current.core) ?? current.core;
  const translated = `${current.before}${translateInterfaceText(source)}${current.after}`;
  textStateByNode.set(node, { source, rendered: parts(translated).core });
  if (translated !== node.nodeValue) node.nodeValue = translated;
}

function translateAttribute(element: Element, attribute: string): void {
  if (element.closest(".page-scene, [data-no-translate], [contenteditable]")) return;
  const value = element.getAttribute(attribute);
  if (value === null) return;
  const current = parts(value);
  let states = attributeStatesByElement.get(element);
  if (!states) {
    states = new Map();
    attributeStatesByElement.set(element, states);
  }
  const previous = states.get(attribute);
  const source = previous && current.core === previous.rendered
    ? previous.source
    : TRANSLATIONS[current.core]
      ? current.core
      : reverseTranslations.get(current.core) ?? current.core;
  const translated = `${current.before}${translateInterfaceText(source)}${current.after}`;
  states.set(attribute, { source, rendered: parts(translated).core });
  if (translated !== value) element.setAttribute(attribute, translated);
}

const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt", "label"] as const;

function translateElement(element: Element): void {
  // The page scene is the user's printable document, not application chrome.
  if (element.closest(".page-scene, [data-no-translate], [contenteditable]")) return;
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    translateAttribute(element, attribute);
  }
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.nodeValue) {
      translateTextNode(child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      translateElement(child as Element);
    }
  }
}

/** Keeps static and Vue-rendered interface copy in sync without touching document data. */
export function installInterfaceTranslator(root: Element): () => void {
  let translating = false;
  const translateRoot = (): void => {
    if (translating) return;
    translating = true;
    document.documentElement.lang = interfaceLanguage.value;
    translateElement(root);
    translating = false;
  };
  translateRoot();
  const observer = new MutationObserver((mutations) => {
    if (translating) return;
    translating = true;
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeValue) {
        translateTextNode(mutation.target);
      } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
        translateElement(mutation.target);
      } else {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
            translateTextNode(node);
          }
          else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node as Element);
        }
      }
    }
    translating = false;
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
  });
  const stopLanguageWatch = watch(interfaceLanguage, translateRoot, { flush: "post" });
  return () => {
    observer.disconnect();
    stopLanguageWatch();
  };
}
