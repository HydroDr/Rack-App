/**
 * Group/Layer entity type — organizational only, no foreign key to Zone
 * (Spec §6.3.3). Must not allow a foreign-key relationship to Zone — this
 * is the structural guarantee behind the Layers/Zones separation: the TS
 * shape has no zone field, and validation additionally rejects any object
 * caught carrying one at runtime.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export interface GroupLayer extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  readonly name: string;
  /** Any canvas object id (Rack Instance, Warehouse Element, Path Lane) belonging to this group. */
  readonly memberIds: readonly EntityId[];
  readonly visible: boolean;
  readonly locked: boolean;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateGroupLayerInput = Omit<GroupLayer, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createGroupLayer(input: CreateGroupLayerInput): Result<GroupLayer> {
  const now = nowIsoTimestamp();
  return validateGroupLayer({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateGroupLayer(candidate: GroupLayer): Result<GroupLayer> {
  if (Object.prototype.hasOwnProperty.call(candidate, "zoneId")) {
    return error(
      "GROUP_LAYER_MUST_NOT_REFERENCE_ZONE",
      "A Group/Layer must never carry a Zone reference — Layers/Groups and Zones are structurally isolated (Spec §6.3.3).",
    );
  }
  if (!isEntityId(candidate.id)) {
    return error("GROUP_LAYER_INVALID_ID", "Group/Layer id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("GROUP_LAYER_INVALID_LAYOUT_ID", "Group/Layer must reference a valid layout id.");
  }
  if (candidate.name.trim().length === 0) {
    return error("GROUP_LAYER_INVALID_NAME", "Group/Layer name cannot be empty.");
  }
  return ok(candidate);
}
