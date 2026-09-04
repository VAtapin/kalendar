import type { OrthodoxCalendarDay, OrthodoxCalendarYear } from "../calendar";
import type { CalendarGridElement } from "../document/types";
import { layoutTextBlock, type MeasureTextWidth } from "./text-layout";
import {
  isMinorCommemorationEvent,
  selectCalendarCellEvents,
} from "../calendar/presentation/calendar-content-policy";

export const WEEKDAY_LABELS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const;

export interface CalendarGridCellLayout {
  key: string;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  day?: OrthodoxCalendarDay;
}

export interface CalendarGridLayout {
  headerHeight: number;
  columnWidth: number;
  rowHeight: number;
  requiredWeekRows: number;
  hasRowOverflow: boolean;
  cells: CalendarGridCellLayout[];
}

export interface CalendarCellTextLine {
  key: string;
  text: string;
  event: OrthodoxCalendarDay["events"][number];
  x: number;
  baselineY: number;
  fontSizeMm: number;
  isContinuation: boolean;
}

export interface CalendarCellTextLayout {
  lines: CalendarCellTextLine[];
  hiddenEventCount: number;
  truncatedEventCount: number;
  usedFontSizePt?: number;
}

export interface CalendarCellTypography {
  dayNumberFontSizeMm: number;
  eventFontSizeMm: number;
  eventLineHeightMm: number;
  paddingMm: number;
  contentLeftMm: number;
  eventMarkerWidthMm: number;
  eventMarkerSizeMm: number;
  foodMarkerSizeMm: number;
}

export interface CalendarFoodMarkerGeometry {
  xOffsetMm: number;
  yOffsetMm: number;
  sizeMm: number;
}

export function calendarCellTypography(element: CalendarGridElement): CalendarCellTypography {
  const dayNumberFontSizeMm = (element.dayNumberFontSizePt ?? 28) * (25.4 / 72);
  const eventFontSizeMm = (element.eventFontSizePt ?? 9) * (25.4 / 72);
  const eventLineHeightMm = eventFontSizeMm * (element.eventLineHeight ?? 1.08);
  const paddingMm = Math.max(0.4, element.cellPaddingMm ?? 1.5);
  const cellWidthMm = element.width / 7;
  const maximumNumberRailMm = Math.max(7.2, cellWidthMm * 0.43);
  const numberRailMm = Math.min(
    maximumNumberRailMm,
    Math.max(14.2, dayNumberFontSizeMm * 1.35),
  );
  const eventMarkerSizeMm = Math.min(4.6, Math.max(4.1, eventFontSizeMm * 1.5));
  const eventMarkerWidthMm = element.showTypikonIcons === true ? eventMarkerSizeMm + 0.7 : 0;
  return {
    dayNumberFontSizeMm,
    eventFontSizeMm,
    eventLineHeightMm,
    paddingMm,
    contentLeftMm: paddingMm + numberRailMm,
    eventMarkerWidthMm,
    eventMarkerSizeMm,
    // The marker is deliberately almost as prominent as the date, but never
    // larger than it. It forms one vertical stack with the date number.
    foodMarkerSizeMm: Math.min(
      dayNumberFontSizeMm * 0.92,
      Math.max(7, Math.min(9.5, numberRailMm - 0.4)),
    ),
  };
}

export function calendarFoodMarkerGeometry(
  element: CalendarGridElement,
  cell: CalendarGridCellLayout,
): CalendarFoodMarkerGeometry {
  const typography = calendarCellTypography(element);
  const yOffsetMm = typography.paddingMm + typography.dayNumberFontSizeMm +
    (element.showOldStyleDate ? 5 : 2);
  const availableHeightMm = Math.max(0, cell.height - yOffsetMm - typography.paddingMm);
  const sizeMm = Math.max(0, Math.min(typography.foodMarkerSizeMm, availableHeightMm));
  return {
    // Same left edge as the date number: the sign must read as being below the
    // number rather than as a separate icon beside it.
    xOffsetMm: typography.paddingMm,
    yOffsetMm,
    sizeMm,
  };
}

/**
 * Flows event names inside the text column of one day cell. The number occupies
 * a stable left column, while event lines share the remaining height fairly.
 */
