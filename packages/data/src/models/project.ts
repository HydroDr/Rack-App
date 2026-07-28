/**
 * Project entity type + field validation (Spec §6.1, §6.2). A Project is
 * one warehouse / one client, and can contain multiple Layouts — Layouts
 * hold the projectId foreign key, not the other way around, so Layout
 * count is always a live query, never a stored/stale count.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export interface Project extends Versioned {
  readonly id: EntityId;
  readonly name: string;
  readonly clientName: string;
  /** Populated by renderer/thumbnailRenderer.ts once the canvas package exists; absent for a brand-new project. */
  readonly thumbnailDataUrl?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface CreateProjectInput {
  readonly name: string;
  readonly clientName: string;
}

export function createProject(input: CreateProjectInput): Result<Project> {
  const validation = validateProjectFields(input.name, input.clientName);
  if (validation.kind === "error") return validation;

  const now = nowIsoTimestamp();
  return ok({
    id: generateId(),
    name: input.name,
    clientName: input.clientName,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateProject(candidate: Project): Result<Project> {
  if (!isEntityId(candidate.id)) {
    return error("PROJECT_INVALID_ID", "Project id must be a non-empty string.");
  }
  const fields = validateProjectFields(candidate.name, candidate.clientName);
  if (fields.kind === "error") return fields;
  return ok(candidate);
}

function validateProjectFields(name: string, clientName: string): Result<true> {
  if (name.trim().length === 0) {
    return error("PROJECT_INVALID_NAME", "Project name cannot be empty.");
  }
  if (clientName.trim().length === 0) {
    return error("PROJECT_INVALID_CLIENT_NAME", "Client name cannot be empty.");
  }
  return ok(true);
}
