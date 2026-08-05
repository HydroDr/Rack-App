import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLayoutPdf, exportLayoutPdf, type CanvasSnapshot } from "../pdfExport.js";

const ONE_PIXEL_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function makeSnapshot(): CanvasSnapshot {
  return { imageDataUrl: ONE_PIXEL_PNG_DATA_URL, widthPx: 800, heightPx: 600 };
}

describe("pdfExport.ts — renders a static snapshot of the canvas, never re-implements drawing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a PDF document sized to the snapshot's dimensions", () => {
    const doc = buildLayoutPdf(makeSnapshot(), "Aisle A Layout");
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(800, 0);
  });

  it("builds a PDF with no title band when title is blank", () => {
    const doc = buildLayoutPdf(makeSnapshot(), "");
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(600, 0);
  });

  it("exportLayoutPdf saves the generated PDF via saveFile and surfaces the Result", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue("blob:mock-url"), revokeObjectURL: vi.fn() });

    const result = await exportLayoutPdf(makeSnapshot(), "Aisle A Layout");
    expect(result.kind).toBe("ok");
  });

  it("surfaces a PDF generation failure as an error Result rather than throwing", async () => {
    const badSnapshot: CanvasSnapshot = { imageDataUrl: "not-a-valid-data-url", widthPx: 800, heightPx: 600 };
    const result = await exportLayoutPdf(badSnapshot, "Broken");
    expect(result.kind).toBe("error");
  });
});
