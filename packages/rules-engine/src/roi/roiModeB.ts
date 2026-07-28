/**
 * Distribution payback formulas (Spec §5.3): Toray move-cost grid and
 * expected reshuffle moves per pick. Guards against a block-stack grid with
 * 0 columns or 0 rows before averaging — division by (columns × rows) must
 * never run on a zero dimension (Engineering File Plan §2.9).
 *
 * Known spec gap: §5.3 lists "rent rate" among Mode B's client-editable
 * assumptions but never gives a formula combining it into Net Annual
 * Benefit (unlike Mode A, which explicitly defines Rent Savings − Extra
 * Labor). This implementation uses exactly what §5.3 does specify — the
 * Toray re-handling cost, annualized — as Net Annual Benefit. Flagged for
 * Juan rather than assumed.
 */

import { error, ok, type Result } from "../core/result.js";
import { safeAverage, safeDivide } from "../core/safeMath.js";
import { computePaybackPeriod, type PaybackResult } from "./roiShared.js";

export interface BlockStackGrid {
  readonly columnsDeep: number;
  readonly rowsHigh: number;
}

export interface RoiModeBInput {
  readonly monthlyForkliftRent: number;
  readonly availableHoursPerMonth: number;
  readonly laborRatePerHour: number;
  readonly minutesPerSingleMove: number;
  readonly rackCostPerPosition: number;
  /** The rack layout's (Selective or Double-Deep) position count. */
  readonly positionCount: number;
  readonly annualPickMoveVolume: number;
  readonly blockStackGrid: BlockStackGrid;
}

export interface RoiModeBResult {
  readonly forkliftCostPerHour: number;
  readonly costPerMove: number;
  readonly expectedReshuffleMovesPerPick: number;
  readonly averageAddedCostPerPick: number;
  readonly netAnnualBenefit: number;
  readonly investment: number;
  readonly payback: PaybackResult;
}

/** Moves to reach position (column, row): 2 per unit of depth in front, +2 flat if above ground level (Spec §5.3). */
function movesToReach(column: number, row: number): number {
  return 2 * (column - 1) + (row > 1 ? 2 : 0);
}

export function computeRoiModeB(input: RoiModeBInput): Result<RoiModeBResult> {
  if (input.availableHoursPerMonth <= 0) {
    return error("ROI_B_INVALID_AVAILABLE_HOURS", "Available forklift hours per month must be greater than zero.");
  }
  if (!Number.isInteger(input.blockStackGrid.columnsDeep) || input.blockStackGrid.columnsDeep <= 0) {
    return error("ROI_B_INVALID_GRID_COLUMNS", "Block-stack grid must have at least 1 column deep.");
  }
  if (!Number.isInteger(input.blockStackGrid.rowsHigh) || input.blockStackGrid.rowsHigh <= 0) {
    return error("ROI_B_INVALID_GRID_ROWS", "Block-stack grid must have at least 1 row high.");
  }

  const forkliftCostPerHourResult = safeDivide(input.monthlyForkliftRent, input.availableHoursPerMonth);
  if (forkliftCostPerHourResult.kind === "error") return forkliftCostPerHourResult;
  const forkliftCostPerHour = forkliftCostPerHourResult.value;

  const costPerMove = ((forkliftCostPerHour + input.laborRatePerHour) / 60) * input.minutesPerSingleMove;

  const moveCounts: number[] = [];
  for (let column = 1; column <= input.blockStackGrid.columnsDeep; column++) {
    for (let row = 1; row <= input.blockStackGrid.rowsHigh; row++) {
      moveCounts.push(movesToReach(column, row));
    }
  }
  const averageResult = safeAverage(moveCounts);
  if (averageResult.kind === "error") return averageResult;
  const expectedReshuffleMovesPerPick = averageResult.value;

  const averageAddedCostPerPick = expectedReshuffleMovesPerPick * costPerMove;
  const netAnnualBenefit = averageAddedCostPerPick * input.annualPickMoveVolume;
  const investment = input.positionCount * input.rackCostPerPosition;

  const paybackResult = computePaybackPeriod(investment, netAnnualBenefit);
  if (paybackResult.kind === "error") return paybackResult;

  return ok({
    forkliftCostPerHour,
    costPerMove,
    expectedReshuffleMovesPerPick,
    averageAddedCostPerPick,
    netAnnualBenefit,
    investment,
    payback: paybackResult.value,
  });
}
