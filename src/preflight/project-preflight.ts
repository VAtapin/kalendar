import type { OrthodoxCalendarYear } from "../calendar";
import type {
  CalendarGridElement,
  CalendarProject,
  LayoutElementNode,
  PageModel,
  TextElement,
  MonthTextElement,
} from "../document/types";
import {
  buildCalendarGridLayout,
  layoutCalendarCellTextAutoFit,
} from "../layout/calendar-grid-layout";
import { layoutTextBlock } from "../layout/text-layout";
import { cropMarksFitBleed } from "../export/print-marks";
import { unsupportedGlyphs } from "../typography/glyph-coverage";

export type PreflightSeverity = "warning" | "error";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  code:
    | "missing-asset"
    | "missing-food-marker"
    | "calendar-row-overflow"
    | "calendar-text-overflow"
    | "calendar-required-event-hidden"
    | "text-overflow"
    | "outside-page"
    | "outside-safe-area"
    | "missing-calendar-grid"
    | "missing-calendar-data"
    | "low-image-resolution"
    | "crop-marks-outside-bleed"
    | "binding-safe-area"
    | "missing-glyph"
    | "missing-output-intent"
    | "missing-month-page"
    | "duplicate-month-page"
    | "page-order";
  message: string;
  pageId: string;
  pageName: string;
  elementId?: string;
}

function issue(
  page: PageModel,
  element: LayoutElementNode | undefined,
  code: PreflightIssue["code"],
  severity: PreflightSeverity,
  message: string,
): PreflightIssue {
  return {
    id: `${page.id}:${element?.id ?? "page"}:${code}:${message}`,
    severity,
    code,
    message,
    pageId: page.id,
    pageName: page.name,
    ...(element ? { elementId: element.id } : {}),
  };
}

function isOutsidePage(element: LayoutElementNode, page: PageModel): boolean {
  return element.x < 0 || element.y < 0 || element.x + element.width > page.width || element.y + element.height > page.height;
}

function isOutsideSafeArea(element: LayoutElementNode, page: PageModel): boolean {
  const left = page.safeArea.left;
  const top = page.safeArea.top;
  const right = page.width - page.safeArea.right;
  const bottom = page.height - page.safeArea.bottom;
  return element.x < left || element.y < top || element.x + element.width > right || element.y + element.height > bottom;
}

function isInBindingZone(
  element: LayoutElementNode,
  page: PageModel,
  edge: NonNullable<CalendarProject["printSettings"]>["bindingEdge"],
  margin: number,
): boolean {
  if (!edge || edge === "none" || margin <= 0) return false;
  if (edge === "top") return element.y < margin;
  if (edge === "left") return element.x < margin;
  if (edge === "right") return element.x + element.width > page.width - margin;
  return false;
}

function printableElementText(element: LayoutElementNode): string {
  if (element.type === "text" || element.type === "month-text") {
    return `${element.content.title} ${element.type === "month-text" ? element.attribution ?? "" : ""}`;
  }
  if (element.type === "calendar-grid") {
    const labels = element.customWeekdayLabels ?? [];
    return labels.join(" ");
  }
  return "";
}

function checkPageSequence(project: CalendarProject): PreflightIssue[] {
  const monthPages = project.document.pages
    .map((page, index) => ({
      page,
      index,
      month: page.elements.find((element): element is CalendarGridElement => element.type === "calendar-grid")?.month,
    }))
    .filter((entry): entry is { page: PageModel; index: number; month: number } => entry.page.kind === "month" && Boolean(entry.month));
  // Partial one-page documents are legitimate. Sequence completeness becomes
  // mandatory once the project clearly represents a full annual calendar.
  if (monthPages.length < 10) return [];
  const anchor = project.document.pages[0] ?? monthPages[0]!.page;
  const issues: PreflightIssue[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const occurrences = monthPages.filter((entry) => entry.month === month);
    if (occurrences.length === 0) {
      issues.push(issue(anchor, undefined, "missing-month-page", "error", `В документе отсутствует страница месяца № ${month}.`));
    } else if (occurrences.length > 1) {
      issues.push(issue(occurrences[1]!.page, undefined, "duplicate-month-page", "error", `Месяц № ${month} представлен более одного раза.`));
    }
  }
  const actual = monthPages.map((entry) => entry.month);
  const ordered = [...actual].sort((left, right) => left - right);
  if (actual.some((month, index) => month !== ordered[index])) {
    issues.push(issue(anchor, undefined, "page-order", "error", "Страницы месяцев расположены не по календарному порядку."));
  }
  const coverIndex = project.document.pages.findIndex((page) => page.kind === "cover");
  if (coverIndex > 0) {
    issues.push(issue(project.document.pages[coverIndex]!, undefined, "page-order", "warning", "Обложка должна быть первой страницей документа."));
  }
  return issues;
}

