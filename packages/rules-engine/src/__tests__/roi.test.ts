import { describe, expect, it } from "vitest";
import { computeRoiModeA } from "../roi/roiModeA.js";
import { computeRoiModeB } from "../roi/roiModeB.js";
import { computePaybackPeriod } from "../roi/roiShared.js";
import { roiModeAExample, roiModeANoPaybackExample, roiModeBExample } from "./fixtures/specWorkedExamples.js";

describe("roiShared.ts — Payback Period (Spec §5.2)", () => {
  it("returns 'No payback' rather than a negative/undefined duration when Net Annual Benefit <= 0", () => {
    const zero = computePaybackPeriod(100_000, 0);
    const negative = computePaybackPeriod(100_000, -5_000);
    expect(zero.kind).toBe("ok");
    expect(negative.kind).toBe("ok");
    if (zero.kind === "error" || negative.kind === "error") throw new Error("unreachable");
    expect(zero.value).toEqual({ kind: "noPayback" });
    expect(negative.value).toEqual({ kind: "noPayback" });
  });

  it("divides investment by net annual benefit when benefit is positive", () => {
    const result = computePaybackPeriod(300_000, 100_000);
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value).toEqual({ kind: "payback", years: 3 });
  });
});

describe("roiModeA.ts — Forwarding Payback Period (Spec §5.2, constructed example)", () => {
  it("matches every hand-derived intermediate value", () => {
    const example = roiModeAExample;
    const result = computeRoiModeA({
      rentRatePerSqftPerMonth: example.rentRatePerSqftPerMonth,
      monthsPerYear: example.monthsPerYear,
      wagePerHour: example.wagePerHour,
      shiftHoursPerDay: example.shiftHoursPerDay,
      operatingDaysPerWeek: example.operatingDaysPerWeek,
      operatingWeeksPerYear: example.operatingWeeksPerYear,
      baseCrewSize: example.baseCrewSize,
      rackCostPerPosition: example.rackCostPerPosition,
      trailersPerDay: example.trailersPerDay,
      floorAreaSqFt: example.floorAreaSqFt,
      floorPositions: example.floorPositions,
      floorBaseline: example.floorBaseline,
      denserConfiguration: example.denserConfiguration,
    });

    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    const value = result.value;

    expect(value.floorDensitySqFtPerPosition).toBe(example.expected.floorDensitySqFtPerPosition);
    expect(value.annualRentFactor).toBe(example.expected.annualRentFactor);
    expect(value.operatorsNeededFloor).toBe(example.expected.operatorsNeededFloor);
    expect(value.operatorsNeededDenser).toBe(example.expected.operatorsNeededDenser);
    expect(value.rentSavings).toBe(example.expected.rentSavings);
    expect(value.extraLabor).toBe(example.expected.extraLabor);
    expect(value.netAnnualBenefit).toBe(example.expected.netAnnualBenefit);
    expect(value.investment).toBe(example.expected.investment);
    expect(value.payback).toEqual({ kind: "payback", years: example.expected.paybackYears });
  });

  it("reports 'No payback' when the denser configuration's labor cost erases the rent savings", () => {
    const example = roiModeANoPaybackExample;
    const result = computeRoiModeA({
      rentRatePerSqftPerMonth: example.rentRatePerSqftPerMonth,
      monthsPerYear: example.monthsPerYear,
      wagePerHour: example.wagePerHour,
      shiftHoursPerDay: example.shiftHoursPerDay,
      operatingDaysPerWeek: example.operatingDaysPerWeek,
      operatingWeeksPerYear: example.operatingWeeksPerYear,
      baseCrewSize: example.baseCrewSize,
      rackCostPerPosition: example.rackCostPerPosition,
      trailersPerDay: example.trailersPerDay,
      floorAreaSqFt: example.floorAreaSqFt,
      floorPositions: example.floorPositions,
      floorBaseline: example.floorBaseline,
      denserConfiguration: example.denserConfiguration,
    });

    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.netAnnualBenefit).toBeLessThanOrEqual(0);
    expect(result.value.payback).toEqual({ kind: "noPayback" });
  });

  it("guards shift hours = 0 and operating days/weeks = 0 before any division", () => {
    const base = {
      rentRatePerSqftPerMonth: 1,
      monthsPerYear: 12,
      wagePerHour: 20,
      baseCrewSize: 1,
      rackCostPerPosition: 100,
      trailersPerDay: 10,
      floorAreaSqFt: 10_000,
      floorPositions: 100,
      floorBaseline: { positionCount: 100, rackAreaFootprintSqFt: 0, handlingTimeMinMinutesPerTrailer: 10, handlingTimeMaxMinutesPerTrailer: 20 },
      denserConfiguration: { positionCount: 150, rackAreaFootprintSqFt: 5_000, handlingTimeMinMinutesPerTrailer: 10, handlingTimeMaxMinutesPerTrailer: 20 },
    };

    const zeroShiftHours = computeRoiModeA({ ...base, shiftHoursPerDay: 0, operatingDaysPerWeek: 5, operatingWeeksPerYear: 50 });
    const zeroOperatingDays = computeRoiModeA({ ...base, shiftHoursPerDay: 8, operatingDaysPerWeek: 0, operatingWeeksPerYear: 50 });
    const zeroOperatingWeeks = computeRoiModeA({ ...base, shiftHoursPerDay: 8, operatingDaysPerWeek: 5, operatingWeeksPerYear: 0 });

    expect(zeroShiftHours.kind).toBe("error");
    expect(zeroOperatingDays.kind).toBe("error");
    expect(zeroOperatingWeeks.kind).toBe("error");
  });
});

