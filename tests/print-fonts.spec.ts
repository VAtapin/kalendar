import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankCalendarProject, createBlankPage } from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";
import { preparePrintFontCss } from "../src/export/print-fonts";

afterEach(() => vi.unstubAllGlobals());

describe("print page fonts", () => {
  function customFontProject() {
    const project = createBlankCalendarProject(2027);
    const page = createBlankPage('A5', 'portrait');
    project.document.pages = [page];
    const { element } = createElementOnOwnLayer(page, 'text', { x: 10, y: 10, width: 50, height: 10 });
    if (element.type === 'text') element.typography.fontFamily = 'Print Recovery';
    project.assets.push({ id: 'font-recovery', name: 'font.ttf', kind: 'font', mimeType: 'font/ttf', source: 'data:font/ttf;base64,cmVjb3Zlcnk=' });
    project.customFonts = [{ assetId: 'font-recovery', family: 'Print Recovery', fontWeight: 400, fontStyle: 'normal' }];
    return { project, page };
  }

  it('loads embedded font bytes despite failed screen faces and reuses the loaded face', async () => {
    const { project, page } = customFontProject();
    const fonts = { load: vi.fn(async () => { throw new DOMException('A network error occurred.', 'NetworkError'); }), add: vi.fn(), ready: Promise.resolve() };
    const sources: string[] = [];
    const load = vi.fn(async function (this: unknown) { return this; });
    vi.stubGlobal('FontFace', class {
      load = load;
      constructor(_family: string, source: string) { sources.push(source); }
    });
    vi.stubGlobal('document', { fonts });
    const css = await preparePrintFontCss(page, project);
    expect(css).toContain('data:font/ttf;base64,cmVjb3Zlcnk=');
    expect(sources).toEqual(['url("data:font/ttf;base64,cmVjb3Zlcnk=")']);
    await preparePrintFontCss(page, project);
    expect(load).toHaveBeenCalledTimes(1);
    expect(fonts.add).toHaveBeenCalledTimes(1);
    expect(fonts.load).not.toHaveBeenCalled();
  });

  it('retries font decoding after a failed print attempt instead of caching its rejection', async () => {
    const { project, page } = customFontProject();
    let attempts = 0;
    vi.stubGlobal('FontFace', class {
      async load() {
        if (++attempts === 1) throw new DOMException('A network error occurred.', 'NetworkError');
        return this;
      }
    });
    const add = vi.fn();
    vi.stubGlobal('document', { fonts: { add, ready: Promise.resolve() } });
    await expect(preparePrintFontCss(page, project)).rejects.toMatchObject({
      message: 'Не удалось подготовить шрифты для печати. Повторите попытку.', cause: { name: 'NetworkError' },
    });
    await expect(preparePrintFontCss(page, project)).resolves.toContain('Print Recovery');
    expect(attempts).toBe(2);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('re-fetches a bundled font after a temporary download failure', async () => {
    const { project, page } = customFontProject();
    const element = page.elements[0];
    if (element?.type === 'text') element.typography.fontFamily = 'DS Yermak_D';
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue({ ok: true, blob: async () => new Blob(['font']) });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('FileReader', class {
      result = 'data:font/ttf;base64,Zm9udA==';
      handler?: () => void;
      addEventListener(event: string, handler: () => void) { if (event === 'load') this.handler = handler; }
      readAsDataURL() { this.handler?.(); }
    });
    vi.stubGlobal('document', {});
    await expect(preparePrintFontCss(page, project)).rejects.toThrow('HTTP 503');
    await expect(preparePrintFontCss(page, project)).resolves.toContain('DS Yermak_D');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

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
