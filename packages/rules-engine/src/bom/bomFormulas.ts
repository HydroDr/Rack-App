/**
 * Pure per-line formulas: uprights, beams, wire decks, PPO (Spec §3.1) —
 * each consuming the resolved level counts from configuration/levelDefinitions.ts.
 * Must reject (not silently coerce) a zero or negative bay count
 * (Engineering File Plan §2.7).
 */

import { error, ok, type Result } from "../core/result.js";

export interface BomFormulasInput {
  readonly bays: number;
  readonly beamLevels: number;
  readonly deckRequiringLevels: number;
  readonly palletLevels: number;
  readonly palletsPerLevel: number;
}

export interface BomFormulasResult {
  readonly uprights: number;
  readonly beams: number;
  readonly wireDecks: number;
  readonly ppo: number;
}

export function computeLineBom(input: BomFormulasInput): Result<BomFormulasResult> {
  if (!Number.isInteger(input.bays) || input.bays <= 0) {
    return error("BOM_INVALID_BAYS", "Bays must be a positive integer.");
  }
  if (!Number.isInteger(input.beamLevels) || input.beamLevels < 0) {
    return error("BOM_INVALID_BEAM_LEVELS", "Beam levels must be a non-negative integer.");
  }
  if (!Number.isInteger(input.deckRequiringLevels) || input.deckRequiringLevels < 0) {
    return error("BOM_INVALID_DECK_REQUIRING_LEVELS", "Deck-requiring levels must be a non-negative integer.");
  }
  if (!Number.isInteger(input.palletLevels) || input.palletLevels <= 0) {
    return error("BOM_INVALID_PALLET_LEVELS", "Pallet levels must be a positive integer.");
  }
  if (!Number.isInteger(input.palletsPerLevel) || input.palletsPerLevel <= 0) {
    return error("BOM_INVALID_PALLETS_PER_LEVEL", "Pallets per level must be a positive integer.");
  }

  const uprights = input.bays + 1;
  const beams = 2 * input.beamLevels * input.bays;
  const wireDecks = input.palletsPerLevel * input.deckRequiringLevels * input.bays;
  const ppo = input.palletsPerLevel * input.palletLevels * input.bays;

  return ok({ uprights, beams, wireDecks, ppo });
}
