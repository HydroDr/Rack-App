/**
 * Shared payback-period math: Investment ÷ Net Annual Benefit, including the
 * "No payback" degenerate case when benefit ≤ 0. Must explicitly branch on
 * Net Annual Benefit ≤ 0 — a naive divide would produce a negative or
 * infinite duration instead of "No payback" (Spec §5.2; Engineering File
 * Plan §2.9).
 */

import { error, ok, type Result } from "../core/result.js";
import { safeDivide } from "../core/safeMath.js";

export type PaybackResult = { readonly kind: "payback"; readonly years: number } | { readonly kind: "noPayback" };

export function computePaybackPeriod(investment: number, netAnnualBenefit: number): Result<PaybackResult> {
  if (investment < 0) {
    return error("ROI_INVALID_INVESTMENT", "Investment cannot be negative.");
  }
  if (netAnnualBenefit <= 0) {
    return ok({ kind: "noPayback" });
  }

  const yearsResult = safeDivide(investment, netAnnualBenefit);
  if (yearsResult.kind === "error") return yearsResult;

  return ok({ kind: "payback", years: yearsResult.value });
}