function checkTextFrame(
  page: PageModel,
  element: TextElement | MonthTextElement,
): PreflightIssue | undefined {
  const fontSizeMm = element.typography.fontSizePt * (25.4 / 72);
  const lineHeightMm = fontSizeMm * element.typography.lineHeight;
  const padding = element.typography.paddingMm;
  const attributionHeight = element.type === "month-text" && element.attribution
    ? fontSizeMm * 0.72 + lineHeightMm * 0.25
    : 0;
  const layout = layoutTextBlock(
    element.content.title,
    Math.max(0, element.width - padding * 2),
    Math.max(0, element.height - padding * 2 - attributionHeight),
    lineHeightMm,
    (value) => value.length * fontSizeMm * 0.52 + Math.max(0, Array.from(value).length - 1) * element.typography.letterSpacingPt * (25.4 / 72),
  );
  return layout.overflow
    ? issue(page, element, "text-overflow", "warning", "Текст не помещается в рамку.")
    : undefined;
}

function checkCalendarGrid(
  page: PageModel,
  element: CalendarGridElement,
  calendar: OrthodoxCalendarYear,
  calendarLanguage: CalendarProject["calendarLanguage"],
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const layout = buildCalendarGridLayout(element, calendar);
  if (layout.hasRowOverflow) {
    issues.push(issue(
      page,
      element,
      "calendar-row-overflow",
      "error",
      `Для месяца требуется ${layout.requiredWeekRows} недель, задано ${element.weekRows}.`,
    ));
  }
  let overflowingDays = 0;
  let daysWithHiddenRequiredEvents = 0;
  for (const cell of layout.cells) {
    if (!cell.day) continue;
    const text = layoutCalendarCellTextAutoFit(
      element,
      cell,
      (value, fontSizeMm) => value.length * fontSizeMm * 0.52,
      calendarLanguage,
    );
    if (text.truncatedRequiredEventCount > 0) overflowingDays += 1;
    if (text.hiddenRequiredEventCount > 0) daysWithHiddenRequiredEvents += 1;
  }
  if (daysWithHiddenRequiredEvents > 0) {
    issues.push(issue(
      page,
      element,
      "calendar-required-event-hidden",
      "error",
      `На ${daysWithHiddenRequiredEvents} ${daysWithHiddenRequiredEvents === 1 ? "дне" : "днях"} не помещается обязательный великий или средний праздник.`,
    ));
  }
  if (overflowingDays > 0) {
    issues.push(issue(
      page,
      element,
      "calendar-text-overflow",
      "warning",
      `На ${overflowingDays} ${overflowingDays === 1 ? "дне" : "днях"} название обязательного праздника сокращено многоточием.`,
    ));
  }
  return issues;
}

