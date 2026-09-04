import type { CalendarDate } from "../types";
import { julianToGregorian } from "../date/calendar-date";

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/**
 * Calculates Orthodox Pascha in the Julian calendar and converts the physical
 * date to the Gregorian calendar used by the printed civil year.
 */
export function calculateOrthodoxPascha(year: number): CalendarDate {
  const a = positiveModulo(year, 4);
  const b = positiveModulo(year, 7);
  const c = positiveModulo(year, 19);
  const d = positiveModulo(19 * c + 15, 30);
  const e = positiveModulo(2 * a + 4 * b - d + 34, 7);
  const sum = d + e + 114;
  const julianMonth = Math.floor(sum / 31);
  const julianDay = positiveModulo(sum, 31) + 1;

  return julianToGregorian({ year, month: julianMonth, day: julianDay });
}

