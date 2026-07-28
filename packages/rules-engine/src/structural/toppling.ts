/**
 * Evaluates the 6:1 height-to-depth ratio (ANSI MH16.1 §12.1.3); returns a
 * warning plus whether a documented anchored/braced exception is recorded
 * on the instance. The threshold value itself must not be silently
 * editable below the code minimum — only the documented per-instance
 * exception path may suppress the warning, never a blanket override
 * (Engineering File Plan §2.6, §9.2; Spec §2.5, §6.5).
 */

import { error, ok, withWarnings, type Result } from "../core/result.js";
import { safeDivide } from "../core/safeMath.js";
import type { Length } from "../units/types.js";
import { ratio, type Ratio } from "../units/types.js";

/** ANSI MH16.1 §12.1.3 code minimum — not a user-editable account/template setting (Spec §6.5). */
export const TOPPLING_RATIO_THRESHOLD = 6;

export interface TopplingCheckInput {
  /** Floor to top-loaded-level. */
  readonly heightIn: Length;
  /** Face-to-face of the upright frame's columns at the floor (single-frame or combined back-to-back depth). */
  readonly depthIn: Length;
  /** Documented per-instance exception: the rack is anchored for uplift or externally braced (Spec §2.5). */
  readonly anchoredOrBracedException: boolean;
}

export interface TopplingCheckResult {
  readonly ratio: Ratio;
  readonly exceedsThreshold: boolean;
  /** True when the ratio exceeds the threshold but the per-instance exception suppresses the warning. */
  readonly exceptionApplied: boolean;
}

export function evaluateToppling(input: TopplingCheckInput): Result<TopplingCheckResult> {
  if (input.heightIn <= 0) {
    return error("TOPPLING_INVALID_HEIGHT", "Height must be greater than zero.");
  }
  if (input.depthIn <= 0) {
    return error("TOPPLING_INVALID_DEPTH", "Depth must be greater than zero.");
  }

  const ratioResult = safeDivide(input.heightIn, input.depthIn);
  if (ratioResult.kind === "error") return ratioResult;
  const ratioValue = ratioResult.value;

  const exceedsThreshold = ratioValue > TOPPLING_RATIO_THRESHOLD;
  const result: TopplingCheckResult = {
    ratio: ratio(ratioValue),
    exceedsThreshold,
    exceptionApplied: exceedsThreshold && input.anchoredOrBracedException,
  };

  if (!exceedsThreshold || input.anchoredOrBracedException) {
    return ok(result);
  }

  return withWarnings(result, [
    {
      code: "TOPPLING_RATIO_EXCEEDS_THRESHOLD",
      category: "structural",
      message:
        `Height-to-depth ratio ${ratioValue.toFixed(2)}:1 exceeds the ${TOPPLING_RATIO_THRESHOLD}:1 threshold ` +
        `(ANSI MH16.1 §12.1.3) — move to back-to-back/double-deep, or anchor/brace to resist overturning.`,
    },
  ]);
}
