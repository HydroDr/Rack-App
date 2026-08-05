/**
 * Serializes the Materials tab's BOM line items to a CSV file and saves
 * it via saveFile.ts — the same data buildMaterialLineItems() already
 * shows on screen, just written out. Defines its own CsvLineItem shape
 * rather than importing ui's MaterialLineItem: export may only depend on
 * data/rules-engine (Engineering File Plan boundaries), so the caller
 * hands in plain {material, quantity} objects that happen to satisfy it.
 */

import type { Result } from "@rack-app/rules-engine";
import { saveFile } from "./saveFile.js";

export interface CsvLineItem {
  readonly material: string;
  readonly quantity: number;
}

function escapeCsvField(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function buildCsv(lineItems: readonly CsvLineItem[]): string {
  const rows = lineItems.map((item) => `${escapeCsvField(item.material)},${item.quantity}`);
  return ["Material,Quantity", ...rows].join("\r\n");
}

export async function exportMaterialsCsv(lineItems: readonly CsvLineItem[], suggestedName = "materials.csv"): Promise<Result<void>> {
  return saveFile({ suggestedName, mimeType: "text/csv", content: buildCsv(lineItems) });
}
