import type { PageModel, PrintSettings } from "../document/types";
import { buildCropMarkSegments } from "./print-marks";

/** Opaque 300 dpi page images go straight to the CMYK PDF writer. */
export function packagePrintPages(
  pages: readonly PageModel[],
  images: readonly Blob[],
  settings: PrintSettings | undefined,
): Blob {
  if (pages.length === 0 || pages.length !== images.length) throw new Error("Не все страницы подготовлены для печати");
  const manifest = {
    version: 1,
    pages: pages.map((page, index) => ({
      widthMm: page.width,
      heightMm: page.height,
      bleed: page.bleed,
      imageBytes: images[index]!.size,
      cropMarks: settings ? buildCropMarkSegments(page, settings) : [],
    })),
  };
  const encoded = new TextEncoder().encode(JSON.stringify(manifest));
  if (encoded.length > 1024 * 1024) throw new Error("Слишком много данных страниц для экспорта");
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode("KLPAGES1"));
  new DataView(header.buffer).setUint32(8, encoded.length, false);
  return new Blob([header, encoded, ...images], { type: "application/octet-stream" });
}
