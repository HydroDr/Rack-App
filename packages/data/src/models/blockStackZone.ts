/**
 * Specialized Zone for ROI Mode B: columns-deep, rows-high, total
 * positions (Spec §5.3, §6.3.4). Reject 0 for either dimension at the
 * model level, not just in the ROI calculation — catch the bad state at
 * the source (Engineering File Plan §3.1).
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";
import type { ZoneBoundaryPoint } from "./zone.js";

export interface BlockStackZone extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  readonly name: string;
  readonly boundary: readonly ZoneBoundaryPoint[];
  readonly columnsDeep: number;
  readonly rowsHigh: number;
  readonly totalPositions: number;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateBlockStackZoneInput = Omit<BlockStackZone, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createBlockStackZone(input: CreateBlockStackZoneInput): Result<BlockStackZone> {
  const now = nowIsoTimestamp();
  return validateBlockStackZone({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateBlockStackZone(candidate: BlockStackZone): Result<BlockStackZone> {
  if (!isEntityId(candidate.id)) {
    return error("BLOCK_STACK_ZONE_INVALID_ID", "Block Stack Zone id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("BLOCK_STACK_ZONE_INVALID_LAYOUT_ID", "Block Stack Zone must reference a valid layout id.");
  }
  if (candidate.boundary.length < 3) {
    return error("BLOCK_STACK_ZONE_INVALID_BOUNDARY", "Block Stack Zone boundary must have at least 3 points to form a polygon.");
  }
  if (!Number.isInteger(candidate.columnsDeep) || candidate.columnsDeep <= 0) {
    return error("BLOCK_STACK_ZONE_INVALID_COLUMNS", "Columns deep must be a positive integer — 0 columns is not a valid stack.");
  }
  if (!Number.isInteger(candidate.rowsHigh) || candidate.rowsHigh <= 0) {
    return error("BLOCK_STACK_ZONE_INVALID_ROWS", "Rows high must be a positive integer — 0 rows is not a valid stack.");
  }
  if (!Number.isInteger(candidate.totalPositions) || candidate.totalPositions <= 0) {
    return error("BLOCK_STACK_ZONE_INVALID_TOTAL_POSITIONS", "Total positions must be a positive integer.");
  }
  return ok(candidate);
}
