/**
 * Layout entity type + field validation (Spec §6.1). A saved version of a
 * Project's warehouse design (e.g. "Current State", "Proposed Double-Deep
 * Option") — this is the unit Diff (§4) compares two of, within the same
 * Project.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export interface Layout extends Versioned {
  readonly id: EntityId;
  readonly projectId: EntityId;
  readonly name: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface CreateLayoutInput {
  readonly projectId: EntityId;
  readonly name: string;
}

export function createLayout(input: CreateLayoutInput): Result<Layout> {
  const validation = validateLayoutFields(input.projectId, input.name);
  if (validation.kind === "error") return validation;

  const now = nowIsoTimestamp();
  return ok({
    id: generateId(),
    projectId: input.projectId,
    name: input.name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateLayout(candidate: Layout): Result<Layout> {
  if (!isEntityId(candidate.id)) {
    return error("LAYOUT_INVALID_ID", "Layout id must be a non-empty string.");
  }
  const fields = validateLayoutFields(candidate.projectId, candidate.name);
  if (fields.kind === "error") return fields;
  return ok(candidate);
}

function validateLayoutFields(projectId: EntityId, name: string): Result<true> {
  if (!isEntityId(projectId)) {
    return error("LAYOUT_INVALID_PROJECT_ID", "Layout must reference a valid project id.");
  }
  if (name.trim().length === 0) {
    return error("LAYOUT_INVALID_NAME", "Layout name cannot be empty.");
  }
  return ok(true);
}
