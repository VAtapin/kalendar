import type { OrthodoxCalendarDay, OrthodoxCalendarYear } from "../calendar";
import type { CalendarGridElement, CalendarLanguage } from "../document/types";
import { localizeCalendarEvent } from "../calendar/localization/calendar-language";
import { layoutTextBlock, type MeasureTextWidth } from "./text-layout";
import {
  isMinorCommemorationEvent,
  isRequiredCalendarEvent,
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
  hiddenRequiredEventCount: number;
  omittedMinorEventCount: number;
  truncatedRequiredEventCount: number;
  usedFontSizePt?: number;
}

export interface CalendarCellTypography {
  dayNumberFontSizeMm: number;
  dayNumberXOffsetMm: number;
  dayNumberYOffsetMm: number;
  oldStyleFontSizeMm: number;
  oldStyleXOffsetMm: number;
  oldStyleYOffsetMm: number;
  eventFontSizeMm: number;
  eventLineHeightMm: number;
  eventGapMm: number;
  paddingMm: number;
  contentLeftMm: number;
  eventTopMm: number;
  eventRightInsetMm: number;
  eventBottomInsetMm: number;
  eventMarkerWidthMm: number;
  eventMarkerSizeMm: number;
  eventMarkerXOffsetMm: number;
  eventMarkerYOffsetMm: number;
  foodMarkerSizeMm: number;
}

export interface CalendarFoodMarkerGeometry {
  xOffsetMm: number;
  yOffsetMm: number;
  sizeMm: number;
}

export function calendarCellTypography(element: CalendarGridElement): CalendarCellTypography {
  const dayNumberFontSizeMm = Math.max(0.1, element.dayNumberFontSizePt ?? 30) * (25.4 / 72);
  const oldStyleFontSizeMm = Math.max(0.1, element.oldStyleFontSizePt ?? 4.4) * (25.4 / 72);
  const eventFontSizeMm = Math.max(0.1, element.eventFontSizePt ?? 10) * (25.4 / 72);
  const legacyLineSpacingPt = (element.eventFontSizePt ?? 10) * ((element.eventLineHeight ?? 1.08) - 1);
  const eventLineSpacingPt = element.eventLineSpacingPt ?? legacyLineSpacingPt;
  const eventLineHeightMm = Math.max(0.05, (element.eventFontSizePt ?? 10) + eventLineSpacingPt) * (25.4 / 72);
  const eventGapMm = (element.eventGapPt ?? 1) * (25.4 / 72);
  const paddingMm = element.cellPaddingMm ?? 1.5;
  const cellWidthMm = element.width / 7;
  const maximumNumberRailMm = Math.max(7.2, cellWidthMm * 0.43);
  const numberRailMm = Math.min(
    maximumNumberRailMm,
    Math.max(14.2, dayNumberFontSizeMm * 1.35),
  );
  const defaultEventMarkerSizeMm = Math.min(4.6, Math.max(4.1, eventFontSizeMm * 1.5));
  const eventMarkerSizeMm = Math.max(0.1, element.typikonMarkerSizeMm ?? defaultEventMarkerSizeMm);
  const eventMarkerWidthMm = element.showTypikonIcons === true ? eventMarkerSizeMm + 0.7 : 0;
  const defaultContentLeftMm = paddingMm + numberRailMm + eventMarkerWidthMm;
  const defaultFoodMarkerSizeMm = Math.min(
    dayNumberFontSizeMm * 0.92,
    Math.max(7, Math.min(9.5, numberRailMm - 0.4)),
  );
  return {
    dayNumberFontSizeMm,
    dayNumberXOffsetMm: element.dayNumberXOffsetMm ?? paddingMm,
    dayNumberYOffsetMm: element.dayNumberYOffsetMm ?? paddingMm,
    oldStyleFontSizeMm,
    oldStyleXOffsetMm: element.oldStyleXOffsetMm ?? paddingMm,
    oldStyleYOffsetMm: element.oldStyleYOffsetMm ?? paddingMm + dayNumberFontSizeMm + 1.05,
    eventFontSizeMm,
    eventLineHeightMm,
    eventGapMm,
    paddingMm,
    contentLeftMm: element.eventTextXOffsetMm ?? defaultContentLeftMm,
    eventTopMm: element.eventTextYOffsetMm ?? paddingMm,
    eventRightInsetMm: element.eventTextRightInsetMm ?? paddingMm,
    eventBottomInsetMm: element.eventTextBottomInsetMm ?? paddingMm,
    // Kept as a public measurement for existing integrations. Text position is
    // now independent and no longer changes when the marker is resized.
    eventMarkerWidthMm: 0,
    eventMarkerSizeMm,
    eventMarkerXOffsetMm: element.typikonMarkerXOffsetMm ?? paddingMm + numberRailMm,
    eventMarkerYOffsetMm: element.typikonMarkerYOffsetMm ?? 0,
    foodMarkerSizeMm: Math.max(0.1, element.foodMarkerSizeMm ?? defaultFoodMarkerSizeMm),
  };
}

