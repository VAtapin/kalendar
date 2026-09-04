import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import { buildCalendarGridLayout, layoutCalendarCellTextAutoFit } from "../src/layout/calendar-grid-layout";
import { CALENDAR_TEMPLATE_PRESETS, createMonthTemplatePageWithPreset } from "../src/templates/calendar-templates";
import type { CalendarGridElement } from "../src/document/types";

const workspace = resolve(import.meta.dirname, "..");
const xml = await readFile(resolve(workspace, "public/data/MemoryDays.xml"), "utf8");
const parseStarted = performance.now();
const dataset = parseMemoryDaysXml(xml);
const parseMs = performance.now() - parseStarted;

const yearsStarted = performance.now();
const calendars = Array.from({ length: 10 }, (_, index) => buildOrthodoxCalendarYear(2025 + index, dataset));
const tenYearsMs = performance.now() - yearsStarted;

const calendar = calendars[2]!;
let laidOutCells = 0;
const layoutStarted = performance.now();
for (const preset of CALENDAR_TEMPLATE_PRESETS) {
  for (const format of ["A3", "A4", "A5", "A6"] as const) {
    for (let month = 1; month <= 12; month += 1) {
      const page = createMonthTemplatePageWithPreset(format, "portrait", month, 2027, preset.id);
      const grid = page.elements.find((element): element is CalendarGridElement => element.type === "calendar-grid")!;
      const layout = buildCalendarGridLayout(grid, calendar);
      for (const cell of layout.cells) {
        if (!cell.day) continue;
        layoutCalendarCellTextAutoFit(
          grid,
          cell,
          (value, fontSizeMm) => Array.from(value).length * fontSizeMm * 0.52,
        );
        laidOutCells += 1;
      }
    }
  }
}
const layoutMatrixMs = performance.now() - layoutStarted;
const result = { parseMs, tenYearsMs, layoutMatrixMs, laidOutCells };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (parseMs > 2_000 || tenYearsMs > 3_000 || layoutMatrixMs > 2_000) {
  throw new Error("Performance budget exceeded");
}
