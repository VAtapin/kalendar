import type { CalendarProject, PageModel } from "../document/types";
import { BUNDLED_FONT_FILES, type BundledFontFamily } from "../typography/font-catalog";
import { translateInterfaceText } from '../i18n/interface-language';

interface PrintFontFace {
  family: string;
  source: string;
  weight: number;
  style: "normal" | "italic";
}

const bundledFontData = new Map<string, Promise<string>>();
const loadedPrintFaces = new WeakMap<FontFaceSet, Map<string, Map<string, Promise<FontFace>>>>();

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Не удалось прочитать шрифт")));
    reader.readAsDataURL(blob);
  });
}

function bundledDataUrl(file: string): Promise<string> {
  let pending = bundledFontData.get(file);
  if (!pending) {
    pending = fetch(`/fonts/${file}`).then(async (response) => {
      if (!response.ok) throw new Error(`Не удалось загрузить шрифт ${file}: HTTP ${response.status}`);
      return blobAsDataUrl(await response.blob());
    }).catch(error => {
      // A temporary failure must not poison every later export in this tab.
      if (bundledFontData.get(file) === pending) bundledFontData.delete(file);
      throw error;
    });
    bundledFontData.set(file, pending);
  }
  return pending;
}

async function loadPrintFace(face: PrintFontFace): Promise<void> {
  const fonts = document.fonts;
  let variants = loadedPrintFaces.get(fonts);
  if (!variants) { variants = new Map(); loadedPrintFaces.set(fonts, variants); }
  const variant = JSON.stringify([face.family, face.style, face.weight]);
  let sources = variants.get(variant);
  if (!sources) { sources = new Map(); variants.set(variant, sources); }
  let pending = sources.get(face.source);
  if (!pending) {
    pending = new FontFace(face.family, `url(${JSON.stringify(face.source)})`, {
      style: face.style, weight: String(face.weight),
    }).load().then(loaded => { fonts.add(loaded); return loaded; }).catch(error => {
      if (sources.get(face.source) === pending) sources.delete(face.source);
      throw new Error(translateInterfaceText('Не удалось подготовить шрифты для печати. Повторите попытку.'), { cause: error });
    });
    sources.set(face.source, pending);
  }
  await pending;
}

function usedPageFontFamilies(page: PageModel, project: CalendarProject): Set<string> {
  const families = new Set<string>();
  if (project.calendarLanguage === "cu") families.add("Monomakh Unicode");
  for (const element of page.elements) {
    if (element.type === "text" || element.type === "month-text") {
      families.add(element.typography.fontFamily);
    } else if (element.type === "calendar-grid") {
      families.add(element.weekdayFontFamily ?? "Ruslan Display");
      families.add(element.dayNumberFontFamily ?? "Yeseva One");
      families.add(element.eventFontFamily ?? "Cormorant Garamond");
      families.add(element.oldStyleFontFamily ?? "Cormorant Garamond");
    } else if (element.type === "legend") {
      families.add("Cormorant Garamond");
    }
  }
  return families;
}

/** html-to-image does not discover fonts inside SVG descendants of its HTML root. */
export async function preparePrintFontCss(page: PageModel, project: CalendarProject): Promise<string> {
  const used = usedPageFontFamilies(page, project);
  const faces: PrintFontFace[] = [];
  for (const [family, files] of Object.entries(BUNDLED_FONT_FILES) as Array<[BundledFontFamily, typeof BUNDLED_FONT_FILES[BundledFontFamily]]>) {
    if (!used.has(family)) continue;
    for (const [variant, file] of Object.entries(files)) {
      if (!file) continue;
      faces.push({
        family,
        source: await bundledDataUrl(file),
        weight: variant === "bold" || variant === "boldItalic" ? 700 : 400,
        style: variant === "italic" || variant === "boldItalic" ? "italic" : "normal",
      });
    }
  }
  if (used.has("Cormorant Garamond")) {
    faces.push({
      family: "Cormorant Garamond",
      source: await bundledDataUrl("CormorantGaramond-SemiBold.ttf"),
      weight: 600,
      style: "normal",
    });
  }
  for (const face of project.customFonts ?? []) {
    if (!used.has(face.family)) continue;
    const asset = project.assets.find((item) => item.id === face.assetId && item.kind === "font");
    if (!asset?.source.startsWith("data:")) throw new Error(`Не найден шрифт ${face.family} для печати`);
    faces.push({ family: face.family, source: asset.source, weight: face.fontWeight, style: face.fontStyle });
  }
  if (faces.length && "fonts" in document && typeof FontFace !== 'undefined') {
    // Load the embedded bytes themselves. FontFaceSet.load also retries failed
    // screen/CSS registrations of the same family and can reject with NetworkError
    // even though every font needed by the print SVG has already been fetched.
    for (const face of faces) await loadPrintFace(face);
    await document.fonts.ready;
  }
  return faces.map((face) => `@font-face{font-family:${JSON.stringify(face.family)};src:url(${JSON.stringify(face.source)});font-style:${face.style};font-weight:${face.weight}}`).join("\n");
}
