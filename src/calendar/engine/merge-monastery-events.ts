import type { MonasteryEvent } from "../../document/types";
import type { OrthodoxCalendarYear, ResolvedCalendarEvent } from "../types";
import { toIsoDate } from "../date/calendar-date";

export function mergeMonasteryEvents(
  calendar: OrthodoxCalendarYear,
  monasteryEvents: MonasteryEvent[],
): OrthodoxCalendarYear {
  if (monasteryEvents.length === 0) return calendar;
  const days = calendar.days.map((day) => ({ ...day, events: [...day.events] }));
  const daysByIsoDate = Object.fromEntries(days.map((day) => [day.isoDate, day]));

  monasteryEvents.forEach((localEvent, index) => {
    const date =
      localEvent.dateRule.type === "annual"
        ? { year: calendar.year, month: localEvent.dateRule.month, day: localEvent.dateRule.day }
        : parseIsoDate(localEvent.dateRule.date);
    if (!date || date.year !== calendar.year) return;
    const isoDate = toIsoDate(date);
    const day = daysByIsoDate[isoDate];
    if (!day) return;
    const event: ResolvedCalendarEvent = {
      id: `monastery:${localEvent.id}:${isoDate}`,
      sourceId: localEvent.id,
      sourceIndex: 1_000_000 + index,
      title: localEvent.title,
      ...(localEvent.shortTitle ? { shortTitle: localEvent.shortTitle } : {}),
      ...(localEvent.veryShortTitle ? { veryShortTitle: localEvent.veryShortTitle } : {}),
      typeCode: -100,
      occurrenceDate: date,
      spanStart: date,
      spanFinish: date,
      dayIndexInSpan: 0,
      ruleKind: "project-event",
      priority: localEvent.priority,
      ...(localEvent.styleToken ? { styleToken: localEvent.styleToken } : {}),
    };
    day.events.push(event);
    day.events.sort((left, right) => right.priority - left.priority || left.sourceIndex - right.sourceIndex);
  });

  return { ...calendar, days, daysByIsoDate };
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return undefined;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
