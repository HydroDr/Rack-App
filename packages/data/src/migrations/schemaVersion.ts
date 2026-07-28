/**
 * Defines the current schema version constant and the version field every
 * persisted record carries (Engineering File Plan §3.5). Bump
 * CURRENT_SCHEMA_VERSION and add a step in migrationRunner.ts whenever a
 * model shape changes in a way that would make an older saved record
 * unreadable or miscounted under the new formulas.
 */

export const CURRENT_SCHEMA_VERSION = 1;

export interface Versioned {
  readonly schemaVersion: number;
}

/** ISO 8601 timestamp string — the persisted-record envelope's timestamp convention. */
export type IsoTimestamp = string;

export function nowIsoTimestamp(): IsoTimestamp {
  return new Date().toISOString();
}
