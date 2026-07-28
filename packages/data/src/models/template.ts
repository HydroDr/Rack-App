/**
 * Template entity type, including per-component color/material map and
 * formula/constant overrides (Spec §6.4.1, §3.1a, §3.1b, §3.1c). Two kinds
 * share one entity shell — a Rack Template and a Protector Template are
 * deliberately separate template types (§3.1b: protector sizes/types vary
 * independently of the rack template they're paired with) — modeled as a
 * discriminated union rather than two files, since both are still exactly
 * one job: "define what a Template is."
 *
 * Override fields (anchorsPerUpright, capacityMarginLb, row spacer
 * lengths, ...) are optional: undefined means "not overridden here," so
 * configuration/overrideResolver.ts's account -> template -> instance
 * chain falls through to the account default. A template never hardcodes
 * a resolved value, only its own override tier.
 */

import { error, ok, type Length, type Result, type Weight } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export type ComponentType = "upright" | "beam" | "wireDeck" | "rowSpacer" | "protector";

export type ComponentColorMap = Readonly<Partial<Record<ComponentType, string>>>;

interface TemplateBase extends Versioned {
  readonly id: EntityId;
  readonly name: string;
  readonly componentColors: ComponentColorMap;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface RackTemplate extends TemplateBase {
  readonly templateType: "rack";
  readonly palletProfileId: EntityId;
  readonly palletLevels: number;
  readonly palletHeightIn: Length;
  /** Overhead clearance above each pallet (Spec §2.3 default: 4"). */
  readonly clearanceIn: Length;
  readonly frameDepthIn: Length;
  readonly beamLengthIn: Length;
  /** One rated capacity per level — capacity is not necessarily uniform across all levels (Spec §3.1c). Length must equal palletLevels. */
  readonly levelCapacitiesLb: readonly Weight[];
  readonly rowSpacerLengthBackToBackIn?: Length;
  readonly rowSpacerLengthDoubleDeepIn?: Length;
  readonly anchorsPerUpright?: number;
  readonly anchorsPerProtector?: number;
  readonly capacityMarginLb?: Weight;
}

export type ProtectorKind = "endOfAisle" | "column";

export interface ProtectorTemplate extends TemplateBase {
  readonly templateType: "protector";
  readonly protectorKind: ProtectorKind;
  readonly heightIn: Length;
  readonly widthIn: Length;
  readonly thicknessIn: Length;
}

export type Template = RackTemplate | ProtectorTemplate;

export type CreateRackTemplateInput = Omit<RackTemplate, "id" | "createdAt" | "updatedAt" | "schemaVersion">;
export type CreateProtectorTemplateInput = Omit<ProtectorTemplate, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

function withEnvelope<T extends TemplateBase>(fields: Omit<T, "id" | "createdAt" | "updatedAt" | "schemaVersion">): T {
  const now = nowIsoTimestamp();
  return {
    ...fields,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  } as T;
}

export function createRackTemplate(input: CreateRackTemplateInput): Result<RackTemplate> {
  const template = withEnvelope<RackTemplate>(input);
  return validateTemplate(template);
}

export function createProtectorTemplate(input: CreateProtectorTemplateInput): Result<ProtectorTemplate> {
  const template = withEnvelope<ProtectorTemplate>(input);
  return validateTemplate(template);
}

export function validateTemplate<T extends Template>(candidate: T): Result<T> {
  if (!isEntityId(candidate.id)) {
    return error("TEMPLATE_INVALID_ID", "Template id must be a non-empty string.");
  }
  if (candidate.name.trim().length === 0) {
    return error("TEMPLATE_INVALID_NAME", "Template name cannot be empty.");
  }

  if (candidate.templateType === "rack") {
    if (!isEntityId(candidate.palletProfileId)) {
      return error("TEMPLATE_INVALID_PALLET_PROFILE", "Rack template must reference a valid pallet profile id.");
    }
    if (!Number.isInteger(candidate.palletLevels) || candidate.palletLevels <= 0) {
      return error("TEMPLATE_INVALID_PALLET_LEVELS", "Pallet levels must be a positive integer.");
    }
    if (candidate.palletHeightIn <= 0) {
      return error("TEMPLATE_INVALID_PALLET_HEIGHT", "Pallet height must be greater than zero.");
    }
    if (candidate.clearanceIn <= 0) {
      return error("TEMPLATE_INVALID_CLEARANCE", "Overhead clearance must be greater than zero.");
    }
    if (candidate.frameDepthIn <= 0) {
      return error("TEMPLATE_INVALID_FRAME_DEPTH", "Frame depth must be greater than zero.");
    }
    if (candidate.beamLengthIn <= 0) {
      return error("TEMPLATE_INVALID_BEAM_LENGTH", "Beam length must be greater than zero.");
    }
    if (candidate.levelCapacitiesLb.length !== candidate.palletLevels) {
      return error(
        "TEMPLATE_LEVEL_CAPACITY_COUNT_MISMATCH",
        `Expected ${candidate.palletLevels} level capacities (one per pallet level), got ${candidate.levelCapacitiesLb.length}.`,
      );
    }
    if (candidate.levelCapacitiesLb.some((capacity) => capacity <= 0)) {
      return error("TEMPLATE_INVALID_LEVEL_CAPACITY", "Every level capacity must be greater than zero.");
    }
  } else {
    if (candidate.heightIn <= 0 || candidate.widthIn <= 0 || candidate.thicknessIn <= 0) {
      return error("TEMPLATE_INVALID_PROTECTOR_DIMENSIONS", "Protector template dimensions must all be greater than zero.");
    }
  }

  return ok(candidate);
}
