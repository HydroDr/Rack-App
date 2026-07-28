/**
 * Zone entity type — functional/ROI only, no foreign key to Group (Spec
 * §6.3.3). Same isolation guarantee as groupLayer.ts, enforced from the
 * Zone side: the TS shape has no group/layer field, and validation
 * additionally rejects any object caught carrying one at runtime.
 */

import { error, ok, type Length, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export interface ZoneBoundaryPoint {
  readonly xIn: Length;
  readonly yIn: Length;
}

export type RoiMode = "forwarding" | "distribution";

export interface Zone extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  readonly name: string;
  readonly roiMode: RoiMode;
  /** Polygon vertices; persistent, saved with the Layout (Spec §6.3.3) — never redrawn each session. */
  readonly boundary: readonly ZoneBoundaryPoint[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateZoneInput = Omit<Zone, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createZone(input: CreateZoneInput): Result<Zone> {
  const now = nowIsoTimestamp();
  return validateZone({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateZone(candidate: Zone): Result<Zone> {
  if (Object.prototype.hasOwnProperty.call(candidate, "groupId") || Object.prototype.hasOwnProperty.call(candidate, "layerId")) {
    return error(
      "ZONE_MUST_NOT_REFERENCE_GROUP",
      "A Zone must never carry a Group/Layer reference — Layers/Groups and Zones are structurally isolated (Spec §6.3.3).",
    );
  }
  if (!isEntityId(candidate.id)) {
    return error("ZONE_INVALID_ID", "Zone id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("ZONE_INVALID_LAYOUT_ID", "Zone must reference a valid layout id.");
  }
  if (candidate.name.trim().length === 0) {
    return error("ZONE_INVALID_NAME", "Zone name cannot be empty.");
  }
  if (candidate.boundary.length < 3) {
    return error("ZONE_INVALID_BOUNDARY", "Zone boundary must have at least 3 points to form a polygon.");
  }
  return ok(candidate);
}
