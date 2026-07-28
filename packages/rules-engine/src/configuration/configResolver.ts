/**
 * Given configuration type, derives floor-beam presence, row-spacer size,
 * and the depth value used in ratio math (single-frame depth vs. combined
 * back-to-back/double-deep depth). Must recompute correctly whenever
 * configuration type changes on an existing instance — stale resolved
 * values must never persist after a config change (Engineering File Plan
 * §2.5). Callers must re-invoke this on every config-type change rather than
 * caching its result, since the file has no state of its own to invalidate.
 */

import { error, ok, type Result } from "../core/result.js";
import { addMilliinches } from "../units/canonicalUnit.js";
import type { Length } from "../units/types.js";
import { isConfigurationType } from "./levelDefinitions.js";

export interface ConfigResolverInput {
  readonly configurationType: unknown;
  /** Single-frame depth, face-to-face of the upright's columns. */
  readonly frameDepthIn: Length;
  /** Row spacer length already resolved via overrideResolver.ts (template/account default). Ignored for "single". */
  readonly resolvedRowSpacerLengthIn: Length;
}

export interface ConfigResolverResult {
  readonly floorBeamRequired: boolean;
  readonly rowSpacerLengthIn: Length;
  /** Depth value used in height-to-depth ratio math: single-frame depth for Single, combined depth for Back-to-Back/Double-Deep. */
  readonly ratioDepthIn: Length;
}

export function resolveConfiguration(input: ConfigResolverInput): Result<ConfigResolverResult> {
  if (!isConfigurationType(input.configurationType)) {
    return error(
      "CONFIG_UNKNOWN_CONFIGURATION_TYPE",
      `Unknown or missing configuration type: ${String(input.configurationType)}`,
    );
  }
  if (input.frameDepthIn <= 0) {
    return error("CONFIG_INVALID_FRAME_DEPTH", "Frame depth must be greater than zero.");
  }

  if (input.configurationType === "single") {
    return ok({
      floorBeamRequired: false,
      rowSpacerLengthIn: 0 as Length,
      ratioDepthIn: input.frameDepthIn,
    });
  }

  if (input.resolvedRowSpacerLengthIn <= 0) {
    return error(
      "CONFIG_INVALID_ROW_SPACER_LENGTH",
      "Row spacer length must be greater than zero for back-to-back/double-deep configurations.",
    );
  }

  const ratioDepthIn = addMilliinches(
    addMilliinches(input.frameDepthIn, input.frameDepthIn),
    input.resolvedRowSpacerLengthIn,
  );

  return ok({
    floorBeamRequired: input.configurationType === "doubleDeep",
    rowSpacerLengthIn: input.resolvedRowSpacerLengthIn,
    ratioDepthIn,
  });
}
