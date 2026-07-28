/**
 * Computes end-of-aisle/column protector counts (max one per line-end) and
 * anchor counts from the Protector Template and Account Setting defaults
 * (Spec §3.1). Each physical line's end is represented as a boolean flag
 * rather than a count, so a count of 2 for a single end is structurally
 * impossible to construct, not just guarded at runtime (Engineering File
 * Plan §2.7).
 */

import { error, withWarnings, type RuleWarning, type Result } from "../core/result.js";

/** ANSI/Interlake code-mandated floor: at least 1 anchor per column (more under seismic/wind) — Spec §3.1. */
const MIN_ANCHORS_PER_UPRIGHT_CODE_FLOOR = 1;

export interface LineEndProtectors {
  readonly frontEnd: boolean;
  readonly backEnd: boolean;
}

export interface ProtectorsAndAnchorsInput {
  /** One entry per physical rack line in the configuration. */
  readonly lineEndProtectors: readonly LineEndProtectors[];
  /** Count of uprights fitted with a column protector (optional, client-requested). */
  readonly columnProtectorCount: number;
  /** Total uprights across the whole configuration (all physical lines). */
  readonly totalUprights: number;
  /** Resolved via overrideResolver.ts — Account Setting default is 3 (Spec §3.1, §6.5). */
  readonly anchorsPerUpright: number;
  /** Resolved via overrideResolver.ts — default 8 per protector (Spec §3.1). */
  readonly anchorsPerProtector: number;
}

export interface ProtectorsAndAnchorsResult {
  readonly endOfAisleProtectorCount: number;
  readonly columnProtectorCount: number;
  readonly totalProtectors: number;
  readonly anchors: number;
}

export function computeProtectorsAndAnchors(input: ProtectorsAndAnchorsInput): Result<ProtectorsAndAnchorsResult> {
  if (input.lineEndProtectors.length === 0) {
    return error("PROTECTORS_NO_LINES", "At least one physical line is required.");
  }
  if (!Number.isInteger(input.columnProtectorCount) || input.columnProtectorCount < 0) {
    return error("PROTECTORS_INVALID_COLUMN_COUNT", "Column protector count cannot be negative.");
  }
  if (!Number.isInteger(input.totalUprights) || input.totalUprights <= 0) {
    return error("PROTECTORS_INVALID_UPRIGHTS", "Total uprights must be a positive integer.");
  }
  if (input.anchorsPerUpright <= 0) {
    return error("PROTECTORS_INVALID_ANCHORS_PER_UPRIGHT", "Anchors per upright must be greater than zero.");
  }
  if (input.anchorsPerProtector < 0) {
    return error("PROTECTORS_INVALID_ANCHORS_PER_PROTECTOR", "Anchors per protector cannot be negative.");
  }

  const endOfAisleProtectorCount = input.lineEndProtectors.reduce(
    (sum, line) => sum + (line.frontEnd ? 1 : 0) + (line.backEnd ? 1 : 0),
    0,
  );
  const totalProtectors = endOfAisleProtectorCount + input.columnProtectorCount;
  const anchors = input.anchorsPerUpright * input.totalUprights + input.anchorsPerProtector * totalProtectors;

  const warnings: RuleWarning[] = [];
  if (input.anchorsPerUpright < MIN_ANCHORS_PER_UPRIGHT_CODE_FLOOR) {
    warnings.push({
      code: "ANCHORS_BELOW_CODE_MINIMUM",
      category: "structural",
      message:
        `Anchors-per-upright (${input.anchorsPerUpright}) is below the ANSI/Interlake code-mandated minimum of ` +
        `${MIN_ANCHORS_PER_UPRIGHT_CODE_FLOOR} anchor per column (more under seismic/wind conditions).`,
    });
  }

  return withWarnings(
    { endOfAisleProtectorCount, columnProtectorCount: input.columnProtectorCount, totalProtectors, anchors },
    warnings,
  );
}
