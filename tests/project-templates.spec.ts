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

  it("keeps month text, empty photo frames, and the target row count", () => {
    const project = createBlankCalendarProject(2027);
    project.document.pages = createFullCalendarTemplate("A3", "portrait", 2027, "Издатель");
    const january = project.document.pages[1]!;
    const february = project.document.pages[2]!;
    const sourceTitle = january.elements.find((element) => element.type === "text");
    const targetTitle = february.elements.find((element) => element.type === "text");
    const sourceImage = january.elements.find((element) => element.type === "image");
    const targetImage = february.elements.find((element) => element.type === "image");
    const sourceGrid = january.elements.find((element) => element.type === "calendar-grid");
    const targetGrid = february.elements.find((element) => element.type === "calendar-grid");
    if (!sourceTitle || !targetTitle || !sourceImage || !targetImage || !sourceGrid || !targetGrid) {
      throw new Error("template elements missing");
    }

    sourceTitle.content.title = "ЯНВАРЬ";
    sourceTitle.typography.fontFamily = "Ruslan Display";
    sourceTitle.typography.fontSizePt = 44;
    targetTitle.content.title = "ФЕВРАЛЬ";
    targetTitle.typography.fontFamily = "Arial";
    targetTitle.typography.fontSizePt = 12;
    sourceImage.assetId = "january-photo";
    targetImage.assetId = "";
    sourceGrid.y = 123;
    sourceGrid.weekRows = 6;
    targetGrid.weekRows = 4;

    applyMonthMaster(project, january.id);

    const nextTitle = february.elements.find((element) => element.type === "text");
    const nextImage = february.elements.find((element) => element.type === "image");
    const nextGrid = february.elements.find((element) => element.type === "calendar-grid");
    expect(nextTitle?.content.title).toBe("ФЕВРАЛЬ");
    expect(nextTitle?.typography.fontFamily).toBe("Ruslan Display");
    expect(nextTitle?.typography.fontSizePt).toBe(44);
    expect(nextImage?.assetId).toBe("");
    expect(nextGrid?.month).toBe(2);
    expect(nextGrid?.weekRows).toBe(4);
    expect(nextGrid?.y).toBe(123);
  });
});
