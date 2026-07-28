import { describe, expect, it } from "vitest";
import { runMigrations } from "../migrations/migrationRunner.js";
import { CURRENT_SCHEMA_VERSION } from "../migrations/schemaVersion.js";

interface DummyRecord {
  readonly schemaVersion: number;
  readonly value: string;
}

describe("migrationRunner.ts — Spec §3.5: fail loudly, never silently load stale/partial data", () => {
  it("passes a record already at the current schema version through unchanged", () => {
    const record: DummyRecord = { schemaVersion: CURRENT_SCHEMA_VERSION, value: "hello" };
    const result = runMigrations(record);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("unreachable");
    expect(result.value).toEqual(record);
  });

  it("refuses to load a record from a newer schema version than this build supports", () => {
    const record: DummyRecord = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, value: "from the future" };
    const result = runMigrations(record);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("MIGRATION_FUTURE_SCHEMA_VERSION");
  });

  it("fails loudly on an older schema version with no registered migration step, rather than silently loading it as current", () => {
    const record: DummyRecord = { schemaVersion: CURRENT_SCHEMA_VERSION - 1, value: "old" };
    const result = runMigrations(record);
    // No migration steps are registered yet (schema version 1 is still current) — an older
    // version can only occur once a real migration exists, so this must fail loudly, not
    // silently coerce the version number.
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("MIGRATION_UNRECOGNIZED_VERSION");
  });
});
