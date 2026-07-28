/**
 * Encodes every worked example from the Specification as test data (Spec
 * §3.2, §3.4, §2.5, §5.2/§5.3; Engineering File Plan §2.12). If these
 * fixtures and the formulas ever disagree, that's a real bug, not a flaky
 * test — each one traces to a specific spec section.
 *
 * Where the Specification states a formula but not a concrete numeric
 * example (ROI §5.2/§5.3 — no worked $ figures appear in the source
 * document, only formulas), the fixture below is a constructed example
 * built to exercise those formulas correctly, not a real client scenario.
 */

import { fromInches } from "../../units/canonicalUnit.js";
import type { Length } from "../../units/types.js";
import { interlakeDefaultCatalog } from "../../catalog/data/interlake.default.js";
import type { StorageTypeAssumptions } from "../../roi/roiModeA.js";
import type { BlockStackGrid } from "../../roi/roiModeB.js";

export const catalog = interlakeDefaultCatalog;

/**
 * Spec §3.2: "For a standard 2-pallet-wide double-deep rack, wire decks,
 * beams-per-level's associated decking, and PPO converge to the same
 * number per level." Double-Deep has Deck-Requiring Levels === Pallet
 * Levels (§3.0), so Wire Decks === PPO exactly whenever palletsPerLevel
 * matches the pallets used to derive PPO — verified directly in bom.test.ts.
 */
export const doubleDeepConvergenceExample = {
  configurationType: "doubleDeep" as const,
  bays: 5,
  palletLevels: 4,
  palletsPerLevel: 2,
  rackColumns: 2 as const,
  uprightHeightIn: 96,
  resolvedRowSpacerLengthIn: fromInches(8) as Length,
};

/**
 * Spec §3.4: worked example of a Back-to-Back → Double-Deep config change,
 * drawn from a real client project. The source document states the
 * qualitative deltas only (row spacers swap part, beam count increases,
 * uprights increase despite a smaller footprint, PPO decreases) without
 * concrete bay/level counts. The numbers below are constructed to reproduce
 * every one of those qualitative deltas exactly, so the diff engine and BOM
 * aggregator can be asserted against them precisely.
 */
export const configChangeExample = {
  before: {
    // Back-to-Back: 2 long lines.
    configurationType: "backToBack" as const,
    bays: 6,
    palletLevels: 4,
    palletsPerLevel: 1,
    rackColumns: 2 as const,
    uprightHeightIn: 192, // 16ft -> row-spacer band 120"-216" (2 spacers)
    resolvedRowSpacerLengthIn: fromInches(12) as Length, // Back-to-Back default (Spec §3.1a)
  },
  after: {
    // Double-Deep back-to-back: 4 shorter lines.
    configurationType: "doubleDeep" as const,
    bays: 5,
    palletLevels: 2,
    palletsPerLevel: 1,
    rackColumns: 4 as const,
    uprightHeightIn: 96, // 8ft -> row-spacer band 48"-108" (1 spacer)
    resolvedRowSpacerLengthIn: fromInches(8) as Length, // Double-Deep default (Spec §3.1a)
  },
  // Expected aggregate deltas per Spec §3.4's qualitative claims.
  expected: {
    upright: { before: 14, after: 24 }, // increases, despite more separate lines/groups
    beams: { before: 72, after: 80 }, // increases (Double-Deep's floor-level beam requirement)
    ppo: { before: 48, after: 40 }, // net decrease — accepted trade-off for density
    rowSpacers: { before: 14, beforeLengthIn: fromInches(12), after: 18, afterLengthIn: fromInches(8) },
  },
};

