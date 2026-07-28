/**
 * Evaluates wall (food/non-food), dock, aisle, and fire/sprinkler
 * pallet-to-frame clearances against current settings (Spec §2.4). Returns
 * pass/warn results only — never blocks. A clearance violation is data (a
 * warning object), never a thrown exception (Engineering File Plan §2.4).
 */

import { error, withWarnings, type RuleWarning, type Result } from "../core/result.js";
import { compareMilliinches, fromFeet, fromInches } from "../units/canonicalUnit.js";
import type { Length } from "../units/types.js";

export type WallType = "food" | "nonFood";
export type ForkliftType = "sitDown" | "standUp";

export interface WallClearanceInput {
  readonly wallType: WallType;
  readonly actualClearanceIn: Length;
}

export interface DockClearanceInput {
  readonly actualClearanceIn: Length;
}

export interface AisleClearanceInput {
  readonly forkliftType: ForkliftType;
  readonly actualWidthIn: Length;
  /** The specific equipment's real turning-radius-derived minimum, when known. Falls back to the recommended-default flex minimum otherwise (Spec §2.4). */
  readonly knownEquipmentMinimumIn?: Length;
}

export interface FrameClearanceInput {
  readonly actualClearanceIn: Length;
}

export interface ClearanceRulesInput {
  readonly wall: WallClearanceInput;
  readonly dock: DockClearanceInput;
  readonly aisle: AisleClearanceInput;
  readonly palletToFrame: FrameClearanceInput;
}

export interface ClearanceCheck {
  readonly code: string;
  readonly pass: boolean;
  readonly requiredIn: Length;
  readonly actualIn: Length;
}

export interface ClearanceRulesResult {
  readonly checks: readonly ClearanceCheck[];
}

const WALL_CLEARANCE_MIN_IN: Readonly<Record<WallType, Length>> = {
  food: fromFeet(3),
  nonFood: fromFeet(1),
};
const DOCK_CLEARANCE_MIN_IN = fromFeet(13);
const AISLE_FLEX_MIN_IN: Readonly<Record<ForkliftType, Length>> = {
  sitDown: fromFeet(11),
  standUp: fromFeet(9),
};
const FRAME_CLEARANCE_MIN_IN = fromInches(3);

export function evaluateClearances(input: ClearanceRulesInput): Result<ClearanceRulesResult> {
  for (const actual of [
    input.wall.actualClearanceIn,
    input.dock.actualClearanceIn,
    input.aisle.actualWidthIn,
    input.palletToFrame.actualClearanceIn,
  ]) {
    if (actual < 0) {
      return error("CLEARANCE_NEGATIVE_INPUT", "A measured clearance cannot be negative.");
    }
  }

  const checks: ClearanceCheck[] = [];
  const warnings: RuleWarning[] = [];

  const wallMinIn = WALL_CLEARANCE_MIN_IN[input.wall.wallType];
  const wallPass = compareMilliinches(input.wall.actualClearanceIn, wallMinIn) >= 0;
  checks.push({ code: "WALL_CLEARANCE", pass: wallPass, requiredIn: wallMinIn, actualIn: input.wall.actualClearanceIn });
  if (!wallPass) {
    warnings.push({
      code: "WALL_CLEARANCE_BELOW_MINIMUM",
      category: "clearance",
      message: `Rack-to-wall clearance is below the ${input.wall.wallType === "food" ? "food-facility 3ft" : "non-food 1ft"} minimum.`,
    });
  }

  const dockPass = compareMilliinches(input.dock.actualClearanceIn, DOCK_CLEARANCE_MIN_IN) >= 0;
  checks.push({ code: "DOCK_CLEARANCE", pass: dockPass, requiredIn: DOCK_CLEARANCE_MIN_IN, actualIn: input.dock.actualClearanceIn });
  if (!dockPass) {
    warnings.push({
      code: "DOCK_CLEARANCE_BELOW_MINIMUM",
      category: "clearance",
      message: "Rack-to-dock-door clearance is below the OSHA-referenced 13ft minimum.",
    });
  }

  const aisleMinIn = input.aisle.knownEquipmentMinimumIn ?? AISLE_FLEX_MIN_IN[input.aisle.forkliftType];
  const aislePass = compareMilliinches(input.aisle.actualWidthIn, aisleMinIn) >= 0;
  checks.push({ code: "AISLE_WIDTH", pass: aislePass, requiredIn: aisleMinIn, actualIn: input.aisle.actualWidthIn });
  if (!aislePass) {
    warnings.push({
      code: "AISLE_WIDTH_BELOW_MINIMUM",
      category: "clearance",
      message: `Aisle width is below the minimum for a ${input.aisle.forkliftType === "sitDown" ? "sit-down" : "stand-up"} forklift.`,
    });
  }

  const framePass = compareMilliinches(input.palletToFrame.actualClearanceIn, FRAME_CLEARANCE_MIN_IN) >= 0;
  checks.push({
    code: "PALLET_TO_FRAME_CLEARANCE",
    pass: framePass,
    requiredIn: FRAME_CLEARANCE_MIN_IN,
    actualIn: input.palletToFrame.actualClearanceIn,
  });
  if (!framePass) {
    warnings.push({
      code: "PALLET_TO_FRAME_CLEARANCE_BELOW_MINIMUM",
      category: "clearance",
      message: "Pallet-to-frame clearance is below the NFPA-referenced 3in minimum needed for sprinkler water penetration.",
    });
  }

  return withWarnings({ checks }, warnings);
}
