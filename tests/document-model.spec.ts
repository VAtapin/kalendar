import { describe, expect, it } from "vitest";
import {
  A3_PORTRAIT,
  changePageFormat,
  createBlankPage,
  createBlankA3Document,
  createBlankCalendarProject,
} from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";
import { buildPageScene } from "../src/rendering/page-scene";

describe("DocumentModel", () => {
  it("preserves typography and markers through repeated orientation changes", () => {
    const page = createBlankPage("A3", "portrait");
    for (const tool of ["text", "rectangle", "calendar-grid"] as const) {
      createElementOnOwnLayer(page, tool, { x: 20, y: 40, width: 100, height: 60 });
    }
    const grid = page.elements.find((element) => element.type === "calendar-grid")!;
    if (grid.type !== "calendar-grid") throw new Error("grid expected");
    Object.assign(grid, {
      dayNumberFontSizePt: 24, eventFontSizePt: 12, weekdayFontSizePt: 14,
      oldStyleFontSizePt: 8, eventLineSpacingPt: 2, eventGapPt: 3,
      cellPaddingMm: 2, foodMarkerSizeMm: 5, typikonMarkerSizeMm: 4,
      dayNumberXOffsetMm: 2, dayNumberYOffsetMm: 3,
    });
    const original = structuredClone(page);
    for (let cycle = 0; cycle < 30; cycle += 1) {
      changePageFormat(page, "A3", "landscape");
      expect(grid.dayNumberFontSizePt).toBe(24);
      expect(grid.eventFontSizePt).toBe(12);
      expect(grid.foodMarkerSizeMm).toBe(5);
      changePageFormat(page, "A3", "portrait");
    }
    // All numeric geometry and style properties must survive the round trip.
    const check = (actual: unknown, expected: unknown): void => {
      if (typeof expected === "number") expect(actual).toBeCloseTo(expected, 10);
      else if (expected && typeof expected === "object") {
        for (const [key, value] of Object.entries(expected)) {
          check((actual as Record<string, unknown>)[key], value);
        }
      } else expect(actual).toEqual(expected);
    };
    check(page, original);
    for (let cycle = 0; cycle < 30; cycle += 1) {
      changePageFormat(page, "A5", "landscape");
      changePageFormat(page, "A4", "portrait");
      changePageFormat(page, "A3", "portrait");
    }
    check(page, original);
  });

  it("stores printable geometry exclusively in millimetres", () => {
    const document = createBlankA3Document();
    const page = document.pages[0];

    expect(document.unit).toBe("mm");
    expect(page).toMatchObject({
      width: A3_PORTRAIT.width,
      height: A3_PORTRAIT.height,
      bleed: { top: 3, right: 3, bottom: 3, left: 3 },
    });
    expect(page?.elements).toEqual([]);
    expect(page?.layers.map((layer) => layer.name)).toEqual(["Слой 1"]);
  });

  it("keeps calendar data, styling and printable pages separate", () => {
    const project = createBlankCalendarProject(2027);

    expect(project.year).toBe(2027);
    expect(project.calendarData).toBeNull();
    expect(project.monasteryEvents).toEqual([]);
    expect(project.styleTheme.tokens.sunday?.numberColor).toBeDefined();
    expect(project.document.pages).toHaveLength(1);
  });

  it("scales page objects and typography when the format changes", () => {
    const page = createBlankPage("A3", "portrait");
    page.name = "Январь 2027";
    const text = createElementOnOwnLayer(
      page,
      "text",
      { x: 20, y: 40, width: 100, height: 30 },
    ).element;
    changePageFormat(page, "A4", "portrait");
    expect(text.x).toBeCloseTo(20 * (210 / 297));
    expect(text.width).toBeCloseTo(100 * (210 / 297));
    if (text.type !== "text") throw new Error("text expected");
    expect(text.typography.fontSizePt).toBeCloseTo(12 * (210 / 297));
    expect(page.name).toBe("Январь 2027");
  });
});

describe("PageScene", () => {
  it("derives media, trim and safe boxes without UI or DOM state", () => {
    const page = createBlankA3Document().pages[0];
    if (!page) throw new Error("Expected an A3 page");

    const scene = buildPageScene(page);

    expect(scene.mediaBox).toEqual({ x: -3, y: -3, width: 303, height: 426 });
    expect(scene.trimBox).toEqual({ x: 0, y: 0, width: 297, height: 420 });
    expect(scene.safeBox).toEqual({ x: 10, y: 15, width: 277, height: 395 });
  });
});
