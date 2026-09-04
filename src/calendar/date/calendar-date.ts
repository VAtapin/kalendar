import type { CalendarDate } from "../types";

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function gregorianToJulianDay(date: CalendarDate): number {
  const a = Math.floor((14 - date.month) / 12);
  const year = date.year + 4800 - a;
  const month = date.month + 12 * a - 3;
  return (
    date.day +
    Math.floor((153 * month + 2) / 5) +
    365 * year +
    Math.floor(year / 4) -
    Math.floor(year / 100) +
    Math.floor(year / 400) -
    32045
  );
}

export function julianToJulianDay(date: CalendarDate): number {
  const a = Math.floor((14 - date.month) / 12);
  const year = date.year + 4800 - a;
  const month = date.month + 12 * a - 3;
  return (
    date.day +
    Math.floor((153 * month + 2) / 5) +
    365 * year +
    Math.floor(year / 4) -
    32083
  );
}

export function julianDayToGregorian(julianDay: number): CalendarDate {
  const a = julianDay + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

export function julianDayToJulian(julianDay: number): CalendarDate {
  const c = julianDay + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: d - 4800 + Math.floor(m / 10),
  };
}

export function julianToGregorian(date: CalendarDate): CalendarDate {
  return julianDayToGregorian(julianToJulianDay(date));
}

export function gregorianToJulian(date: CalendarDate): CalendarDate {
  return julianDayToJulian(gregorianToJulianDay(date));
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return julianDayToGregorian(gregorianToJulianDay(date) + days);
}

export function compareDates(left: CalendarDate, right: CalendarDate): number {
  return gregorianToJulianDay(left) - gregorianToJulianDay(right);
}

export function dayOfWeek(date: CalendarDate): number {
  return positiveModulo(gregorianToJulianDay(date) + 1, 7);
}

export function toIsoDate(date: CalendarDate): string {
  const year = String(date.year).padStart(4, "0");
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfYear(year: number): CalendarDate {
  return { year, month: 1, day: 1 };
}

export function endOfYear(year: number): CalendarDate {
  return { year, month: 12, day: 31 };
}

export function enumerateDates(start: CalendarDate, finish: CalendarDate): CalendarDate[] {
  const startDay = gregorianToJulianDay(start);
  const finishDay = gregorianToJulianDay(finish);
  if (finishDay < startDay) return [];

  const result: CalendarDate[] = [];
  for (let day = startDay; day <= finishDay; day += 1) {
    result.push(julianDayToGregorian(day));
  }
  return result;
}