/** Runs without reading the DOM. The same project model can therefore be checked in UI or CLI. */
export function checkCalendarProject(
  project: CalendarProject,
  calendar?: OrthodoxCalendarYear,
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));

  if (project.printSettings?.pdfStandard === "PDF/X-4") {
    const profile = project.printSettings.iccProfileAssetId
      ? assets.get(project.printSettings.iccProfileAssetId)
      : undefined;
    if (!profile || profile.kind !== "icc-profile") {
      const page = project.document.pages[0];
      if (page) issues.push(issue(page, undefined, "missing-output-intent", "error", "Для PDF/X-4 не загружен ICC-профиль типографии."));
    }
  }
  for (const face of project.customFonts ?? []) {
    const asset = assets.get(face.assetId);
    if (!asset || asset.kind !== "font") {
      const page = project.document.pages[0];
      if (page) issues.push(issue(page, undefined, "missing-asset", "error", `Не найден файл пользовательского шрифта «${face.family}».`));
    }
  }

  for (const page of project.document.pages) {
    if (project.printSettings?.includeCropMarks && !cropMarksFitBleed(page, project.printSettings)) {
      issues.push(issue(
        page,
        undefined,
        "crop-marks-outside-bleed",
        "warning",
        "Для выбранной длины меток реза недостаточно поля вылетов.",
      ));
    }
    const grids = page.elements.filter(
      (element): element is CalendarGridElement => element.type === "calendar-grid" && element.visible,
    );
    if (page.kind === "month" && grids.length === 0) {
      issues.push(issue(page, undefined, "missing-calendar-grid", "error", "На странице месяца нет календарной сетки."));
    }

    for (const element of page.elements) {
      if (!element.visible) continue;
      if ((element.type === "image" || element.type === "svg") && (!element.assetId || !assets.has(element.assetId))) {
        issues.push(issue(
          page,
          element,
          "missing-asset",
          "warning",
          element.type === "image" ? "В рамку не помещено изображение." : "Не выбран SVG-файл.",
        ));
      }
      if (element.type === "image" && element.assetId) {
        const asset = assets.get(element.assetId);
        if (asset?.widthPx && asset.heightPx && element.width > 0 && element.height > 0) {
          const effectiveDpi = Math.min(
            asset.widthPx / (element.width / 25.4),
            asset.heightPx / (element.height / 25.4),
          );
          if (effectiveDpi < 300) {
            issues.push(issue(
              page,
              element,
              "low-image-resolution",
              effectiveDpi < 150 ? "error" : "warning",
              `Эффективное разрешение изображения около ${Math.round(effectiveDpi)} dpi; для печати желательно 300 dpi.`,
            ));
          }
        }
      }
      if (isOutsidePage(element, page)) {
        issues.push(issue(page, element, "outside-page", "error", "Объект выходит за границы обрезного формата."));
      } else if (
        (element.type === "text" || element.type === "month-text" || element.type === "calendar-grid" || element.type === "legend") &&
        isOutsideSafeArea(element, page)
      ) {
        issues.push(issue(page, element, "outside-safe-area", "warning", "Важный объект выходит за безопасную область."));
      }
      if (
        (element.type === "text" || element.type === "month-text" || element.type === "calendar-grid" || element.type === "legend") &&
        isInBindingZone(
          element,
          page,
          project.printSettings?.bindingEdge,
          project.printSettings?.bindingSafeMm ?? 0,
        )
      ) {
        issues.push(issue(page, element, "binding-safe-area", "warning", "Важный объект входит в защитную зону переплёта или пружины."));
      }
      const missingGlyphs = unsupportedGlyphs(printableElementText(element));
      if (missingGlyphs.length) {
        issues.push(issue(page, element, "missing-glyph", "warning", `Нужно проверить глифы шрифта: ${missingGlyphs.slice(0, 8).join(" ")}.`));
      }
      if (element.type === "text" || element.type === "month-text") {
        const textIssue = checkTextFrame(page, element);
        if (textIssue) issues.push(textIssue);
      }
      if (element.type === "calendar-grid") {
        if (!calendar) {
          issues.push(issue(page, element, "missing-calendar-data", "error", "Календарные данные ещё не загружены."));
          continue;
        }
        issues.push(...checkCalendarGrid(page, element, calendar, project.calendarLanguage));
        // Every rule has a built-in marker in the selected pack. A custom image,
        // when supplied, simply overrides that rule without making it required.
      }
    }
  }
  issues.push(...checkPageSequence(project));
  return issues;
}
