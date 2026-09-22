import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createBlankPage } from "../src/document/factories";
import { packagePrintPages } from "../src/export/print-raster";

describe("direct print PDF", () => {
  it("writes opaque CMYK pages with a PDF/X-1a:2001 output intent and PDF 1.3 header", async () => {
    const page = createBlankPage("A5", "portrait");
    page.width = 25.4;
    page.height = 25.4;
    page.bleed = { left: 0, right: 0, top: 0, bottom: 0 };
    const image = await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#db9045" },
    }).jpeg().toBuffer();
    const packageBlob = packagePrintPages([page], [new Blob([image])], undefined);
    const directory = mkdtempSync(join(tmpdir(), "calendar-print-"));
    try {
      const input = join(directory, "pages.bin");
      const output = join(directory, "print.pdf");
      writeFileSync(input, Buffer.from(await packageBlob.arrayBuffer()));
      execFileSync(process.execPath, [
        resolve("scripts/build-print-pdf.mjs"), input,
        resolve("public/icc/ISOcoated_v2_300_eci.icc"), output, "ISO Coated v2 300% (ECI)",
      ]);
      const bytes = readFileSync(output);
      expect(bytes.toString("ascii", 0, 8)).toBe("%PDF-1.3");
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
      const headerObjects = bytes.subarray(0, 4096).toString("latin1");
      expect(headerObjects).toContain("/GTS_PDFXVersion (PDF/X-1a:2001)");
      expect(headerObjects).toContain("/CreationDate");
      expect(headerObjects).toContain("/ModDate");
      expect(bytes.subarray(-500).toString("latin1")).toContain("/ID [");
      expect(pdf.catalog.get(PDFName.of("OutputIntents"))).toBeDefined();
      expect(headerObjects).toContain("/ColorSpace /DeviceCMYK");
      expect(bytes.includes(Buffer.from("/SMask"))).toBe(false);
      expect(headerObjects).not.toMatch(/\/(?:ca|CA)\s+[0-9]/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps detailed 300 dpi CMYK pages compact", async () => {
    const width = 300;
    const height = 300;
    const pixels = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 3;
        pixels[offset] = (x * 11 + y * 7) % 256;
        pixels[offset + 1] = (x * 3 + y * 17) % 256;
        pixels[offset + 2] = (x * 19 + y * 5) % 256;
      }
    }
    const source = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 96 }).toBuffer();
    const profilePath = resolve("public/icc/ISOcoated_v2_300_eci.icc");
    const oldEncoding = await sharp(source).toColourspace("cmyk")
      .withIccProfile(profilePath, { attach: false })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
    const page = createBlankPage("A5", "portrait");
    page.width = 25.4;
    page.height = 25.4;
    page.bleed = { left: 0, right: 0, top: 0, bottom: 0 };
    const packageBlob = packagePrintPages([page], [new Blob([source])], undefined);
    const directory = mkdtempSync(join(tmpdir(), "calendar-print-size-"));
    try {
      const input = join(directory, "pages.bin");
      const output = join(directory, "print.pdf");
      writeFileSync(input, Buffer.from(await packageBlob.arrayBuffer()));
      execFileSync(process.execPath, [resolve("scripts/build-print-pdf.mjs"), input, profilePath, output]);
      const pdf = await PDFDocument.load(readFileSync(output));
      const images = pdf.getPage(0).node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
      const image = images?.keys().map((key) => images.lookup(key)).find((item) => item instanceof PDFRawStream) as PDFRawStream | undefined;
      expect(image).toBeDefined();
      expect(image!.contents.length).toBeLessThan(oldEncoding.length * 0.6);
      const metadata = await sharp(image!.contents).metadata();
      expect(metadata).toMatchObject({ width, height, channels: 4, space: "cmyk" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
