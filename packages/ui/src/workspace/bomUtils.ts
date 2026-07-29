/**
 * Shared glue between one Rack Instance + its Template and
 * rules-engine's aggregateBom — used by MaterialsTab, CompareTab, and
 * RoiTab so all three call the exact same computation, never separate
 * re-implementations. Not one of the Engineering File Plan §6 named
 * files; it's the UI-layer wiring those files need to actually call
 * rules-engine's formulas with real data.
 *
 * Known simplifications, both flagged for a future phase rather than
 * silently assumed:
 *  - palletsPerLevel is derived from beamLengthIn / pallet width
 *    (Spec §2.3: beam span scales with pallets-per-beam), since
 *    RackTemplate has no explicit palletsPerLevel field.
 *  - Protector placement (which line-ends have an end-of-aisle
 *    protector, how many uprights have a column protector) has no data
 *    model yet — Phase 1 only modeled the Protector Template *type*,
 *    not placement — so every instance computes with zero protectors
 *    until that's built.
 */

import {
  aggregateBom,
  fromInches,
  interlakeDefaultCatalog,
  resolveOverride,
  toInches,
  type BomResult,
  type Result,
} from "@rack-app/rules-engine";
import type { PalletProfile, RackInstance, RackTemplate } from "@rack-app/state";

/** Spec §3.1: "the 8-per-protector multiplier is also user-editable" — a stated default, not yet its own Account Setting field. */
const DEFAULT_ANCHORS_PER_PROTECTOR = 8;
/** Spec §3.1a: default row spacer lengths. */
const DEFAULT_ROW_SPACER_BACK_TO_BACK_IN = 12;
const DEFAULT_ROW_SPACER_DOUBLE_DEEP_IN = 8;

/** Builds an OverrideChain without ever setting templateOverride to undefined, satisfying exactOptionalPropertyTypes. */
export function resolveAccountOrTemplate<T>(accountDefault: T, templateOverride: T | undefined): T {
  return resolveOverride<T>(templateOverride === undefined ? { accountDefault } : { accountDefault, templateOverride }).value;
}

/** The row spacer length this instance resolves to — same logic aggregateBom needs and geometry (instanceGeometry.ts) needs for combined depth, kept in one place. */
export function resolveInstanceRowSpacerLengthIn(instance: RackInstance, template: RackTemplate): ReturnType<typeof fromInches> {
  const isDoubleDeep = instance.configurationType === "doubleDeep";
  const accountDefaultIn = fromInches(isDoubleDeep ? DEFAULT_ROW_SPACER_DOUBLE_DEEP_IN : DEFAULT_ROW_SPACER_BACK_TO_BACK_IN);
  const templateOverrideIn = isDoubleDeep ? template.rowSpacerLengthDoubleDeepIn : template.rowSpacerLengthBackToBackIn;
  return resolveAccountOrTemplate(accountDefaultIn, templateOverrideIn);
}

export function computeInstanceBom(
  instance: RackInstance,
  template: RackTemplate,
  palletProfile: PalletProfile,
  defaultAnchorsPerUpright: number,
): Result<BomResult> {
  const palletsPerLevel = Math.max(1, Math.floor(toInches(template.beamLengthIn) / toInches(palletProfile.widthIn)));

  const anchorsPerUpright = resolveAccountOrTemplate(defaultAnchorsPerUpright, template.anchorsPerUpright);
  const anchorsPerProtector = resolveAccountOrTemplate(DEFAULT_ANCHORS_PER_PROTECTOR, template.anchorsPerProtector);

  const resolvedRowSpacerLengthIn = resolveInstanceRowSpacerLengthIn(instance, template);

  const totalRackHeightIn = (toInches(template.palletHeightIn) + toInches(template.clearanceIn)) * template.palletLevels;

  return aggregateBom({
    configurationType: instance.configurationType,
    bays: instance.bays,
    palletsPerLevel,
    palletLevels: template.palletLevels,
    rackColumns: instance.rackColumns,
    uprightHeightIn: Math.round(totalRackHeightIn),
    resolvedRowSpacerLengthIn,
    lineEndProtectors: Array.from({ length: instance.rackColumns }, () => ({ frontEnd: false, backEnd: false })),
    columnProtectorCount: 0,
    anchorsPerUpright,
    anchorsPerProtector,
    catalog: interlakeDefaultCatalog,
  });
}

