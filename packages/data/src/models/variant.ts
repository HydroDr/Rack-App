/**
 * Variant entity type (height/levels only — must not accept configuration-
 * type fields, per Spec §6.4.3). Validation rejects any attempt to store a
 * configuration type on a Variant, keeping the template/instance boundary
 * enforced in code rather than only by convention: configuration type is
 * Rack Instance state (§6.4.2), never Template or Variant state.
 */

import { addMilliinches, error, ok, scaleMilliinches, toFeet, type Length, type Result, type Weight } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";
import type { RackTemplate } from "./template.js";

export interface Variant extends Versioned {
  readonly id: EntityId;
  /** Must reference a Rack Template specifically — a Variant of a Protector Template has no meaning. */
  readonly parentTemplateId: EntityId;
  readonly palletLevels: number;
  readonly levelCapacitiesLb: readonly Weight[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateVariantInput = Omit<Variant, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createVariant(input: CreateVariantInput): Result<Variant> {
  const now = nowIsoTimestamp();
  return validateVariant({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateVariant(candidate: Variant): Result<Variant> {
  // Runtime guard, independent of the TS type: reject any object that carries a
  // configurationType property at all, in case a caller bypassed the type system
  // (e.g. spreading Rack Instance fields into a Variant by mistake).
  if (Object.prototype.hasOwnProperty.call(candidate, "configurationType")) {
    return error(
      "VARIANT_MUST_NOT_STORE_CONFIGURATION_TYPE",
      "A Variant must never store a configuration type — that is persistent Rack Instance state (Spec §6.4.3), not Template/Variant state.",
    );
  }
  if (!isEntityId(candidate.id)) {
    return error("VARIANT_INVALID_ID", "Variant id must be a non-empty string.");
  }
  if (!isEntityId(candidate.parentTemplateId)) {
    return error("VARIANT_INVALID_PARENT_TEMPLATE", "Variant must reference a valid parent template id.");
  }
  if (!Number.isInteger(candidate.palletLevels) || candidate.palletLevels <= 0) {
    return error("VARIANT_INVALID_PALLET_LEVELS", "Pallet levels must be a positive integer.");
  }
  if (candidate.levelCapacitiesLb.length !== candidate.palletLevels) {
    return error(
      "VARIANT_LEVEL_CAPACITY_COUNT_MISMATCH",
      `Expected ${candidate.palletLevels} level capacities (one per pallet level), got ${candidate.levelCapacitiesLb.length}.`,
    );
  }
  if (candidate.levelCapacitiesLb.some((capacity) => capacity <= 0)) {
    return error("VARIANT_INVALID_LEVEL_CAPACITY", "Every level capacity must be greater than zero.");
  }
  return ok(candidate);
}

/**
 * "Selective Rack — Interlake (5 lvl, 22ft)" — auto-naming per Spec §6.4.3.
 * A pure display computation, not a stored field, so it can never drift out
 * of sync with the parent template's name.
 */
export function getVariantDisplayName(parentTemplate: RackTemplate, variant: Variant): string {
  const perLevelHeight = addMilliinches(parentTemplate.palletHeightIn, parentTemplate.clearanceIn);
  const totalHeightIn: Length = scaleMilliinches(perLevelHeight, variant.palletLevels);
  const totalHeightFt = Math.round(toFeet(totalHeightIn));
  return `${parentTemplate.name} (${variant.palletLevels} lvl, ${totalHeightFt}ft)`;
}
