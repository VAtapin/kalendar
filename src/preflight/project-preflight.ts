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

export type PreflightSeverity = "warning" | "error";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  code:
    | "missing-asset"
    | "missing-food-marker"
    | "calendar-row-overflow"
    | "calendar-text-overflow"
    | "text-overflow"
    | "outside-page"
    | "outside-safe-area"
    | "missing-calendar-grid"
    | "missing-calendar-data"
    | "low-image-resolution"
    | "crop-marks-outside-bleed";
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
  for (const cell of layout.cells) {
    if (!cell.day) continue;
    const text = layoutCalendarCellTextAutoFit(
      element,
      cell,
      (value, fontSizeMm) => value.length * fontSizeMm * 0.52,
    );
    if (text.hiddenEventCount > 0 || text.truncatedEventCount > 0) overflowingDays += 1;
  }
  if (overflowingDays > 0) {
    issues.push(issue(
      page,
      element,
      "calendar-text-overflow",
      "warning",
      `На ${overflowingDays} ${overflowingDays === 1 ? "дне" : "днях"} менее значимые памяти скрыты или текст сокращён для печати.`,
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
      if (element.type === "text" || element.type === "month-text") {
        const textIssue = checkTextFrame(page, element);
        if (textIssue) issues.push(textIssue);
      }
      if (element.type === "calendar-grid") {
        if (!calendar) {
          issues.push(issue(page, element, "missing-calendar-data", "error", "Календарные данные ещё не загружены."));
          continue;
        }
        issues.push(...checkCalendarGrid(page, element, calendar));
        // Every rule has a built-in marker in the selected pack. A custom image,
        // when supplied, simply overrides that rule without making it required.
      }
    }
  }
  return issues;
}