export interface MaterialLineItem {
  readonly material: string;
  readonly quantity: number;
}

/** Sums several instances' BomResults into one Materials-tab table. Row spacers of different lengths are kept as separate line items, never merged, since they're different physical parts (Spec §3.4). */
export function buildMaterialLineItems(results: readonly BomResult[]): readonly MaterialLineItem[] {
  const totals = new Map<string, number>();
  function add(key: string, quantity: number): void {
    totals.set(key, (totals.get(key) ?? 0) + quantity);
  }

  for (const result of results) {
    add("Uprights", result.uprights);
    add("Beams", result.beams);
    add("Wire Decks", result.wireDecks);
    add("PPO", result.ppo);
    if (result.rowSpacers > 0) {
      add(`Row Spacers (${toInches(result.rowSpacerLengthIn)}")`, result.rowSpacers);
    }
    add("End-of-Aisle Protectors", result.endOfAisleProtectors);
    add("Column Protectors", result.columnProtectors);
    add("Anchors", result.anchors);
  }

  return Array.from(totals.entries()).map(([material, quantity]) => ({ material, quantity }));
}

/**
 * Sums several instances' BomResults into ONE combined BomResult, for
 * feeding rules-engine's diffBom() (which compares one Layout's totals
 * against another's, Spec §4). Represents rowSpacerLengthIn as whichever
 * length is most common across the instances being summed — real layouts
 * predominantly use one consistent row spacer choice; a genuine per-part
 * breakdown is buildMaterialLineItems()'s job, not this one.
 */
export function sumBomResults(results: readonly BomResult[]): BomResult {
  if (results.length === 0) {
    return {
      uprights: 0,
      beams: 0,
      wireDecks: 0,
      ppo: 0,
      rowSpacers: 0,
      rowSpacerLengthIn: fromInches(0),
      endOfAisleProtectors: 0,
      columnProtectors: 0,
      anchors: 0,
    };
  }

  const lengthCounts = new Map<number, number>();
  for (const result of results) {
    const lengthIn = toInches(result.rowSpacerLengthIn);
    lengthCounts.set(lengthIn, (lengthCounts.get(lengthIn) ?? 0) + 1);
  }
  const [representativeLengthIn] = [...lengthCounts.entries()].sort((a, b) => b[1] - a[1])[0]!;

  return results.reduce<BomResult>(
    (total, result) => ({
      uprights: total.uprights + result.uprights,
      beams: total.beams + result.beams,
      wireDecks: total.wireDecks + result.wireDecks,
      ppo: total.ppo + result.ppo,
      rowSpacers: total.rowSpacers + result.rowSpacers,
      rowSpacerLengthIn: total.rowSpacerLengthIn,
      endOfAisleProtectors: total.endOfAisleProtectors + result.endOfAisleProtectors,
      columnProtectors: total.columnProtectors + result.columnProtectors,
      anchors: total.anchors + result.anchors,
    }),
    {
      uprights: 0,
      beams: 0,
      wireDecks: 0,
      ppo: 0,
      rowSpacers: 0,
      rowSpacerLengthIn: fromInches(representativeLengthIn),
      endOfAisleProtectors: 0,
      columnProtectors: 0,
      anchors: 0,
    },
  );
}

/** Runs computeInstanceBom for every instance and combines the successful results — the shared per-Layout aggregation CompareTab and RoiTab both need. */
export function computeLayoutBom(
  instances: readonly RackInstance[],
  templates: readonly RackTemplate[],
  palletProfiles: readonly PalletProfile[],
  defaultAnchorsPerUpright: number,
): BomResult {
  const results: BomResult[] = [];
  for (const instance of instances) {
    const template = templates.find((candidate) => candidate.id === instance.templateId);
    if (template === undefined) continue;
    const palletProfile = palletProfiles.find((candidate) => candidate.id === template.palletProfileId);
    if (palletProfile === undefined) continue;

    const result = computeInstanceBom(instance, template, palletProfile, defaultAnchorsPerUpright);
    if (result.kind !== "error") results.push(result.value);
  }
  return sumBomResults(results);
}
