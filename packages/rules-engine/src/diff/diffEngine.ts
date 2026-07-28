/**
 * Computes BOM(A) − BOM(B) with material-type-swap detection: a changed
 * part (e.g. 12" row spacers → 8" row spacers, Spec §3.4) shows as a
 * removal-of-old + addition-of-new pair, never a misleading net number.
 * Must not let a swapped part's count coincidentally cancel to a net-zero
 * line and disappear from the diff output (Engineering File Plan §2.8).
 */

import { ok, type Result } from "../core/result.js";
import { toInches } from "../units/canonicalUnit.js";
import type { BomResult } from "../bom/bomAggregator.js";

export interface DiffLineItem {
  readonly material: string;
  /** Positive = more needed in Layout A than Layout B; negative = fewer. */
  readonly delta: number;
}

export interface DiffResult {
  readonly lineItems: readonly DiffLineItem[];
}

const SCALAR_FIELDS: ReadonlyArray<readonly [string, keyof BomResult]> = [
  ["uprights", "uprights"],
  ["beams", "beams"],
  ["wireDecks", "wireDecks"],
  ["ppo", "ppo"],
  ["endOfAisleProtectors", "endOfAisleProtectors"],
  ["columnProtectors", "columnProtectors"],
  ["anchors", "anchors"],
];

function rowSpacerLabel(bom: BomResult): string {
  return `rowSpacers (${toInches(bom.rowSpacerLengthIn)}")`;
}

export function diffBom(layoutA: BomResult, layoutB: BomResult): Result<DiffResult> {
  const lineItems: DiffLineItem[] = [];

  for (const [label, key] of SCALAR_FIELDS) {
    const delta = (layoutA[key] as number) - (layoutB[key] as number);
    if (delta !== 0) {
      lineItems.push({ material: label, delta });
    }
  }

  if (layoutA.rowSpacerLengthIn === layoutB.rowSpacerLengthIn) {
    const delta = layoutA.rowSpacers - layoutB.rowSpacers;
    if (delta !== 0) {
      lineItems.push({ material: rowSpacerLabel(layoutA), delta });
    }
  } else {
    // Different physical part on each side — always shown as a removal + addition pair,
    // never subtracted against each other, even if the counts happen to match.
    if (layoutB.rowSpacers > 0) {
      lineItems.push({ material: rowSpacerLabel(layoutB), delta: -layoutB.rowSpacers });
    }
    if (layoutA.rowSpacers > 0) {
      lineItems.push({ material: rowSpacerLabel(layoutA), delta: layoutA.rowSpacers });
    }
  }

  return ok({ lineItems });
}
