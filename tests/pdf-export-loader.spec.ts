import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.doUnmock("../src/export/pdf-exporter"); vi.resetModules(); });

describe("lazy PDF exporter loading", () => {
  it("loads the exporter only when requested", async () => {
    const initialize = vi.fn(() => ({ MM_TO_PT: 42 }));
    vi.doMock("../src/export/pdf-exporter", initialize);
    const { loadPdfExporter } = await import("../src/export/load-pdf-exporter");
    expect(initialize).not.toHaveBeenCalled();
    const exporter = await loadPdfExporter();
    expect(exporter.MM_TO_PT).toBe(42);
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("keeps the original load error and gives safe recovery instructions", async () => {
    const original = new TypeError("Failed to fetch dynamically imported module: /assets/pdf-exporter-old.js");
    vi.doMock("../src/export/pdf-exporter", () => { throw original; });
    const { loadPdfExporter, PdfExporterLoadError } = await import("../src/export/load-pdf-exporter");
    const error = await loadPdfExporter().catch(error => error);
    expect(error).toBeInstanceOf(PdfExporterLoadError);
    // Vite/Vitest may wrap a module-factory error; it still remains in the cause chain.
    expect(error.cause === original || error.cause?.cause === original).toBe(true);
    expect(error.message).toContain("сохраните календарь");
    expect(error.message).toContain("Ctrl+F5");
    const source = await readFile("src/export/load-pdf-exporter.ts", "utf8");
    expect(source).not.toMatch(/location\.(reload|assign|replace)\s*\(/);
  });
});
