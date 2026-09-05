import { describe, expect, it } from "vitest";
import { copyCalendarGridPresentation } from "../src/templates/calendar-grid-settings";
import { FASTING_COLORS } from '../src/calendar/presentation/fasting-colors';
import { FOOD_RULES } from '../src/calendar/fasting/fasting-api';
import {
  defaultGlobalCalendarGridTemplates,
  mergeGlobalCalendarGridTemplates,
} from "../src/templates/calendar-grid-presets";

describe("global calendar-grid layouts", () => {
  it('copies color fasting mode and removes it when applying an icon template', () => {
    const templates = defaultGlobalCalendarGridTemplates();
    const colored = templates.find(t => t.id === 'fasting-colors')!;
    const classic = templates.find(t => t.id === 'editorial-classic')!;
    const target = structuredClone(classic.grid);
    copyCalendarGridPresentation(colored.grid, target);
    expect(target.showFastingColors).toBe(true);
    expect(target.showFoodIcons).toBe(false);
    copyCalendarGridPresentation(classic.grid, target);
    expect(target.showFastingColors).toBeUndefined();
    expect(target.showFoodIcons).toBe(true);
    expect(Object.keys(FASTING_COLORS).sort()).toEqual(Object.keys(FOOD_RULES).sort());
    expect(new Set(Object.values(FASTING_COLORS)).size).toBe(Object.keys(FOOD_RULES).length);
  });
  it("ships six visibly distinct editable layouts", () => {
    const templates = defaultGlobalCalendarGridTemplates();
    expect(templates).toHaveLength(6);
    expect(new Set(templates.map((template) => template.id)).size).toBe(6);
    expect(new Set(templates.map((template) => template.grid.gridStyle)).size).toBe(3);
    expect(new Set(templates.map((template) => template.grid.weekdayFontFamily)).size).toBe(5);
    expect(new Set(templates.map((template) => template.grid.dayNumberFontFamily)).size).toBe(5);
    expect(templates.some((template) => template.grid.weekdayLabelMode === "full")).toBe(true);
    expect(templates.some((template) => template.grid.weekdayLabelMode === "short")).toBe(true);
    expect(templates.some((template) => template.grid.weekdayTextEffects?.gradient)).toBe(true);
  });

  it("applies presentation without replacing month or frame geometry", () => {
    const [source, targetTemplate] = defaultGlobalCalendarGridTemplates();
    const target = structuredClone(targetTemplate!.grid);
    target.month = 9;
    target.x = 17;
    target.y = 121;
    target.width = 201;
    target.height = 133;

    copyCalendarGridPresentation(source!.grid, target);

    expect(target.month).toBe(9);
    expect([target.x, target.y, target.width, target.height]).toEqual([17, 121, 201, 133]);
    expect(target.weekdayFontFamily).toBe(source!.grid.weekdayFontFamily);
    expect(target.gridStyle).toBe(source!.grid.gridStyle);
  });

  it("merges server overrides and custom layouts with the five bundled layouts", () => {
    const defaults = defaultGlobalCalendarGridTemplates();
    const changed = {
      ...defaults[0]!,
      name: "Обновлённый макет",
      grid: { ...defaults[0]!.grid, eventFontSizePt: 11 },
    };
    const custom = {
      ...defaults[1]!,
      id: "custom-layout",
      name: "Авторский",
      builtIn: false,
    };

    const merged = mergeGlobalCalendarGridTemplates([changed, custom]);

    expect(merged).toHaveLength(7);
    expect(merged[0]?.name).toBe("Обновлённый макет");
    expect(merged[0]?.grid.eventFontSizePt).toBe(11);
    expect(merged.at(-1)?.id).toBe("custom-layout");
  });
});
