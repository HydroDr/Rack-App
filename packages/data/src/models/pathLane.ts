/**
 * Foot/forklift path entity type: polyline segments, width, marker
 * interval (Spec §6.3.1d).
 */

import { error, ok, type Length, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export type PathLaneType = "foot" | "forklift";

export interface PathPoint {
  readonly xIn: Length;
  readonly yIn: Length;
}

export interface PathLane extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  readonly laneType: PathLaneType;
  readonly widthIn: Length;
  /** Polyline vertices — straight segments or common-angle turns per Spec §6.3.1d, never a smooth curve. */
  readonly segments: readonly PathPoint[];
  readonly markerIntervalIn: Length;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreatePathLaneInput = Omit<PathLane, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createPathLane(input: CreatePathLaneInput): Result<PathLane> {
  const now = nowIsoTimestamp();
  return validatePathLane({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validatePathLane(candidate: PathLane): Result<PathLane> {
  if (!isEntityId(candidate.id)) {
    return error("PATH_LANE_INVALID_ID", "Path Lane id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("PATH_LANE_INVALID_LAYOUT_ID", "Path Lane must reference a valid layout id.");
  }
  if (candidate.widthIn <= 0) {
    return error("PATH_LANE_INVALID_WIDTH", "Path Lane width must be greater than zero.");
  }
  if (candidate.segments.length < 2) {
    return error("PATH_LANE_INVALID_SEGMENTS", "Path Lane must have at least 2 points to form a segment.");
  }
  if (candidate.markerIntervalIn <= 0) {
    return error("PATH_LANE_INVALID_MARKER_INTERVAL", "Marker interval must be greater than zero.");
  }
  return ok(candidate);
}
