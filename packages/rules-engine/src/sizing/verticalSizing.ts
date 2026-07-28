/**
 * Computes per-level pallet stacking: pallet height + overhead clearance,
 * repeated per level, capped 2ft (default, customizable) below the lowest
 * ceiling obstruction (Spec §2.3). Guards against zero/negative pallet
 * height/clearance input, and flags — never blocks — a requested level
 * count whose cumulative height already exceeds the ceiling cap.
 */

import { error, withWarnings, type RuleWarning, type Result } from "../core/result.js";
import { addMilliinches, compareMilliinches, scaleMilliinches, subtractMilliinches } from "../units/canonicalUnit.js";
import type { Length } from "../units/types.js";

export interface LevelHeight {
  /** 0-based level index; 0 = the lowest (floor) level. */
  readonly levelIndex: number;
  /** Cumulative height from the floor to the top of this level's pallet. */
  readonly topOfPalletHeightIn: Length;
  /** Cumulative height from the floor to the top of this level's overhead clearance (where the next beam sits). */
  readonly topOfClearanceHeightIn: Length;
}

export interface VerticalSizingResult {
  readonly levels: readonly LevelHeight[];
  /** Height from the floor to the top of the highest level's clearance. */
  readonly totalHeightIn: Length;
}

export function computeVerticalSizing(
  palletHeightIn: Length,
  clearanceIn: Length,
  levelCount: number,
  ceilingObstructionHeightIn: Length,
  ceilingClearanceIn: Length,
): Result<VerticalSizingResult> {
  if (palletHeightIn <= 0) {
    return error("SIZING_INVALID_PALLET_HEIGHT", "Pallet height must be greater than zero.");
  }
  if (clearanceIn <= 0) {
    return error("SIZING_INVALID_CLEARANCE", "Overhead clearance must be greater than zero.");
  }
  if (!Number.isInteger(levelCount) || levelCount <= 0) {
    return error("SIZING_INVALID_LEVEL_COUNT", "Level count must be a positive integer.");
  }
  if (ceilingClearanceIn < 0) {
    return error("SIZING_INVALID_CEILING_CLEARANCE", "Ceiling clearance cannot be negative.");
  }

  const perLevelHeightIn = addMilliinches(palletHeightIn, clearanceIn);
  const levels: LevelHeight[] = [];
  for (let levelIndex = 0; levelIndex < levelCount; levelIndex++) {
    const topOfClearanceHeightIn = scaleMilliinches(perLevelHeightIn, levelIndex + 1);
    const topOfPalletHeightIn = subtractMilliinches(topOfClearanceHeightIn, clearanceIn);
    levels.push({ levelIndex, topOfPalletHeightIn, topOfClearanceHeightIn });
  }
  const highestLevel = levels[levels.length - 1] as LevelHeight;
  const totalHeightIn = highestLevel.topOfClearanceHeightIn;

  const ceilingCapHeightIn = subtractMilliinches(ceilingObstructionHeightIn, ceilingClearanceIn);
  const warnings: RuleWarning[] = [];
  if (compareMilliinches(totalHeightIn, ceilingCapHeightIn) > 0) {
    const firstExceedingLevel = levels.find(
      (level) => compareMilliinches(level.topOfClearanceHeightIn, ceilingCapHeightIn) > 0,
    );
    warnings.push({
      code: "SIZING_EXCEEDS_CEILING_CAP",
      category: "clearance",
      message:
        `Level ${firstExceedingLevel?.levelIndex ?? levelCount - 1} rises above the required clearance below ` +
        `the ceiling obstruction (cap: ${ceilingCapHeightIn}, reached: ${totalHeightIn}, in canonical units).`,
    });
  }

  return withWarnings({ levels, totalHeightIn }, warnings);
}
