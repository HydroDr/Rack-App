/**
 * Runs the rules-engine's structural/catalog checks for one Rack
 * Instance and feeds their results into a WarningCollector — never
 * re-implements the toppling/cross-aisle-tie/beam-capacity checks
 * themselves (Spec §2.5, §2.6, §3.1c), only wires their existing
 * outputs to something the Canvas tab can render.
 *
 * beamSelection's "too close to margin" warning resolves its
 * capacityMarginLb the same account-default -> template-override chain
 * bomUtils.ts uses for anchorsPerUpright (Phase 7 — previously this was
 * always 0, making that specific warning dormant). The hard "exceeds
 * every available rating" error from selectBeam() is still surfaced
 * regardless of margin, since that's a genuine capacity problem, not a
 * margin preference.
 */

import {
  evaluateCrossAisleTies,
  evaluateToppling,
  fromInches,
  interlakeDefaultCatalog,
  selectBeam,
  toInches,
  weightLb,
  WarningCollector,
  type CollectedWarning,
  type Length,
} from "@rack-app/rules-engine";
import type { EntityId, PalletProfile, RackInstance, RackTemplate } from "@rack-app/state";
import { resolveAccountOrTemplate } from "./bomUtils.js";

export interface InstanceWarning extends CollectedWarning {
  readonly instanceId: EntityId;
}

export function collectInstanceWarnings(
  instance: RackInstance,
  template: RackTemplate,
  palletProfile: PalletProfile,
  ratioDepthIn: Length,
  defaultCapacityMarginLb: number,
): readonly InstanceWarning[] {
  const collector = new WarningCollector();

  const totalRackHeightIn = fromInches(
    Math.round((toInches(template.palletHeightIn) + toInches(template.clearanceIn)) * template.palletLevels),
  );
  const beamLengthIn = toInches(template.beamLengthIn);

  collector.collect(
    "toppling",
    evaluateToppling({
      heightIn: totalRackHeightIn,
      depthIn: ratioDepthIn,
      anchoredOrBracedException: instance.anchoredOrBracedException,
    }),
  );

  collector.collect(
    "crossAisleTies",
    evaluateCrossAisleTies({
      heightIn: totalRackHeightIn,
      depthIn: ratioDepthIn,
      beamLengthIn,
      catalog: interlakeDefaultCatalog,
    }),
  );

  const palletsPerLevel = Math.max(1, Math.floor(beamLengthIn / toInches(palletProfile.widthIn)));
  const requiredWeightLb = palletsPerLevel * palletProfile.weightLb;
  const marginLb = resolveAccountOrTemplate(weightLb(defaultCapacityMarginLb), template.capacityMarginLb);
  const beamResult = selectBeam(interlakeDefaultCatalog, beamLengthIn, requiredWeightLb, marginLb);

  if (beamResult.kind === "error") {
    // A genuine capacity problem (weight exceeds every rating, or no rating exists at this
    // beam length) — WarningCollector only captures warning-kind Results, not errors, so this
    // is surfaced directly rather than silently dropped.
    return [
      ...collector.all().map((warning) => ({ ...warning, instanceId: instance.id })),
      { code: beamResult.code, category: "catalog" as const, message: beamResult.message, source: "beamSelection", instanceId: instance.id },
    ];
  }

  collector.collect("beamSelection", beamResult);
  return collector.all().map((warning) => ({ ...warning, instanceId: instance.id }));
}
