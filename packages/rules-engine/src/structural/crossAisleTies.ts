/**
 * Evaluates the 8:1 cross-aisle-tie threshold and looks up required tie
 * quantity from the beam-length/ratio band table (Spec §2.5), using the
 * resolved inclusive/exclusive band convention: ratio < 8 → no ties;
 * 8 ≤ ratio ≤ 10 → banded by beam length (each length band's lower bound
 * exclusive of the previous band's upper bound); ratio > 10 → one tie per
 * bay regardless of length (Engineering File Plan §2.6).
 */

import { error, ok, withWarnings, type Result } from "../core/result.js";
import { safeDivide } from "../core/safeMath.js";
import type { CatalogData, CrossAisleTieRule } from "../catalog/catalogTypes.js";
import type { Length } from "../units/types.js";
import { ratio, type Ratio } from "../units/types.js";

export interface CrossAisleTieCheckInput {
  /** Floor to top-loaded-level. */
  readonly heightIn: Length;
  /** Ratio depth (single-frame or combined back-to-back/double-deep depth). */
  readonly depthIn: Length;
  /** Beam span — a catalog lookup key, expressed in whole inches per the manufacturer's chart. */
  readonly beamLengthIn: number;
  readonly catalog: CatalogData;
}

export interface CrossAisleTieCheckResult {
  readonly ratio: Ratio;
  readonly required: boolean;
  readonly tieRule: CrossAisleTieRule | null;
}

export function evaluateCrossAisleTies(input: CrossAisleTieCheckInput): Result<CrossAisleTieCheckResult> {
  if (input.heightIn <= 0) {
    return error("TIES_INVALID_HEIGHT", "Height must be greater than zero.");
  }
  if (input.depthIn <= 0) {
    return error("TIES_INVALID_DEPTH", "Depth must be greater than zero.");
  }
  if (input.beamLengthIn <= 0) {
    return error("TIES_INVALID_BEAM_LENGTH", "Beam length must be greater than zero.");
  }

  const ratioResult = safeDivide(input.heightIn, input.depthIn);
  if (ratioResult.kind === "error") return ratioResult;
  const ratioValue = ratioResult.value;

  if (ratioValue < 8) {
    return ok({ ratio: ratio(ratioValue), required: false, tieRule: null });
  }

  const matchingBand = input.catalog.crossAisleTieBands.find((band) => {
    const ratioAboveMin = band.minRatioInclusive ? ratioValue >= band.minRatio : ratioValue > band.minRatio;
    const ratioBelowMax = band.maxRatio === null || ratioValue <= band.maxRatio;
    const lengthAboveMin = band.minBeamLengthInclusive
      ? input.beamLengthIn >= band.minBeamLengthIn
      : input.beamLengthIn > band.minBeamLengthIn;
    const lengthBelowMax = band.maxBeamLengthIn === null || input.beamLengthIn <= band.maxBeamLengthIn;
    return ratioAboveMin && ratioBelowMax && lengthAboveMin && lengthBelowMax;
  });

  if (matchingBand === undefined) {
    return error(
      "TIES_NO_MATCHING_BAND",
      `No cross-aisle tie band matches ratio ${ratioValue.toFixed(2)} at a ${input.beamLengthIn}" beam length.`,
    );
  }

  return withWarnings(
    { ratio: ratio(ratioValue), required: true, tieRule: matchingBand.tieRule },
    [
      {
        code: "CROSS_AISLE_TIES_REQUIRED",
        category: "structural",
        message:
          `Height-to-depth ratio ${ratioValue.toFixed(2)}:1 requires cross-aisle ties (${matchingBand.tieRule}), ` +
          `per the Interlake Mecalux support guide.`,
      },
    ],
  );
}
