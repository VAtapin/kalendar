import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadRgbPdf } from "../src/collaboration/shared-project-client";

afterEach(() => vi.unstubAllGlobals());

describe("standard RGB PDF upload", () => {
  it("uploads the original PDF without requesting a CMYK profile", async () => {
    const calls: Array<{ url: string; method: string; body?: BodyInit | null }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body });
      if (url.endsWith("/v1/pdf-exports") && init.method === "POST") {
        return new Response(JSON.stringify({ uploadId: "upload-1", uploadToken: "secret", chunkSize: 8 }), { status: 201 });
      }
      if (url.endsWith("/complete")) {
        return new Response(JSON.stringify({ downloadUrl: "/download/rgb.pdf", fileName: "rgb.pdf", size: 15 }));
      }
      return new Response(null, { status: 204 });
    }));

    const pdf = new Blob(["%PDF-1.7\n%%EOF"], { type: "application/pdf" });
    const progress: number[] = [];
    const ready = await uploadRgbPdf(pdf, "rgb.pdf", "access", (percent) => progress.push(percent));

    expect(JSON.parse(String(calls[0]?.body))).toMatchObject({ format: "rgb-pdf", fileName: "rgb.pdf", size: pdf.size });
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(2);
    expect(calls.some((call) => call.url.endsWith("/profile"))).toBe(false);
    expect(calls.at(-1)?.url).toContain("/complete");
    expect(progress.at(-1)).toBe(100);
    expect(ready.downloadUrl).toBe("/download/rgb.pdf");
  });
});
