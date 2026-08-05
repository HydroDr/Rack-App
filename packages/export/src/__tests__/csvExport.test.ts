import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsv, exportMaterialsCsv, type CsvLineItem } from "../csvExport.js";

describe("csvExport.ts — serializes the same BOM data the Materials tab shows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a header row plus one row per line item", () => {
    const lineItems: readonly CsvLineItem[] = [
      { material: "Uprights", quantity: 12 },
      { material: "Beams", quantity: 24 },
    ];
    expect(buildCsv(lineItems)).toBe('Material,Quantity\r\nUprights,12\r\nBeams,24');
  });

  it("quotes and escapes a material name containing a comma or quote", () => {
    const lineItems: readonly CsvLineItem[] = [{ material: 'Row Spacers (12")', quantity: 6 }];
    expect(buildCsv(lineItems)).toBe('Material,Quantity\r\n"Row Spacers (12"")",6');
  });

  it("produces just the header row for an empty BOM", () => {
    expect(buildCsv([])).toBe("Material,Quantity");
  });

  it("exportMaterialsCsv saves the built CSV via saveFile and surfaces the Result", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue("blob:mock-url"), revokeObjectURL: vi.fn() });

    const result = await exportMaterialsCsv([{ material: "Uprights", quantity: 12 }]);
    expect(result.kind).toBe("ok");
  });
});
