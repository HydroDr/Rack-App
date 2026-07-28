/**
 * Computes row spacer count and part size once per configuration (not per
 * line), per the corrected per-configuration scope (Spec §3.1). Isolated in
 * its own file to guard against the double-count bug of calling this
 * per-line by accident (Engineering File Plan §2.7).
 *
 * Formula (Spec §2.5, §3.1): rowSpacers = uprightsPerLine × spacersPerHeight(uprightHeight) × (rackColumns − 1).
 * Generalizes to 0 automatically for a single-column (Single) configuration.
 */

import { error, withWarnings, type RuleWarning, type Result } from "../core/result.js";
import type { CatalogData } from "../catalog/catalogTypes.js";
import type { Length } from "../units/types.js";

/** Beyond this, a selective pallet rack configuration is not realistic in practice (Spec §2.5). */
const UNREALISTIC_COLUMN_COUNT_THRESHOLD = 4;

export interface RowSpacersInput {
  /** One line's worth of uprights (from bomFormulas.ts), not the configuration total. */
  readonly uprightsPerLine: number;
  /** Upright height — a catalog lookup key, expressed in whole inches per the manufacturer's chart. */
  readonly uprightHeightIn: number;
  /** Number of physical rack lines placed side-by-side. */
  readonly rackColumns: number;
  /** Row spacer length already resolved via overrideResolver.ts (12" back-to-back / 8" double-deep default, or a template override). */
  readonly rowSpacerLengthIn: Length;
  readonly catalog: CatalogData;
}

export interface RowSpacersResult {
  readonly gaps: number;
  readonly spacersPerHeight: number;
  readonly totalRowSpacers: number;
  readonly rowSpacerLengthIn: Length;
}

export function computeRowSpacers(input: RowSpacersInput): Result<RowSpacersResult> {
  if (!Number.isInteger(input.uprightsPerLine) || input.uprightsPerLine <= 0) {
    return error("ROWSPACER_INVALID_UPRIGHTS", "Uprights per line must be a positive integer.");
  }
  if (!Number.isInteger(input.rackColumns) || input.rackColumns <= 0) {
    return error("ROWSPACER_INVALID_COLUMNS", "Rack columns must be a positive integer.");
  }
  if (input.uprightHeightIn <= 0) {
    return error("ROWSPACER_INVALID_UPRIGHT_HEIGHT", "Upright height must be greater than zero.");
  }

  const warnings: RuleWarning[] = [];
  if (input.rackColumns > UNREALISTIC_COLUMN_COUNT_THRESHOLD) {
    warnings.push({
      code: "ROWSPACER_UNREALISTIC_COLUMN_COUNT",
      category: "bom",
      message:
        `${input.rackColumns} rack columns side-by-side is unusually wide for a selective pallet rack — ` +
        `confirm the rack type is correct.`,
    });
  }

  const gaps = input.rackColumns - 1;
  if (gaps === 0) {
    return withWarnings(
      { gaps: 0, spacersPerHeight: 0, totalRowSpacers: 0, rowSpacerLengthIn: input.rowSpacerLengthIn },
      warnings,
    );
  }

  const matchingBand = input.catalog.rowSpacerHeightBands.find(
    (band) => input.uprightHeightIn >= band.minHeightIn && input.uprightHeightIn <= band.maxHeightIn,
  );
  if (matchingBand === undefined) {
    return error(
      "ROWSPACER_NO_MATCHING_HEIGHT_BAND",
      `No row-spacer count found for an upright height of ${input.uprightHeightIn}".`,
    );
  }

  const totalRowSpacers = input.uprightsPerLine * matchingBand.spacerCount * gaps;

  return withWarnings(
    {
      gaps,
      spacersPerHeight: matchingBand.spacerCount,
      totalRowSpacers,
      rowSpacerLengthIn: input.rowSpacerLengthIn,
    },
    warnings,
  );
}
