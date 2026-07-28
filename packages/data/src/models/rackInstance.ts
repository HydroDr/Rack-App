/**
 * Rack Instance entity type: position, bays, configuration type (instance-
 * level persistent state), per-component overrides (Spec §6.4.2). Must
 * require a valid Template reference — guard against an orphaned instance
 * whose template was deleted (Engineering File Plan §3.1).
 */

import { error, isConfigurationType, ok, type ConfigurationType, type Length, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";
import type { ComponentColorMap } from "./template.js";

export interface RackInstance extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  readonly templateId: EntityId;
  /** Optional — when set, this instance uses a specific Variant's level/height configuration instead of the base template's. */
  readonly variantId?: EntityId;
  readonly positionXIn: Length;
  readonly positionYIn: Length;
  readonly rotationDeg: number;
  readonly bays: number;
  /** Persistent instance state, resolved reactively — never stored on Template or Variant (Spec §6.4.2). */
  readonly configurationType: ConfigurationType;
  /** Physical rack lines placed side-by-side: 1 = single; 2 = back-to-back or standalone double-deep; 4 = double-deep back-to-back (Spec §2.5). */
  readonly rackColumns: number;
  /** The documented per-instance toppling exception (Spec §2.5): anchored for uplift or externally braced. */
  readonly anchoredOrBracedException: boolean;
  readonly componentColorOverrides?: ComponentColorMap;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateRackInstanceInput = Omit<RackInstance, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createRackInstance(input: CreateRackInstanceInput, existingTemplateIds: ReadonlySet<EntityId>): Result<RackInstance> {
  const now = nowIsoTimestamp();
  return validateRackInstance(
    {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    existingTemplateIds,
  );
}

export function validateRackInstance(candidate: RackInstance, existingTemplateIds: ReadonlySet<EntityId>): Result<RackInstance> {
  if (!isEntityId(candidate.id)) {
    return error("RACK_INSTANCE_INVALID_ID", "Rack Instance id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("RACK_INSTANCE_INVALID_LAYOUT_ID", "Rack Instance must reference a valid layout id.");
  }
  if (!isEntityId(candidate.templateId) || !existingTemplateIds.has(candidate.templateId)) {
    return error(
      "RACK_INSTANCE_ORPHANED_TEMPLATE",
      `Rack Instance references template "${candidate.templateId}", which does not exist — refusing to create an orphaned instance.`,
    );
  }
  if (!Number.isInteger(candidate.bays) || candidate.bays <= 0) {
    return error("RACK_INSTANCE_INVALID_BAYS", "Bays must be a positive integer.");
  }
  if (!isConfigurationType(candidate.configurationType)) {
    return error("RACK_INSTANCE_INVALID_CONFIGURATION_TYPE", `Unknown or missing configuration type: ${String(candidate.configurationType)}`);
  }
  if (!Number.isInteger(candidate.rackColumns) || candidate.rackColumns <= 0) {
    return error("RACK_INSTANCE_INVALID_RACK_COLUMNS", "Rack columns must be a positive integer.");
  }
  return ok(candidate);
}
