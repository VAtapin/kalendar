import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
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
});
