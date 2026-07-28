/**
 * Forwarding payback formulas (Spec §5.2): staffing-based labor, rent
 * savings, investment. Compares Floor stacking vs. the denser configuration
 * being evaluated (Back-to-Back or Double-Deep). Guards against shift
 * hours = 0 or operating days/weeks = 0 before any division (Engineering
 * File Plan §2.9).
 */

import { error, ok, type Result } from "../core/result.js";
import { safeCeilDivide, safeDivide } from "../core/safeMath.js";
import { computePaybackPeriod, type PaybackResult } from "./roiShared.js";

export interface StorageTypeAssumptions {
  readonly positionCount: number;
  /** Actual rack footprint for this storage type. Not used for the Floor baseline (Floor IS the footprint baseline). */
  readonly rackAreaFootprintSqFt: number;
  readonly handlingTimeMinMinutesPerTrailer: number;
  readonly handlingTimeMaxMinutesPerTrailer: number;
}

export interface RoiModeAInput {
  readonly rentRatePerSqftPerMonth: number;
  readonly monthsPerYear: number;
  readonly wagePerHour: number;
  readonly shiftHoursPerDay: number;
  readonly operatingDaysPerWeek: number;
  readonly operatingWeeksPerYear: number;
  readonly baseCrewSize: number;
  readonly rackCostPerPosition: number;
  /** Trailers per day, in + out. */
  readonly trailersPerDay: number;
  readonly floorAreaSqFt: number;
  readonly floorPositions: number;
  readonly floorBaseline: StorageTypeAssumptions;
  readonly denserConfiguration: StorageTypeAssumptions;
}

export interface RoiModeAResult {
  readonly floorDensitySqFtPerPosition: number;
  readonly annualRentFactor: number;
  readonly rentSavings: number;
  readonly extraLabor: number;
  readonly netAnnualBenefit: number;
  readonly investment: number;
  readonly payback: PaybackResult;
  readonly operatorsNeededFloor: number;
  readonly operatorsNeededDenser: number;
}

function annualCostPerOperator(
  shiftHoursPerDay: number,
  operatingDaysPerWeek: number,
  operatingWeeksPerYear: number,
  wagePerHour: number,
): number {
  return shiftHoursPerDay * operatingDaysPerWeek * operatingWeeksPerYear * wagePerHour;
}

function computeOperatorsNeeded(
  baseCrewSize: number,
  midpointHandlingTimeMinutes: number,
  trailersPerDay: number,
  shiftHoursPerDay: number,
): Result<number> {
  const operatorHoursNeededPerDay = (midpointHandlingTimeMinutes / 60) * trailersPerDay;
  const ceilResult = safeCeilDivide(operatorHoursNeededPerDay, shiftHoursPerDay);
  if (ceilResult.kind === "error") return ceilResult;
  return ok(Math.max(baseCrewSize, ceilResult.value));
}

export function computeRoiModeA(input: RoiModeAInput): Result<RoiModeAResult> {
  if (input.shiftHoursPerDay <= 0) {
    return error("ROI_A_INVALID_SHIFT_HOURS", "Shift hours per day must be greater than zero.");
  }
  if (input.operatingDaysPerWeek <= 0) {
    return error("ROI_A_INVALID_OPERATING_DAYS", "Operating days per week must be greater than zero.");
  }
  if (input.operatingWeeksPerYear <= 0) {
    return error("ROI_A_INVALID_OPERATING_WEEKS", "Operating weeks per year must be greater than zero.");
  }

  const floorDensityResult = safeDivide(input.floorAreaSqFt, input.floorPositions);
  if (floorDensityResult.kind === "error") return floorDensityResult;
  const floorDensitySqFtPerPosition = floorDensityResult.value;

  const annualRentFactor = input.rentRatePerSqftPerMonth * input.monthsPerYear;
  const costPerOperator = annualCostPerOperator(
    input.shiftHoursPerDay,
    input.operatingDaysPerWeek,
    input.operatingWeeksPerYear,
    input.wagePerHour,
  );

  const floorMidpoint =
    (input.floorBaseline.handlingTimeMinMinutesPerTrailer + input.floorBaseline.handlingTimeMaxMinutesPerTrailer) / 2;
  const denserMidpoint =
    (input.denserConfiguration.handlingTimeMinMinutesPerTrailer +
      input.denserConfiguration.handlingTimeMaxMinutesPerTrailer) /
    2;

  const operatorsFloorResult = computeOperatorsNeeded(
    input.baseCrewSize,
    floorMidpoint,
    input.trailersPerDay,
    input.shiftHoursPerDay,
  );
  if (operatorsFloorResult.kind === "error") return operatorsFloorResult;
  const operatorsNeededFloor = operatorsFloorResult.value;

  const operatorsDenserResult = computeOperatorsNeeded(
    input.baseCrewSize,
    denserMidpoint,
    input.trailersPerDay,
    input.shiftHoursPerDay,
  );
  if (operatorsDenserResult.kind === "error") return operatorsDenserResult;
  const operatorsNeededDenser = operatorsDenserResult.value;

  const annualLaborCostFloor = operatorsNeededFloor * costPerOperator;
  const annualLaborCostDenser = operatorsNeededDenser * costPerOperator;

  const rentSavings =
    annualRentFactor *
    (input.denserConfiguration.positionCount * floorDensitySqFtPerPosition -
      input.denserConfiguration.rackAreaFootprintSqFt);
  const extraLabor = annualLaborCostDenser - annualLaborCostFloor;
  const netAnnualBenefit = rentSavings - extraLabor;
  const investment = input.denserConfiguration.positionCount * input.rackCostPerPosition;

  const paybackResult = computePaybackPeriod(investment, netAnnualBenefit);
  if (paybackResult.kind === "error") return paybackResult;

  return ok({
    floorDensitySqFtPerPosition,
    annualRentFactor,
    rentSavings,
    extraLabor,
    netAnnualBenefit,
    investment,
    payback: paybackResult.value,
    operatorsNeededFloor,
    operatorsNeededDenser,
  });
}
