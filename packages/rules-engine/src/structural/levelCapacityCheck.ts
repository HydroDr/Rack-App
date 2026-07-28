/**
 * Checks an assigned pallet weight against its specific level's rated
 * capacity (at/over capacity, or within the margin of the next tier up) per
 * Spec §3.1c — distinct from beamSelection.ts, which picks a rating during
 * template setup rather than checking an already-placed pallet. Must use
 * the same margin-threshold setting as beamSelection.ts via
 * overrideResolver.ts, not a separately hardcoded copy of the value
 * (Engineering File Plan §2.6).
 */

import { error, ok, withWarnings, type Result } from "../core/result.js";
import type { Weight } from "../units/types.js";

export interface LevelCapacityCheckInput {
  readonly levelRatedCapacityLb: Weight;
  readonly assignedWeightLb: Weight;
  /** Resolved via overrideResolver.ts — the same margin value beamSelection.ts uses. */
  readonly marginLb: Weight;
}

export interface LevelCapacityCheckResult {
  readonly atOrOverCapacity: boolean;
  /** True when under capacity but the margin to that capacity is under marginLb (e.g. a 5,300 lb pallet on a beam rated 5,500 lb with a 300 lb margin). */
  readonly withinMargin: boolean;
}

export function checkLevelCapacity(input: LevelCapacityCheckInput): Result<LevelCapacityCheckResult> {
  if (input.levelRatedCapacityLb <= 0) {
    return error("CAPACITY_INVALID_RATING", "Level rated capacity must be greater than zero.");
  }
  if (input.assignedWeightLb < 0) {
    return error("CAPACITY_INVALID_WEIGHT", "Assigned weight cannot be negative.");
  }
  if (input.marginLb < 0) {
    return error("CAPACITY_INVALID_MARGIN", "Capacity margin cannot be negative.");
  }

  const atOrOverCapacity = input.assignedWeightLb >= input.levelRatedCapacityLb;
  if (atOrOverCapacity) {
    return withWarnings({ atOrOverCapacity: true, withinMargin: false }, [
      {
        code: "LEVEL_AT_OR_OVER_CAPACITY",
        category: "structural",
        message: `Assigned weight ${input.assignedWeightLb} lb is at or above the level's rated capacity of ${input.levelRatedCapacityLb} lb.`,
      },
    ]);
  }

  const marginToCapacity = input.levelRatedCapacityLb - input.assignedWeightLb;
  const withinMargin = marginToCapacity < input.marginLb;
  if (withinMargin) {
    return withWarnings({ atOrOverCapacity: false, withinMargin: true }, [
      {
        code: "LEVEL_WITHIN_CAPACITY_MARGIN",
        category: "structural",
        message:
          `Assigned weight ${input.assignedWeightLb} lb is only ${marginToCapacity} lb below the level's rated ` +
          `capacity of ${input.levelRatedCapacityLb} lb (margin: ${input.marginLb} lb).`,
      },
    ]);
  }

  return ok({ atOrOverCapacity: false, withinMargin: false });
}