/**
 * Spec §2.5: "a 360" high × 42" deep single frame has a ratio of 8.5 (ties
 * required); the same frame in a back-to-back row (42+42+12" row spacer)
 * drops well below the threshold and does not require ties."
 *
 * Note: 360/42 = 8.571..., not exactly 8.5 as the source prose states —
 * a minor rounding artifact in the worked example text. Both figures land
 * well within the "ties required" (>=8) band, so the fixture uses the
 * exact stated dimensions (360", 42") rather than adjusting them to force
 * a literal 8.5, and asserts the qualitative outcome (ties required above
 * threshold, not required once combined into back-to-back).
 *
 * The source example doesn't specify a beam length for the tie-band
 * lookup — 96" (a 2-pallet-per-level beam) is chosen here to exercise the
 * length-banded portion of the table.
 */
export const crossAisleTieExample = {
  singleFrame: {
    heightIn: fromInches(360) as Length,
    depthIn: fromInches(42) as Length,
    beamLengthIn: 96,
  },
  backToBackFrame: {
    heightIn: fromInches(360) as Length,
    // 42 (frame) + 42 (frame) + 12 (row spacer) = 96" combined depth.
    depthIn: fromInches(96) as Length,
    beamLengthIn: 96,
  },
};

/**
 * ROI Mode A (Spec §5.2) — constructed example (see file header) comparing
 * a Floor baseline against a denser Back-to-Back configuration.
 */
export const roiModeAExample = {
  rentRatePerSqftPerMonth: 1.0,
  monthsPerYear: 12,
  wagePerHour: 20,
  shiftHoursPerDay: 8,
  operatingDaysPerWeek: 5,
  operatingWeeksPerYear: 50,
  baseCrewSize: 1,
  rackCostPerPosition: 150,
  trailersPerDay: 50,
  floorAreaSqFt: 100_000,
  floorPositions: 1_000,
  floorBaseline: {
    positionCount: 1_000,
    rackAreaFootprintSqFt: 0,
    handlingTimeMinMinutesPerTrailer: 10,
    handlingTimeMaxMinutesPerTrailer: 20,
  } satisfies StorageTypeAssumptions,
  denserConfiguration: {
    positionCount: 1_800,
    rackAreaFootprintSqFt: 70_000,
    handlingTimeMinMinutesPerTrailer: 15,
    handlingTimeMaxMinutesPerTrailer: 25,
  } satisfies StorageTypeAssumptions,
  // Hand-derived expected outputs (see roi.test.ts for the arithmetic trace).
  expected: {
    floorDensitySqFtPerPosition: 100,
    annualRentFactor: 12,
    operatorsNeededFloor: 2,
    operatorsNeededDenser: 3,
    rentSavings: 1_320_000,
    extraLabor: 40_000,
    netAnnualBenefit: 1_280_000,
    investment: 270_000,
    paybackYears: 270_000 / 1_280_000,
  },
};

/** Same scenario, but with a denser footprint close enough to the floor-equivalent that labor cost erases the rent savings — "No payback" (Spec §5.2). */
export const roiModeANoPaybackExample = {
  ...roiModeAExample,
  denserConfiguration: {
    ...roiModeAExample.denserConfiguration,
    rackAreaFootprintSqFt: 179_000,
  } satisfies StorageTypeAssumptions,
};

/**
 * ROI Mode B (Spec §5.3, Toray re-handling method) — constructed example
 * (see file header) with a 3-columns-deep x 2-rows-high block stack.
 */
export const roiModeBExample = {
  monthlyForkliftRent: 3_000,
  availableHoursPerMonth: 170,
  laborRatePerHour: 25,
  minutesPerSingleMove: 1.5,
  rackCostPerPosition: 150,
  positionCount: 1_800,
  annualPickMoveVolume: 20_000,
  blockStackGrid: { columnsDeep: 3, rowsHigh: 2 } satisfies BlockStackGrid,
  // Hand-derived expected outputs (see roi.test.ts for the arithmetic trace).
  expected: {
    forkliftCostPerHour: 3_000 / 170,
    expectedReshuffleMovesPerPick: 3.0,
    investment: 270_000,
  },
};
