import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml, type OrthodoxCalendarYear } from "../src/calendar";
import type { CalendarGridElement, PageFormatId } from "../src/document/types";
import {
  buildCalendarGridLayout,
  calendarCellTypography,
  calendarFoodMarkerGeometry,
  layoutCalendarCellTextAutoFit,
} from "../src/layout/calendar-grid-layout";
import {
  CALENDAR_TEMPLATE_PRESETS,
  createMonthTemplatePageWithPreset,
} from "../src/templates/calendar-templates";

describe("print calendar quality matrix", () => {
  let calendar: OrthodoxCalendarYear;

  beforeAll(async () => {
    const xml = await readFile(resolve(import.meta.dirname, "../public/data/MemoryDays.xml"), "utf8");
    calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
  });

  for (const format of ["A3", "A4", "A5", "A6"] satisfies PageFormatId[]) {
    for (const preset of CALENDAR_TEMPLATE_PRESETS) {
      it(`${format} / ${preset.id}: lays out all 12 months without losing required feasts`, () => {
        for (let month = 1; month <= 12; month += 1) {
          const page = createMonthTemplatePageWithPreset(format, "portrait", month, 2027, preset.id);
          const grid = page.elements.find(
            (element): element is CalendarGridElement => element.type === "calendar-grid",
          );
          const legend = page.elements.find((element) => element.type === "legend");
          expect(grid).toBeDefined();
          expect(legend).toBeDefined();
          if (!grid || !legend) continue;
          const layout = buildCalendarGridLayout(grid, calendar);
          expect(layout.hasRowOverflow).toBe(false);
          expect(grid.y + grid.height).toBeLessThanOrEqual(legend.y + 0.001);
          const typography = calendarCellTypography(grid);
          for (const cell of layout.cells) {
            if (!cell.day) continue;
            const marker = calendarFoodMarkerGeometry(grid, cell);
            expect(marker.sizeMm).toBeLessThanOrEqual(typography.dayNumberFontSizeMm);
            const text = layoutCalendarCellTextAutoFit(
              grid,
              cell,
              (value, fontSizeMm) => Array.from(value).length * fontSizeMm * 0.52,
            );
            expect(
              text.hiddenRequiredEventCount,
              `${format}/${preset.id}/${cell.day.isoDate}: ${cell.day.events.map((event) => event.veryShortTitle).join(" | ")}`,
            ).toBe(0);
          }
        }
      });
    }
  }
});
