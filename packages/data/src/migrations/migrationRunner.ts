/**
 * Applies migrations in order when loading a record saved under an older
 * schema version. Must fail loudly (visible to the user) on a migration it
 * doesn't recognize, never silently load stale or partially-migrated data
 * as if it were current (Engineering File Plan §3.5).
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { CURRENT_SCHEMA_VERSION, type Versioned } from "./schemaVersion.js";

export type MigrationStep = (record: Record<string, unknown>) => Record<string, unknown>;

/**
 * Keyed by the FROM version — e.g. migrations.get(1) advances a v1 record
 * to v2. Empty for now; the first real migration lands here once a model
 * shape actually changes after this schema version ships.
 */
const migrations = new Map<number, MigrationStep>();

export function runMigrations<T extends Versioned>(record: T): Result<T> {
  if (record.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return error(
      "MIGRATION_FUTURE_SCHEMA_VERSION",
      `Record has schema version ${record.schemaVersion}, newer than this build supports (${CURRENT_SCHEMA_VERSION}). Refusing to load — update the application first.`,
    );
  }

  let current: Record<string, unknown> = record as unknown as Record<string, unknown>;
  let version = record.schemaVersion;

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations.get(version);
    if (step === undefined) {
      return error(
        "MIGRATION_UNRECOGNIZED_VERSION",
        `No migration registered to advance schema version ${version} -> ${version + 1}. Refusing to silently load this record as current.`,
      );
    }
    current = step(current);
    version += 1;
  }

  return ok({ ...current, schemaVersion: CURRENT_SCHEMA_VERSION } as T);
}
