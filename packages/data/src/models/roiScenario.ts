/**
 * ROI Scenario entity type: mode, client-editable assumptions, Zone link
 * (Spec §5.1-§5.3). Mode A and Mode B have genuinely different assumption
 * shapes, so this is a discriminated union by mode rather than one bag of
 * optional fields.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export interface RoiModeAAssumptions {
  readonly rentRatePerSqftPerMonth: number;
  readonly wagePerHour: number;
  readonly shiftHoursPerDay: number;
  readonly operatingDaysPerWeek: number;
  readonly operatingWeeksPerYear: number;
  readonly baseCrewSize: number;
  readonly rackCostPerPosition: number;
  readonly trailersPerDay: number;
  readonly palletsPerTrailer: number;
  readonly handlingTimeMinMinutesPerTrailer: number;
  readonly handlingTimeMaxMinutesPerTrailer: number;
}

export interface RoiModeBAssumptions {
  readonly monthlyForkliftRent: number;
  readonly availableHoursPerMonth: number;
  readonly laborRatePerHour: number;
  readonly minutesPerSingleMove: number;
  readonly rentRatePerSqftPerMonth: number;
  readonly rackCostPerPosition: number;
  readonly palletsPerTrailer: number;
  readonly operatingDaysPerYear: number;
}

interface RoiScenarioBase extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  /** The Zone (or Block Stack Zone, for Mode B) this scenario evaluates. */
  readonly zoneId: EntityId;
  readonly name: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface RoiScenarioModeA extends RoiScenarioBase {
  readonly mode: "A";
  readonly assumptions: RoiModeAAssumptions;
}

export interface RoiScenarioModeB extends RoiScenarioBase {
  readonly mode: "B";
  readonly assumptions: RoiModeBAssumptions;
}

export type RoiScenario = RoiScenarioModeA | RoiScenarioModeB;

export type CreateRoiScenarioInput<T extends RoiScenario = RoiScenario> = Omit<
  T,
  "id" | "createdAt" | "updatedAt" | "schemaVersion"
>;

export function createRoiScenario<T extends RoiScenario>(input: CreateRoiScenarioInput<T>): Result<T> {
  const now = nowIsoTimestamp();
  const candidate = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  } as T;
  return validateRoiScenario(candidate);
}

export function validateRoiScenario<T extends RoiScenario>(candidate: T): Result<T> {
  if (!isEntityId(candidate.id)) {
    return error("ROI_SCENARIO_INVALID_ID", "ROI Scenario id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("ROI_SCENARIO_INVALID_LAYOUT_ID", "ROI Scenario must reference a valid layout id.");
  }
  if (!isEntityId(candidate.zoneId)) {
    return error("ROI_SCENARIO_INVALID_ZONE_ID", "ROI Scenario must reference a valid zone id.");
  }

  if (candidate.mode === "A") {
    const a = candidate.assumptions;
    if (a.shiftHoursPerDay <= 0) {
      return error("ROI_SCENARIO_INVALID_SHIFT_HOURS", "Shift hours per day must be greater than zero.");
    }
    if (a.operatingDaysPerWeek <= 0) {
      return error("ROI_SCENARIO_INVALID_OPERATING_DAYS", "Operating days per week must be greater than zero.");
    }
    if (a.operatingWeeksPerYear <= 0) {
      return error("ROI_SCENARIO_INVALID_OPERATING_WEEKS", "Operating weeks per year must be greater than zero.");
    }
  } else {
    const b = candidate.assumptions;
    if (b.availableHoursPerMonth <= 0) {
      return error("ROI_SCENARIO_INVALID_AVAILABLE_HOURS", "Available forklift hours per month must be greater than zero.");
    }
  }

  return ok(candidate);
}
