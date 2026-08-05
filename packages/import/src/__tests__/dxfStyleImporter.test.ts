import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importDxfStylePreferences } from "../dxfStyleImporter.js";

const SAMPLE_DXF = `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
RACK-OUTLINE
62
5
6
DASHED
0
LAYER
2
DIMENSIONS
62
1
0
ENDTAB
0
TABLE
2
STYLE
0
STYLE
2
STANDARD
3
arial.ttf
0
ENDTAB
0
TABLE
2
DIMSTYLE
0
DIMSTYLE
2
ISO-25
0
ENDTAB
0
TABLE
2
LTYPE
0
LTYPE
2
DASHED
3
Dashed line pattern
0
ENDTAB
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
8
0
2
RackFrame
0
LINE
8
0
10
0.0
20
0.0
11
96.0
21
0.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
RackFrame
8
0
10
0.0
20
0.0
0
ENDSEC
0
EOF
`;

describe("dxfStyleImporter.ts — Spec §6.6: reads TABLES only, never interprets geometry", () => {
  it("extracts layers, text styles, dimension styles, and linetypes from the TABLES section", () => {
    const result = importDxfStylePreferences(SAMPLE_DXF);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("unreachable");
    expect(result.value.layers).toEqual([
      { name: "RACK-OUTLINE", colorNumber: 5, linetypeName: "DASHED" },
      { name: "DIMENSIONS", colorNumber: 1 },
    ]);
    expect(result.value.textStyles).toEqual([{ name: "STANDARD", fontFile: "arial.ttf" }]);
    expect(result.value.dimStyles).toEqual([{ name: "ISO-25" }]);
    expect(result.value.lineTypes).toEqual([{ name: "DASHED", description: "Dashed line pattern" }]);
  });

  it("never reads the BLOCKS or ENTITIES sections — a rack-shaped BLOCK/INSERT never appears in the output", () => {
    const result = importDxfStylePreferences(SAMPLE_DXF);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("unreachable");
    const serialized = JSON.stringify(result.value);
    expect(serialized).not.toMatch(/RackFrame|INSERT/);
  });

  it("surfaces a malformed/empty DXF as an error rather than throwing or returning empty preferences silently", () => {
    const result = importDxfStylePreferences("not a dxf file at all");
    expect(result.kind).toBe("error");
  });

  it("surfaces a DXF with no TABLES section as an error", () => {
    const noTables = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n";
    const result = importDxfStylePreferences(noTables);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("DXF_MISSING_TABLES_SECTION");
  });

  it("skips an unrecognized table (e.g. APPID) without consuming tags meant for the next table", () => {
    const withAppid = `0
SECTION
2
TABLES
0
TABLE
2
APPID
0
APPID
2
ACAD
0
ENDTAB
0
TABLE
2
LAYER
0
LAYER
2
ONLY-LAYER
0
ENDTAB
0
ENDSEC
0
EOF
`;
    const result = importDxfStylePreferences(withAppid);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("unreachable");
    expect(result.value.layers).toEqual([{ name: "ONLY-LAYER" }]);
  });

  it("never imports any rack geometry/domain entity type — structurally cannot interpret ENTITIES as a rack template", () => {
    const source = readFileSync(join(process.cwd(), "src", "dxfStyleImporter.ts"), "utf-8");
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\*.*$/gm, "")
      .replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/\bRackInstance\b|\bRackTemplate\b|\bWarehouseElement\b|\bPathLane\b|\bZone\b/);
  });
});
