import { describe, expect, it } from "vitest";
import { createBlankCalendarProject } from "../src/document/factories";
import { createFullCalendarTemplate } from "../src/templates/calendar-templates";
import { applyMonthMaster, cloneProjectForYear } from "../src/templates/project-templates";

describe("project templates and year cloning", () => {
  it("changes the year without rebuilding or losing manual geometry", () => {
    const project = createBlankCalendarProject(2027);
    project.document.pages = createFullCalendarTemplate("A3", "portrait", 2027, "Издатель");
    const grid = project.document.pages[1]!.elements.find((element) => element.type === "calendar-grid");
    if (!grid) throw new Error("grid missing");
    grid.x = 22.75;
    const copy = cloneProjectForYear(project, 2028, () => "copy");
    const copiedGrid = copy.document.pages[1]!.elements.find((element) => element.type === "calendar-grid");
    expect(copy.year).toBe(2028);
    expect(copy.document.pages[1]!.name).toBe("Январь 2028");
    expect(copiedGrid?.x).toBe(22.75);
  });

  it("applies a month master and preserves assigned monthly photographs", () => {
    const project = createBlankCalendarProject(2027);
    project.document.pages = createFullCalendarTemplate("A3", "portrait", 2027, "Издатель");
    const january = project.document.pages[1]!;
    const february = project.document.pages[2]!;
    const sourceGrid = january.elements.find((element) => element.type === "calendar-grid");
    const targetImage = february.elements.find((element) => element.type === "image");
    if (!sourceGrid || !targetImage) throw new Error("template elements missing");
    sourceGrid.y = 123;
    targetImage.assetId = "february-photo";
    const result = applyMonthMaster(project, january.id);
    const FebruaryGrid = february.elements.find((element) => element.type === "calendar-grid");
    const FebruaryImage = february.elements.find((element) => element.type === "image");
    expect(result.changedPages).toBe(11);
    expect(FebruaryGrid?.month).toBe(2);
    expect(FebruaryGrid?.y).toBe(123);
    expect(FebruaryImage?.assetId).toBe("february-photo");
  });
});
