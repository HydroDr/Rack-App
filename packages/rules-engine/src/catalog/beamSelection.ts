/**
 * Given a pallet weight, returns the next catalog rating at-or-above that
 * weight for a given beam span, then checks the safety-margin threshold
 * (Spec §3.1c) and flags "too close". Must handle a weight that exceeds
 * every available catalog rating — an explicit "exceeds max available"
 * result, never a silent fallback to the highest rating (Engineering File
 * Plan §2.2, §9.1).
 */

import { error, withWarnings, type Result } from "../core/result.js";
import type { BeamRating, CatalogData } from "./catalogTypes.js";

export interface BeamSelectionResult {
  readonly rating: BeamRating;
  /** True when (rating capacity − required weight) is under the configured margin. */
  readonly tooClose: boolean;
}

export function selectBeam(
  catalog: CatalogData,
  lengthIn: number,
  requiredWeightLb: number,
  marginLb: number,
): Result<BeamSelectionResult> {
  const candidates = catalog.beamRatings
    .filter((rating) => rating.lengthIn === lengthIn)
    .slice()
    .sort((a, b) => a.capacityLbPerPair - b.capacityLbPerPair);

  if (candidates.length === 0) {
    return error("CATALOG_NO_BEAM_AT_LENGTH", `No beam rating found for a ${lengthIn}" span.`);
  }

  const selected = candidates.find((rating) => rating.capacityLbPerPair >= requiredWeightLb);
  if (selected === undefined) {
    const maxAvailable = candidates[candidates.length - 1] as BeamRating;
    return error(
      "CATALOG_EXCEEDS_MAX_RATING",
      `Required weight ${requiredWeightLb} lb exceeds every catalog rating for a ${lengthIn}" span ` +
        `(max available: ${maxAvailable.family} at ${maxAvailable.capacityLbPerPair} lb).`,
    );
  }

  const marginToCapacity = selected.capacityLbPerPair - requiredWeightLb;
  const tooClose = marginToCapacity < marginLb;
  const result: BeamSelectionResult = { rating: selected, tooClose };

  return withWarnings(
    result,
    tooClose
      ? [
          {
            code: "BEAM_CAPACITY_TOO_CLOSE_TO_MARGIN",
            category: "catalog",
            message:
              `Selected beam ${selected.family} at ${lengthIn}" is rated ${selected.capacityLbPerPair} lb, ` +
              `only ${marginToCapacity} lb above the required ${requiredWeightLb} lb (margin: ${marginLb} lb).`,
          },
        ]
      : [],
  );
}