describe("roiModeB.ts — Distribution Payback Period / Toray re-handling method (Spec §5.3, constructed example)", () => {
  it("matches every hand-derived intermediate value", () => {
    const example = roiModeBExample;
    const result = computeRoiModeB({
      monthlyForkliftRent: example.monthlyForkliftRent,
      availableHoursPerMonth: example.availableHoursPerMonth,
      laborRatePerHour: example.laborRatePerHour,
      minutesPerSingleMove: example.minutesPerSingleMove,
      rackCostPerPosition: example.rackCostPerPosition,
      positionCount: example.positionCount,
      annualPickMoveVolume: example.annualPickMoveVolume,
      blockStackGrid: example.blockStackGrid,
    });

    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    const value = result.value;

    expect(value.forkliftCostPerHour).toBeCloseTo(example.expected.forkliftCostPerHour, 10);
    expect(value.expectedReshuffleMovesPerPick).toBeCloseTo(example.expected.expectedReshuffleMovesPerPick, 10);
    expect(value.investment).toBe(example.expected.investment);
    expect(value.payback.kind).toBe("payback");
  });

  it("computes the moves-to-reach grid correctly: 2 per unit of depth, +2 flat once above ground level", () => {
    // A 1-column x 2-row grid: (1,1) = 0 moves, (1,2) = 2 moves -> average 1.
    const result = computeRoiModeB({
      monthlyForkliftRent: 1_000,
      availableHoursPerMonth: 100,
      laborRatePerHour: 20,
      minutesPerSingleMove: 1,
      rackCostPerPosition: 100,
      positionCount: 10,
      annualPickMoveVolume: 1,
      blockStackGrid: { columnsDeep: 1, rowsHigh: 2 },
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.expectedReshuffleMovesPerPick).toBe(1);
  });

  it("guards a block-stack grid with 0 columns or 0 rows before averaging", () => {
    const zeroColumns = computeRoiModeB({
      monthlyForkliftRent: 1_000,
      availableHoursPerMonth: 100,
      laborRatePerHour: 20,
      minutesPerSingleMove: 1,
      rackCostPerPosition: 100,
      positionCount: 10,
      annualPickMoveVolume: 1,
      blockStackGrid: { columnsDeep: 0, rowsHigh: 2 },
    });
    const zeroRows = computeRoiModeB({
      monthlyForkliftRent: 1_000,
      availableHoursPerMonth: 100,
      laborRatePerHour: 20,
      minutesPerSingleMove: 1,
      rackCostPerPosition: 100,
      positionCount: 10,
      annualPickMoveVolume: 1,
      blockStackGrid: { columnsDeep: 3, rowsHigh: 0 },
    });
    expect(zeroColumns.kind).toBe("error");
    expect(zeroRows.kind).toBe("error");
  });

  it("guards zero available forklift hours per month before dividing", () => {
    const result = computeRoiModeB({
      monthlyForkliftRent: 1_000,
      availableHoursPerMonth: 0,
      laborRatePerHour: 20,
      minutesPerSingleMove: 1,
      rackCostPerPosition: 100,
      positionCount: 10,
      annualPickMoveVolume: 1,
      blockStackGrid: { columnsDeep: 2, rowsHigh: 2 },
    });
    expect(result.kind).toBe("error");
  });
});
