/**
 * Wall / building-column / dock-door / door entity type (Spec §2.6, §6.3.4).
 * A single rectangular-bounds shape covers all four kinds at this phase —
 * the canvas package renders them distinctly, but the persisted geometry
 * (position + footprint + rotation) is the same shape of data for each.
 */

import { error, ok, type Length, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export type WarehouseElementType = "wall" | "buildingColumn" | "dockDoor" | "door";

export interface WarehouseElement extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  readonly elementType: WarehouseElementType;
  readonly positionXIn: Length;
  readonly positionYIn: Length;
  readonly widthIn: Length;
  readonly depthIn: Length;
  readonly rotationDeg: number;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateWarehouseElementInput = Omit<WarehouseElement, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createWarehouseElement(input: CreateWarehouseElementInput): Result<WarehouseElement> {
  const now = nowIsoTimestamp();
  return validateWarehouseElement({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateWarehouseElement(candidate: WarehouseElement): Result<WarehouseElement> {
  if (!isEntityId(candidate.id)) {
    return error("WAREHOUSE_ELEMENT_INVALID_ID", "Warehouse Element id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("WAREHOUSE_ELEMENT_INVALID_LAYOUT_ID", "Warehouse Element must reference a valid layout id.");
  }
  if (candidate.widthIn <= 0 || candidate.depthIn <= 0) {
    return error("WAREHOUSE_ELEMENT_INVALID_DIMENSIONS", "Warehouse Element width and depth must both be greater than zero.");
  }
  return ok(candidate);
}
