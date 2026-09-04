import { describe, expect, it } from "vitest";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import { createBlankCalendarProject } from "../src/document/factories";
import { checkCalendarProject } from "../src/preflight/project-preflight";
import { createMonthTemplatePage } from "../src/templates/calendar-templates";
import { createFullCalendarTemplate } from "../src/templates/calendar-templates";

const xml = `<MemoryDays><event>
  <s_month>1</s_month><s_date>1</s_date><f_month>1</f_month><f_date>1</f_date>
  <name>Праздник</name><type>1</type>
</event></MemoryDays>`;

describe("project preflight", () => {
  it("reports an empty photo slot while accepting built-in food markers", () => {
    const project = createBlankCalendarProject(2027);
    project.document.pages = [createMonthTemplatePage("A3", "portrait", 1, 2027, () => crypto.randomUUID())];
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
    const issues = checkCalendarProject(project, calendar);
    expect(issues.some((item) => item.code === "missing-asset")).toBe(true);
    expect(issues.some((item) => item.code === "missing-food-marker")).toBe(false);
  });

  it("reports a month grid that cannot fit the required week rows", () => {
    const project = createBlankCalendarProject(2027);
    const page = createMonthTemplatePage("A3", "portrait", 5, 2027, () => crypto.randomUUID());
    const grid = page.elements.find((element) => element.type === "calendar-grid");
    if (!grid || grid.type !== "calendar-grid") throw new Error("grid expected");
    grid.weekRows = 5;
    project.document.pages = [page];
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
    expect(checkCalendarProject(project, calendar).some((item) => item.code === "calendar-row-overflow")).toBe(true);
  });

  it("checks the effective print resolution of placed raster images", () => {
    const project = createBlankCalendarProject(2027);
    const page = createMonthTemplatePage("A3", "portrait", 1, 2027, () => crypto.randomUUID());
    const image = page.elements.find((element) => element.type === "image");
    if (!image || image.type !== "image") throw new Error("image expected");
    image.assetId = "small-photo";
    project.assets.push({
      id: "small-photo",
      name: "small.jpg",
      mimeType: "image/jpeg",
      source: "data:image/jpeg;base64,AA==",
      kind: "image",
      widthPx: 800,
      heightPx: 600,
    });
    project.document.pages = [page];
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
    const resolution = checkCalendarProject(project, calendar).find((item) => item.code === "low-image-resolution");
    expect(resolution?.severity).toBe("error");
  });

  it("checks annual page completeness and order", () => {
    const project = createBlankCalendarProject(2027);
    project.document.pages = createFullCalendarTemplate("A3", "portrait", 2027, "Издатель");
    project.document.pages.splice(5, 1);
    const twoMonths = project.document.pages.filter((page) => page.kind === "month").slice(0, 2);
    if (twoMonths.length === 2) {
      const left = project.document.pages.indexOf(twoMonths[0]!);
      const right = project.document.pages.indexOf(twoMonths[1]!);
      [project.document.pages[left], project.document.pages[right]] = [project.document.pages[right]!, project.document.pages[left]!];
    }
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
    const codes = checkCalendarProject(project, calendar).map((item) => item.code);
    expect(codes).toContain("missing-month-page");
    expect(codes).toContain("page-order");
  });

  it("checks binding safety, glyph coverage and PDF/X output intent", () => {
    const project = createBlankCalendarProject(2027);
    const page = createMonthTemplatePage("A3", "portrait", 1, 2027, () => crypto.randomUUID());
    const title = page.elements.find((element) => element.type === "text");
    if (!title || title.type !== "text") throw new Error("title expected");
    title.y = 1;
    title.content.title = "Январь 😀";
    project.document.pages = [page];
    project.printSettings = {
      includeCropMarks: true,
      cropMarkLengthMm: 2,
      cropMarkOffsetMm: 0.5,
      bindingEdge: "top",
      bindingSafeMm: 20,
      pdfStandard: "PDF/X-4",
      colorProfile: "CMYK-custom",
    };
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
    const codes = checkCalendarProject(project, calendar).map((item) => item.code);
    expect(codes).toContain("binding-safe-area");
    expect(codes).toContain("missing-glyph");
    expect(codes).toContain("missing-output-intent");
  });
});