export function calendarFoodMarkerGeometry(
  element: CalendarGridElement,
  _cell: CalendarGridCellLayout,
): CalendarFoodMarkerGeometry {
  const typography = calendarCellTypography(element);
  return {
    xOffsetMm: element.foodMarkerXOffsetMm ?? typography.dayNumberXOffsetMm,
    yOffsetMm: element.foodMarkerYOffsetMm ?? typography.dayNumberYOffsetMm + typography.dayNumberFontSizeMm + 2,
    sizeMm: typography.foodMarkerSizeMm,
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
  calendarLanguage: CalendarLanguage = "ru",
): CalendarCellTextLayout {
  const day = cell.day;
  if (!day) return {
    lines: [],
    hiddenEventCount: 0,
    truncatedEventCount: 0,
    hiddenRequiredEventCount: 0,
    omittedMinorEventCount: 0,
    truncatedRequiredEventCount: 0,
  };
  const typography = calendarCellTypography(element);
  const contentWidth = Math.max(
    typography.eventFontSizeMm * 2,
    cell.width - typography.contentLeftMm - typography.eventRightInsetMm,
  );
  const displayEvents = selectCalendarCellEvents(element, day.events);
  const requiredEvents = displayEvents.filter(isRequiredCalendarEvent);
  const minorEvents = displayEvents.filter(isMinorCommemorationEvent);
  const requestedLimit = Math.max(0, element.maxVisibleEvents ?? 3);
  // maxVisibleEvents is a limit for optional content, never permission to hide
  // a great/medium feast or a memorial day.
  const visibleEvents = [
    ...requiredEvents,
    ...minorEvents.slice(0, Math.max(0, requestedLimit - requiredEvents.length)),
  ];
  const gapsHeightMm = Math.max(0, visibleEvents.length - 1) * typography.eventGapMm;
  const totalLineCapacity = Math.max(
    1,
    Math.floor((cell.height - typography.eventTopMm - typography.eventBottomInsetMm - gapsHeightMm) / typography.eventLineHeightMm),
  );
  const omittedByLimit = Math.max(0, minorEvents.length - Math.max(0, requestedLimit - requiredEvents.length));
  const hiddenEventCount = omittedByLimit;
  let remainingLines = totalLineCapacity;
  let cursor = typography.eventTopMm + typography.eventFontSizeMm;
  let truncatedEventCount = 0;
  let hiddenRequiredEventCount = 0;
  let omittedMinorEventCount = omittedByLimit;
  let truncatedRequiredEventCount = 0;
  let renderedEventCount = 0;
  const lines: CalendarCellTextLine[] = [];

  visibleEvents.forEach((event, eventIndex) => {
    if (remainingLines <= 0) {
      if (isMinorCommemorationEvent(event)) omittedMinorEventCount += 1;
      else {
        hiddenRequiredEventCount += 1;
        truncatedEventCount += 1;
        truncatedRequiredEventCount += 1;
      }
      return;
    }
    const remainingEvents = Math.max(1, visibleEvents.length - eventIndex);
    const fairShare = Math.max(1, Math.floor(remainingLines / remainingEvents));
    // A single important commemoration may use the otherwise empty height of
    // the cell. With several events the fair-share limit still keeps balance.
    const allowedLines = Math.min(fairShare, remainingLines);
    const candidates = eventDisplayCandidates(event, calendarLanguage);
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
    if (eventLayout.overflow && isMinorCommemorationEvent(event)) {
      omittedMinorEventCount += 1;
      return;
    }
    if (eventLayout.overflow) {
      truncatedEventCount += 1;
      truncatedRequiredEventCount += 1;
    }
    if (renderedEventCount > 0) cursor += typography.eventGapMm;
    eventLayout.lines.forEach((line, lineIndex) => {
      const isLast = lineIndex === eventLayout.lines.length - 1;
      const text = isLast && eventLayout.overflow && !line.text.endsWith("…")
        ? `${line.text.replace(/[.,;:!?\s]+$/u, "")}…`
        : line.text;
      lines.push({
        key: `${event.id}-${lineIndex}`,
        text,
        event,
        x: typography.contentLeftMm,
        baselineY: cursor,
        fontSizeMm: typography.eventFontSizeMm,
        isContinuation: lineIndex > 0,
      });
      cursor += typography.eventLineHeightMm;
      remainingLines -= 1;
    });
    if (eventLayout.lines.length > 0) renderedEventCount += 1;
  });

  return {
    lines,
    hiddenEventCount,
    truncatedEventCount,
    hiddenRequiredEventCount,
    omittedMinorEventCount,
    truncatedRequiredEventCount,
  };
}

/** Tries smaller allowed type sizes before accepting truncation. */
export function layoutCalendarCellTextAutoFit(
  element: CalendarGridElement,
  cell: CalendarGridCellLayout,
  measure: (text: string, fontSizeMm: number) => number,
  calendarLanguage: CalendarLanguage = "ru",
): CalendarCellTextLayout {
  const requested = Math.max(0.1, element.eventFontSizePt ?? 10);
  const minimum = element.autoFitText === false
    ? requested
    : Math.min(requested, Math.max(0.1, element.minimumEventFontSizePt ?? 9));
  let best: CalendarCellTextLayout | undefined;
  for (let size = requested; size >= minimum - 0.001; size -= 0.25) {
    const candidateSize = Math.max(minimum, size);
    const candidateElement = { ...element, eventFontSizePt: candidateSize };
    const sizeMm = candidateSize * (25.4 / 72);
    const candidate = layoutCalendarCellText(
      candidateElement,
      cell,
      (value) => measure(value, sizeMm),
      calendarLanguage,
    );
    candidate.usedFontSizePt = candidateSize;
    best = candidate;
    // A deliberate event-count limit cannot be solved by shrinking the type.
    // Keep the requested print size whenever every selected visible item fits.
    if (candidate.hiddenRequiredEventCount === 0 && candidate.truncatedRequiredEventCount === 0) break;
  }
  return best ?? {
    lines: [],
    hiddenEventCount: 0,
    truncatedEventCount: 0,
    hiddenRequiredEventCount: 0,
    omittedMinorEventCount: 0,
    truncatedRequiredEventCount: 0,
    usedFontSizePt: requested,
  };
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

export function eventDisplayCandidates(
  event: OrthodoxCalendarDay["events"][number],
  calendarLanguage: CalendarLanguage = "ru",
): string[] {
  const localized = localizeCalendarEvent(event, calendarLanguage);
  return [localized.title, localized.shortTitle, localized.veryShortTitle]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, values) => values.indexOf(value) === index);
}
