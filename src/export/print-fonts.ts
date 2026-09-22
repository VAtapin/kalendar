import type { CalendarProject, PageModel } from "../document/types";
import { BUNDLED_FONT_FILES, type BundledFontFamily } from "../typography/font-catalog";

interface PrintFontFace {
  family: string;
  source: string;
  weight: number;
  style: "normal" | "italic";
}

const bundledFontData = new Map<string, Promise<string>>();

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
    });
    bundledFontData.set(file, pending);
  }
  return pending;
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
  if (faces.length && "fonts" in document) {
    await Promise.all(faces.map((face) => document.fonts.load(`${face.style} ${face.weight} 12px ${JSON.stringify(face.family)}`)));
    await document.fonts.ready;
  }
  return faces.map((face) => `@font-face{font-family:${JSON.stringify(face.family)};src:url(${JSON.stringify(face.source)});font-style:${face.style};font-weight:${face.weight}}`).join("\n");
}
