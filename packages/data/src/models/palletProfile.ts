/**
 * Pallet Profile entity type (depth/width/height/weight, manufacturer
 * ref) — Spec §2.2, §6.5. Drives rack width/depth sizing and the Template
 * Panel's pallet size/weight filter.
 */

import { error, ok, type Length, type Result, type Weight } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export interface PalletProfile extends Versioned {
  readonly id: EntityId;
  readonly name: string;
  readonly depthIn: Length;
  readonly widthIn: Length;
  readonly heightIn: Length;
  readonly weightLb: Weight;
  readonly manufacturerRef?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreatePalletProfileInput = Omit<PalletProfile, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createPalletProfile(input: CreatePalletProfileInput): Result<PalletProfile> {
  const now = nowIsoTimestamp();
  return validatePalletProfile({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validatePalletProfile(candidate: PalletProfile): Result<PalletProfile> {
  if (!isEntityId(candidate.id)) {
    return error("PALLET_PROFILE_INVALID_ID", "Pallet Profile id must be a non-empty string.");
  }
  if (candidate.name.trim().length === 0) {
    return error("PALLET_PROFILE_INVALID_NAME", "Pallet Profile name cannot be empty.");
  }
  if (candidate.depthIn <= 0 || candidate.widthIn <= 0 || candidate.heightIn <= 0) {
    return error("PALLET_PROFILE_INVALID_DIMENSIONS", "Pallet Profile depth, width, and height must all be greater than zero.");
  }
  if (candidate.weightLb <= 0) {
    return error("PALLET_PROFILE_INVALID_WEIGHT", "Pallet Profile weight must be greater than zero.");
  }
  return ok(candidate);
}
