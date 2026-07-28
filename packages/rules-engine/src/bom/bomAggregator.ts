/**
 * Combines all BOM sub-formulas into one result for a given Layout, summing
 * per-line totals across however many lines the configuration has. This is
 * the one place line-scope and configuration-scope values are merged — kept
 * as the single point of aggregation so scope errors can't hide in multiple
 * places (Engineering File Plan §2.7).
 */

import { error, warningsOf, withWarnings, type Result } from "../core/result.js";
import type { CatalogData } from "../catalog/catalogTypes.js";
import { resolveLevelDefinitions } from "../configuration/levelDefinitions.js";
import type { Length } from "../units/types.js";
import { computeLineBom } from "./bomFormulas.js";
import { computeRowSpacers } from "./rowSpacers.js";
import { computeProtectorsAndAnchors, type LineEndProtectors } from "./protectorsAndAnchors.js";

export interface BomAggregatorInput {
  readonly configurationType: unknown;
  readonly bays: number;
  readonly palletsPerLevel: number;
  readonly palletLevels: number;
  /** Physical rack lines placed side-by-side: 1 = single; 2 = back-to-back or standalone double-deep; 4 = double-deep back-to-back. */
  readonly rackColumns: number;
  /** Catalog lookup key for row-spacer count, in whole inches. */
  readonly uprightHeightIn: number;
  readonly resolvedRowSpacerLengthIn: Length;
  /** One entry per physical line (length must equal rackColumns). */
  readonly lineEndProtectors: readonly LineEndProtectors[];
  readonly columnProtectorCount: number;
  readonly anchorsPerUpright: number;
  readonly anchorsPerProtector: number;
  readonly catalog: CatalogData;
}

export interface BomResult {
  readonly uprights: number;
  readonly beams: number;
  readonly wireDecks: number;
  readonly ppo: number;
  readonly rowSpacers: number;
  readonly rowSpacerLengthIn: Length;
  readonly endOfAisleProtectors: number;
  readonly columnProtectors: number;
  readonly anchors: number;
}

export function aggregateBom(input: BomAggregatorInput): Result<BomResult> {
  if (!Number.isInteger(input.rackColumns) || input.rackColumns <= 0) {
    return error("BOM_INVALID_RACK_COLUMNS", "Rack columns must be a positive integer.");
  }
  if (input.lineEndProtectors.length !== input.rackColumns) {
    return error(
      "BOM_LINE_END_PROTECTOR_MISMATCH",
      `Expected ${input.rackColumns} line-end-protector entries (one per physical line), got ${input.lineEndProtectors.length}.`,
    );
  }
  if (input.configurationType === "single" && input.rackColumns !== 1) {
    return error("BOM_INVALID_COLUMNS_FOR_SINGLE", "A single configuration must have exactly 1 physical line.");
  }
  if (input.configurationType === "backToBack" && input.rackColumns !== 2) {
    return error("BOM_INVALID_COLUMNS_FOR_BACK_TO_BACK", "A back-to-back configuration must have exactly 2 physical lines.");
  }
  if (input.configurationType === "doubleDeep" && input.rackColumns !== 2 && input.rackColumns !== 4) {
    return error(
      "BOM_INVALID_COLUMNS_FOR_DOUBLE_DEEP",
      "A double-deep configuration must have 2 (standalone) or 4 (back-to-back) physical lines.",
    );
  }

  const levelDefsResult = resolveLevelDefinitions(input.configurationType, input.palletLevels);
  if (levelDefsResult.kind === "error") return levelDefsResult;
  const levelDefs = levelDefsResult.value;

  const lineBomResult = computeLineBom({
    bays: input.bays,
    beamLevels: levelDefs.beamLevels,
    deckRequiringLevels: levelDefs.deckRequiringLevels,
    palletLevels: levelDefs.palletLevels,
    palletsPerLevel: input.palletsPerLevel,
  });
  if (lineBomResult.kind === "error") return lineBomResult;
  const lineBom = lineBomResult.value;

  const rowSpacersResult = computeRowSpacers({
    uprightsPerLine: lineBom.uprights,
    uprightHeightIn: input.uprightHeightIn,
    rackColumns: input.rackColumns,
    rowSpacerLengthIn: input.resolvedRowSpacerLengthIn,
    catalog: input.catalog,
  });
  if (rowSpacersResult.kind === "error") return rowSpacersResult;
  const rowSpacers = rowSpacersResult.value;

  const uprights = lineBom.uprights * input.rackColumns;
  const beams = lineBom.beams * input.rackColumns;
  const wireDecks = lineBom.wireDecks * input.rackColumns;
  const ppo = lineBom.ppo * input.rackColumns;

  const protectorsResult = computeProtectorsAndAnchors({
    lineEndProtectors: input.lineEndProtectors,
    columnProtectorCount: input.columnProtectorCount,
    totalUprights: uprights,
    anchorsPerUpright: input.anchorsPerUpright,
    anchorsPerProtector: input.anchorsPerProtector,
  });
  if (protectorsResult.kind === "error") return protectorsResult;
  const protectors = protectorsResult.value;

  const warnings = [...warningsOf(levelDefsResult), ...warningsOf(rowSpacersResult), ...warningsOf(protectorsResult)];

  const result: BomResult = {
    uprights,
    beams,
    wireDecks,
    ppo,
    rowSpacers: rowSpacers.totalRowSpacers,
    rowSpacerLengthIn: rowSpacers.rowSpacerLengthIn,
    endOfAisleProtectors: protectors.endOfAisleProtectorCount,
    columnProtectors: protectors.columnProtectorCount,
    anchors: protectors.anchors,
  };

  return withWarnings(result, warnings);
}
