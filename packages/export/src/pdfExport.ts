/**
 * Renders a static PDF snapshot of the current 2D layout canvas — never
 * re-implements rack drawing. CanvasTab's renderScene() already produces
 * the pixel-accurate view; the caller captures that as a dataURL
 * (PixiJS's extract/toDataURL) and hands it here as a CanvasSnapshot,
 * keeping this package decoupled from canvas/PixiJS entirely (export may
 * only depend on data/rules-engine per the Engineering File Plan).
 */

import jsPDF from "jspdf";
import { error, type Result } from "@rack-app/rules-engine";
import { saveFile } from "./saveFile.js";

export interface CanvasSnapshot {
  readonly imageDataUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

const TITLE_BAND_HEIGHT_PX = 32;

export function buildLayoutPdf(snapshot: CanvasSnapshot, title: string): jsPDF {
  const hasTitle = title.trim().length > 0;
  const pageHeightPx = snapshot.heightPx + (hasTitle ? TITLE_BAND_HEIGHT_PX : 0);
  const doc = new jsPDF({
    orientation: snapshot.widthPx >= pageHeightPx ? "landscape" : "portrait",
    unit: "px",
    format: [snapshot.widthPx, pageHeightPx],
  });

  if (hasTitle) {
    doc.setFontSize(14);
    doc.text(title, 16, 22);
  }

  doc.addImage(snapshot.imageDataUrl, "PNG", 0, hasTitle ? TITLE_BAND_HEIGHT_PX : 0, snapshot.widthPx, snapshot.heightPx);
  return doc;
}

export async function exportLayoutPdf(snapshot: CanvasSnapshot, title: string, suggestedName = "layout.pdf"): Promise<Result<void>> {
  try {
    const blob = buildLayoutPdf(snapshot, title).output("blob");
    return saveFile({ suggestedName, mimeType: "application/pdf", content: blob });
  } catch (cause) {
    return error("PDF_EXPORT_FAILED", cause instanceof Error ? cause.message : "Failed to generate the PDF.");
  }
}
