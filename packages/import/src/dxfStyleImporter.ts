/**
 * Reads a DXF file's TABLES section only — layer, text-style, dimension-
 * style, and linetype definitions — for use as Client View drawing
 * preferences (Spec §6.6). Structural requirement: this file must never
 * parse or interpret DXF geometry (the BLOCKS/ENTITIES sections, or any
 * other section) as a rack template or any other domain entity — every
 * non-TABLES section is skipped by name and its tags are never read.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";

interface DxfTag {
  readonly code: number;
  readonly value: string;
}

export interface ImportedLayerStyle {
  readonly name: string;
  readonly colorNumber?: number;
  readonly linetypeName?: string;
}

export interface ImportedTextStyle {
  readonly name: string;
  readonly fontFile?: string;
}

export interface ImportedDimStyle {
  readonly name: string;
}

export interface ImportedLineType {
  readonly name: string;
  readonly description?: string;
}

export interface ImportedDrawingPreferences {
  readonly layers: readonly ImportedLayerStyle[];
  readonly textStyles: readonly ImportedTextStyle[];
  readonly dimStyles: readonly ImportedDimStyle[];
  readonly lineTypes: readonly ImportedLineType[];
}

const TABLE_NAMES = new Set(["LAYER", "STYLE", "DIMSTYLE", "LTYPE"]);

function tokenize(dxfText: string): readonly DxfTag[] {
  const lines = dxfText.split(/\r\n|\r|\n/);
  const tags: DxfTag[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i]!.trim(), 10);
    if (!Number.isInteger(code)) continue;
    tags.push({ code, value: lines[i + 1]!.trim() });
  }
  return tags;
}

/** Skips forward past an entire SECTION without reading its tags — the only path BLOCKS/ENTITIES (and every section other than TABLES) ever take, so real DXF geometry structurally never reaches this importer. */
function skipSection(tags: readonly DxfTag[], startIndex: number): number {
  let index = startIndex;
  while (index < tags.length) {
    if (tags[index]!.code === 0 && tags[index]!.value === "ENDSEC") return index + 1;
    index += 1;
  }
  return index;
}

interface PreferenceAccumulator {
  layers: ImportedLayerStyle[];
  textStyles: ImportedTextStyle[];
  dimStyles: ImportedDimStyle[];
  lineTypes: ImportedLineType[];
}

function flushEntry(tableName: string, record: Record<number, string>, acc: PreferenceAccumulator): void {
  const name = record[2];
  if (name === undefined) return;

  if (tableName === "LAYER") {
    acc.layers.push({
      name,
      ...(record[62] !== undefined ? { colorNumber: Number.parseInt(record[62], 10) } : {}),
      ...(record[6] !== undefined && record[6] !== "" ? { linetypeName: record[6] } : {}),
    });
  } else if (tableName === "STYLE") {
    acc.textStyles.push({ name, ...(record[3] !== undefined && record[3] !== "" ? { fontFile: record[3] } : {}) });
  } else if (tableName === "DIMSTYLE") {
    acc.dimStyles.push({ name });
  } else if (tableName === "LTYPE") {
    acc.lineTypes.push({ name, ...(record[3] !== undefined && record[3] !== "" ? { description: record[3] } : {}) });
  }
}

/** Parses one recognized table (LAYER/STYLE/DIMSTYLE/LTYPE) up to its ENDTAB. */
function parseTable(tags: readonly DxfTag[], startIndex: number, tableName: string, acc: PreferenceAccumulator): number {
  let index = startIndex;
  let record: Record<number, string> | null = null;

  while (index < tags.length) {
    const tag = tags[index]!;
    if (tag.code === 0) {
      if (tag.value === "ENDTAB") {
        if (record !== null) flushEntry(tableName, record, acc);
        return index + 1;
      }
      if (tag.value === tableName) {
        if (record !== null) flushEntry(tableName, record, acc);
        record = {};
        index += 1;
        continue;
      }
    }
    if (record !== null) record[tag.code] = tag.value;
    index += 1;
  }
  if (record !== null) flushEntry(tableName, record, acc);
  return index;
}

/** Walks the TABLES section, dispatching each nested TABLE to parseTable() when recognized, or skipping unrecognized tables (APPID, UCS, VIEW, BLOCK_RECORD, ...) without reading their entries. */
function parseTablesSection(tags: readonly DxfTag[], startIndex: number, acc: PreferenceAccumulator): number {
  let index = startIndex;
  while (index < tags.length) {
    const tag = tags[index]!;
    if (tag.code === 0 && tag.value === "ENDSEC") return index + 1;

    if (tag.code === 0 && tag.value === "TABLE") {
      const nameTag = tags[index + 1];
      const tableName = nameTag !== undefined && nameTag.code === 2 ? nameTag.value : "";
      index += 2;
      if (TABLE_NAMES.has(tableName)) {
        index = parseTable(tags, index, tableName, acc);
      } else {
        while (index < tags.length && !(tags[index]!.code === 0 && tags[index]!.value === "ENDTAB")) index += 1;
        index += 1;
      }
      continue;
    }
    index += 1;
  }
  return index;
}

/**
 * Parses a DXF file's TABLES section (layer/text-style/dimension-style/
 * linetype definitions) into drawing preferences. Every other section —
 * HEADER, BLOCKS, ENTITIES, OBJECTS, CLASSES — is skipped by name via
 * skipSection() and its tags are never read, so this function cannot
 * produce rack geometry from a DXF file even in principle (Spec §6.6).
 */
export function importDxfStylePreferences(dxfText: string): Result<ImportedDrawingPreferences> {
  const tags = tokenize(dxfText);
  if (tags.length === 0) {
    return error("DXF_EMPTY_OR_UNREADABLE", "The file contains no readable DXF tag pairs.");
  }

  const acc: PreferenceAccumulator = { layers: [], textStyles: [], dimStyles: [], lineTypes: [] };
  let sawTablesSection = false;
  let index = 0;

  while (index < tags.length) {
    const tag = tags[index]!;
    if (tag.code === 0 && tag.value === "SECTION") {
      const nameTag = tags[index + 1];
      const sectionName = nameTag !== undefined && nameTag.code === 2 ? nameTag.value : "";
      index += 2;
      if (sectionName === "TABLES") {
        sawTablesSection = true;
        index = parseTablesSection(tags, index, acc);
      } else {
        index = skipSection(tags, index);
      }
      continue;
    }
    index += 1;
  }

  if (!sawTablesSection) {
    return error("DXF_MISSING_TABLES_SECTION", "This DXF file has no TABLES section — nothing to import.");
  }

  return ok({ layers: acc.layers, textStyles: acc.textStyles, dimStyles: acc.dimStyles, lineTypes: acc.lineTypes });
}
