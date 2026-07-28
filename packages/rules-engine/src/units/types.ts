/** Shared measurement types used across every other rules-engine file. */

import type { Milliinch } from "./canonicalUnit.js";

/** A length in the canonical internal unit (thousandths-of-an-inch). */
export type Length = Milliinch;

/**
 * A weight in pounds. Weight is not subject to the canonical-unit treatment
 * Length gets — the fractional-drift risk that guards against is inch-scale
 * geometry, not pallet/beam weight ratings.
 */
export type Weight = number & { readonly __brand: "Weight" };

export function weightLb(pounds: number): Weight {
  return pounds as Weight;
}

/** A dimensionless ratio (e.g. height-to-depth). */
export type Ratio = number & { readonly __brand: "Ratio" };

export function ratio(value: number): Ratio {
  return value as Ratio;
}
