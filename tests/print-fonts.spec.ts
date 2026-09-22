import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankCalendarProject, createBlankPage } from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";
import { preparePrintFontCss } from "../src/export/print-fonts";

afterEach(() => vi.unstubAllGlobals());

describe("print page fonts", () => {
  it("embeds the page's decorative, semibold, and uploaded fonts for SVG capture", async () => {
    const page = createBlankPage("A5", "portrait");
    const project = createBlankCalendarProject(2027);
    project.document.pages = [page];
    for (const family of ["Rurintania", "Cormorant Garamond", "Uploaded Title"]) {
      const item = createElementOnOwnLayer(page, "text", { x: 10, y: 10, width: 50, height: 10 });
      if (item.element.type === "text") item.element.typography.fontFamily = family;
    }
    project.assets.push({
      id: "uploaded-font", name: "title.ttf", kind: "font", mimeType: "font/ttf",
      source: "data:font/ttf;base64,dXBsb2FkZWQ=",
    });
    project.customFonts = [{ assetId: "uploaded-font", family: "Uploaded Title", fontWeight: 400, fontStyle: "normal" }];

    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      requested.push(url);
      return { ok: true, blob: async () => new Blob(["font"], { type: "font/ttf" }) };
    }));
    vi.stubGlobal("FileReader", class {
      result: string | null = null;
      private handlers = new Map<string, () => void>();
      addEventListener(event: string, handler: () => void) { this.handlers.set(event, handler); }
      readAsDataURL() {
        this.result = "data:font/ttf;base64,Zm9udA==";
        this.handlers.get("load")?.();
      }
    });
    vi.stubGlobal("document", { fonts: { load: vi.fn(async () => []), ready: Promise.resolve() } });

    const css = await preparePrintFontCss(page, project);
    expect(requested).toContain("/fonts/Rurintania.ttf");
    expect(requested).toContain("/fonts/CormorantGaramond-SemiBold.ttf");
    expect(css).toContain('font-family:"Rurintania";src:url("data:font/ttf;base64,Zm9udA==")');
    expect(css).toContain("font-weight:600");
    expect(css).toContain('font-family:"Uploaded Title";src:url("data:font/ttf;base64,dXBsb2FkZWQ=")');
    expect(css).not.toContain('font-family:"Yeseva One"');
  });
});