export function layoutCalendarCellText(
  element: CalendarGridElement,
  cell: CalendarGridCellLayout,
  measure: MeasureTextWidth,
): CalendarCellTextLayout {
  const day = cell.day;
  if (!day) return { lines: [], hiddenEventCount: 0, truncatedEventCount: 0 };
  const typography = calendarCellTypography(element);
  const contentWidth = Math.max(
    typography.eventFontSizeMm * 2,
    cell.width - typography.contentLeftMm - typography.eventMarkerWidthMm - typography.paddingMm,
  );
  const totalLineCapacity = Math.max(
    1,
    Math.floor((cell.height - typography.paddingMm * 2) / typography.eventLineHeightMm),
  );
  const displayEvents = selectCalendarCellEvents(element, day.events);
  const visibleEvents = displayEvents.slice(0, Math.max(1, element.maxVisibleEvents ?? 3));
  const hiddenEventCount = Math.max(0, displayEvents.length - visibleEvents.length);
  let remainingLines = totalLineCapacity;
  let cursor = typography.paddingMm + typography.eventFontSizeMm;
  let truncatedEventCount = 0;
  const lines: CalendarCellTextLine[] = [];

  visibleEvents.forEach((event, eventIndex) => {
    if (remainingLines <= 0) {
      truncatedEventCount += 1;
      return;
    }
    const remainingEvents = Math.max(1, visibleEvents.length - eventIndex);
    const fairShare = Math.max(1, Math.floor(remainingLines / remainingEvents));
    // A single important commemoration may use the otherwise empty height of
    // the cell. With several events the fair-share limit still keeps balance.
    const allowedLines = Math.min(5, fairShare, remainingLines);
    const candidates = eventDisplayCandidates(event);
    let eventLayout = layoutTextBlock(
      candidates.at(-1) ?? event.title,
      contentWidth,
      allowedLines * typography.eventLineHeightMm,
      typography.eventLineHeightMm,
      measure,
    );
    for (const candidate of candidates) {
      const candidateLayout = layoutTextBlock(
        candidate,
        contentWidth,
        allowedLines * typography.eventLineHeightMm,
        typography.eventLineHeightMm,
        measure,
      );
      eventLayout = candidateLayout;
      if (!candidateLayout.overflow) break;
    }
    if (eventLayout.overflow && isMinorCommemorationEvent(event)) return;
    if (eventLayout.overflow) truncatedEventCount += 1;
    eventLayout.lines.forEach((line, lineIndex) => {
      const isLast = lineIndex === eventLayout.lines.length - 1;
      const text = isLast && eventLayout.overflow && !line.text.endsWith("…")
        ? `${line.text.replace(/[.,;:!?\s]+$/u, "")}…`
        : line.text;
      lines.push({
        key: `${event.id}-${lineIndex}`,
        text,
        event,
        x: typography.contentLeftMm + typography.eventMarkerWidthMm,
        baselineY: cursor,
        fontSizeMm: typography.eventFontSizeMm,
        isContinuation: lineIndex > 0,
      });
      cursor += typography.eventLineHeightMm;
      remainingLines -= 1;
    });
  });

  return {
    lines,
    hiddenEventCount,
    truncatedEventCount,
  };
}

/** Tries smaller allowed type sizes before accepting truncation. */
export function layoutCalendarCellTextAutoFit(
  element: CalendarGridElement,
  cell: CalendarGridCellLayout,
  measure: (text: string, fontSizeMm: number) => number,
): CalendarCellTextLayout {
  const requested = element.eventFontSizePt ?? 9;
  const minimum = element.autoFitText === false
    ? requested
    : Math.min(requested, Math.max(3, element.minimumEventFontSizePt ?? 8));
  let best: CalendarCellTextLayout | undefined;
  for (let size = requested; size >= minimum - 0.001; size -= 0.25) {
    const candidateSize = Math.max(minimum, size);
    const candidateElement = { ...element, eventFontSizePt: candidateSize };
    const sizeMm = candidateSize * (25.4 / 72);
    const candidate = layoutCalendarCellText(
      candidateElement,
      cell,
      (value) => measure(value, sizeMm),
    );
    candidate.usedFontSizePt = candidateSize;
    best = candidate;
    // A deliberate event-count limit cannot be solved by shrinking the type.
    // Keep the requested print size whenever every selected visible item fits.
    if (candidate.truncatedEventCount === 0) break;
  }
  return best ?? { lines: [], hiddenEventCount: 0, truncatedEventCount: 0, usedFontSizePt: requested };
}

export function buildCalendarGridLayout(
  element: CalendarGridElement,
  calendar: OrthodoxCalendarYear,
): CalendarGridLayout {
  const monthDays = calendar.days.filter((day) => day.date.month === element.month);
  const headerHeight = element.showWeekdayHeader === false
    ? 0
    : Math.min(10, Math.max(6, element.height * 0.085));
  const columnWidth = element.width / 7;
  const rowHeight = (element.height - headerHeight) / element.weekRows;
  const firstDay = monthDays[0];
  const firstColumn = firstDay ? (firstDay.weekday + 6) % 7 : 0;
  const requiredWeekRows = Math.ceil((firstColumn + monthDays.length) / 7);
  const cells: CalendarGridCellLayout[] = [];

  for (let row = 0; row < element.weekRows; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const dayIndex = row * 7 + column - firstColumn;
      const day = dayIndex >= 0 ? monthDays[dayIndex] : undefined;
      cells.push({
        key: `${row}-${column}`,
        column,
        row,
        x: element.x + column * columnWidth,
        y: element.y + headerHeight + row * rowHeight,
        width: columnWidth,
        height: rowHeight,
        ...(day ? { day } : {}),
      });
    }
  }

  return {
    headerHeight,
    columnWidth,
    rowHeight,
    requiredWeekRows,
    hasRowOverflow: requiredWeekRows > element.weekRows,
    cells,
  };
}

export function eventDisplayTitle(event: OrthodoxCalendarDay["events"][number]): string {
  return event.veryShortTitle ?? event.shortTitle ?? event.title;
}

export function eventDisplayCandidates(event: OrthodoxCalendarDay["events"][number]): string[] {
  return [event.title, event.shortTitle, event.veryShortTitle]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, values) => values.indexOf(value) === index);
}
