/**
 * Loads and validates a catalog dataset against catalogTypes. Must reject
 * malformed/incomplete catalog data at load time, not fail silently
 * mid-calculation later (Engineering File Plan §2.2).
 */

import { error, ok, type Result } from "../core/result.js";
import type { CatalogData } from "./catalogTypes.js";

export function loadCatalog(data: CatalogData): Result<CatalogData> {
  if (data.beamRatings.length === 0) {
    return error("CATALOG_EMPTY_BEAM_RATINGS", "Catalog must define at least one beam rating.");
  }
  for (const rating of data.beamRatings) {
    if (rating.lengthIn <= 0) {
      return error(
        "CATALOG_INVALID_BEAM_LENGTH",
        `Beam family "${rating.family}" has a non-positive length (${rating.lengthIn}").`,
      );
    }
    if (rating.capacityLbPerPair <= 0) {
      return error(
        "CATALOG_INVALID_BEAM_CAPACITY",
        `Beam family "${rating.family}" at ${rating.lengthIn}" has a non-positive capacity.`,
      );
    }
  }

  if (data.rowSpacerHeightBands.length === 0) {
    return error("CATALOG_EMPTY_ROW_SPACER_BANDS", "Catalog must define at least one row-spacer height band.");
  }
  for (const band of data.rowSpacerHeightBands) {
    if (band.minHeightIn > band.maxHeightIn) {
      return error(
        "CATALOG_INVALID_ROW_SPACER_BAND",
        `Row-spacer band ${band.minHeightIn}"-${band.maxHeightIn}" has min > max.`,
      );
    }
    if (band.spacerCount <= 0) {
      return error(
        "CATALOG_INVALID_ROW_SPACER_COUNT",
        `Row-spacer band ${band.minHeightIn}"-${band.maxHeightIn}" has a non-positive spacer count.`,
      );
    }
  }

  if (data.crossAisleTieBands.length === 0) {
    return error("CATALOG_EMPTY_TIE_BANDS", "Catalog must define at least one cross-aisle tie band.");
  }
  for (const band of data.crossAisleTieBands) {
    if (band.maxBeamLengthIn !== null && band.minBeamLengthIn > band.maxBeamLengthIn) {
      return error(
        "CATALOG_INVALID_TIE_BAND",
        `Cross-aisle tie band has min beam length > max beam length (${band.minBeamLengthIn}" > ${band.maxBeamLengthIn}").`,
      );
    }
    if (band.maxRatio !== null && band.minRatio > band.maxRatio) {
      return error(
        "CATALOG_INVALID_TIE_BAND",
        `Cross-aisle tie band has min ratio > max ratio (${band.minRatio} > ${band.maxRatio}).`,
      );
    }
  }

  return ok(data);
}
