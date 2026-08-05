/**
 * Protector Placement entity type: records which line-ends of a Rack
 * Instance have an end-of-aisle protector, and which upright positions
 * have a column protector (Spec §3.1, §3.1b). One record per Rack
 * Instance. Phase 1 modeled only the Protector Template *type*, not
 * placement — this is what closes that gap so bom/protectorsAndAnchors.ts
 * gets real counts instead of always zero.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

/** Mirrors rules-engine's protectorsAndAnchors.ts LineEndProtectors shape — one entry per physical line of the Rack Instance. */
export interface LineEndProtectorFlags {
  readonly frontEnd: boolean;
  readonly backEnd: boolean;
}

export interface ProtectorPlacement extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  /** One Protector Placement per Rack Instance. */
  readonly rackInstanceId: EntityId;
  /** Length must equal the Rack Instance's rackColumns — validated against expectedLineCount when known. */
  readonly lineEndProtectors: readonly LineEndProtectorFlags[];
  /** 0-based upright positions (0..bays) with a column protector. Duplicate indices are allowed — an upright with protectors on both forklift-exposed sides appears twice. */
  readonly columnProtectorUprightIndices: readonly number[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateProtectorPlacementInput = Omit<ProtectorPlacement, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createProtectorPlacement(input: CreateProtectorPlacementInput, expectedLineCount?: number): Result<ProtectorPlacement> {
  const now = nowIsoTimestamp();
  return validateProtectorPlacement(
    {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    expectedLineCount,
  );
}

/**
 * expectedLineCount is optional (the Rack Instance's rackColumns) — when
 * supplied, lineEndProtectors' length is checked against it, catching a
 * placement that's drifted out of sync with its instance (e.g. after the
 * instance's configuration changed column count).
 */
export function validateProtectorPlacement(candidate: ProtectorPlacement, expectedLineCount?: number): Result<ProtectorPlacement> {
  if (!isEntityId(candidate.id)) {
    return error("PROTECTOR_PLACEMENT_INVALID_ID", "Protector Placement id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("PROTECTOR_PLACEMENT_INVALID_LAYOUT_ID", "Protector Placement must reference a valid layout id.");
  }
  if (!isEntityId(candidate.rackInstanceId)) {
    return error("PROTECTOR_PLACEMENT_INVALID_RACK_INSTANCE_ID", "Protector Placement must reference a valid Rack Instance id.");
  }
  if (expectedLineCount !== undefined && candidate.lineEndProtectors.length !== expectedLineCount) {
    return error(
      "PROTECTOR_PLACEMENT_LINE_COUNT_MISMATCH",
      `Expected ${expectedLineCount} line-end-protector entries (matching the Rack Instance's rackColumns), got ${candidate.lineEndProtectors.length}.`,
    );
  }
  if (candidate.columnProtectorUprightIndices.some((index) => !Number.isInteger(index) || index < 0)) {
    return error("PROTECTOR_PLACEMENT_INVALID_UPRIGHT_INDEX", "Column protector upright indices must all be non-negative integers.");
  }
  return ok(candidate);
}
