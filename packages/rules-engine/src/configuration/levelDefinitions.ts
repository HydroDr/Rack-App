/**
 * Translates a user-entered "pallet levels" count into Beam Levels and
 * Deck-Requiring Levels per configuration type (Spec §3.0) — the single
 * most-depended-on function in the engine. Must explicitly handle an
 * unknown/null configuration type rather than silently defaulting to
 * single — an unresolved config type is a visible error state, not a
 * silent miscount (Engineering File Plan §2.5).
 */

import { error, ok, type Result } from "../core/result.js";

export const CONFIGURATION_TYPES = ["single", "backToBack", "doubleDeep"] as const;
export type ConfigurationType = (typeof CONFIGURATION_TYPES)[number];

export function isConfigurationType(value: unknown): value is ConfigurationType {
  return typeof value === "string" && (CONFIGURATION_TYPES as readonly string[]).includes(value);
}

export interface LevelDefinitions {
  readonly palletLevels: number;
  /** Whether the floor level rests directly on the ground (Single/Back-to-Back) or requires its own beam (Double-Deep). */
  readonly floorPallet: boolean;
  readonly beamLevels: number;
  readonly deckRequiringLevels: number;
}

export function resolveLevelDefinitions(configurationType: unknown, palletLevels: number): Result<LevelDefinitions> {
  if (!isConfigurationType(configurationType)) {
    return error(
      "LEVELS_UNKNOWN_CONFIGURATION_TYPE",
      `Unknown or missing configuration type: ${String(configurationType)}`,
    );
  }
  if (!Number.isInteger(palletLevels) || palletLevels <= 0) {
    return error("LEVELS_INVALID_PALLET_LEVELS", "Pallet levels must be a positive integer.");
  }

  if (configurationType === "doubleDeep") {
    return ok({ palletLevels, floorPallet: false, beamLevels: palletLevels, deckRequiringLevels: palletLevels });
  }

  const beamLevels = palletLevels - 1;
  return ok({ palletLevels, floorPallet: true, beamLevels, deckRequiringLevels: beamLevels });
}
