import { describe, expect, it } from "vitest";
import { aggregateBom, type BomResult } from "../bom/bomAggregator.js";
import { computeLineBom } from "../bom/bomFormulas.js";
import { diffBom } from "../diff/diffEngine.js";
import { fromInches, toInches } from "../units/canonicalUnit.js";
import {
  catalog,
  configChangeExample,
  doubleDeepConvergenceExample,
} from "./fixtures/specWorkedExamples.js";

function buildLineEndProtectors(rackColumns: number): { frontEnd: boolean; backEnd: boolean }[] {
  return Array.from({ length: rackColumns }, () => ({ frontEnd: false, backEnd: false }));
}

describe("bomFormulas — per-line formulas (Spec §3.1)", () => {
  it("computes uprights, beams, wire decks, and PPO for a simple line", () => {
    const result = computeLineBom({ bays: 5, beamLevels: 4, deckRequiringLevels: 4, palletLevels: 5, palletsPerLevel: 2 });
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value).toEqual({ uprights: 6, beams: 40, wireDecks: 40, ppo: 50 });
  });

  it("rejects a zero or negative bay count rather than silently coercing it", () => {
    const zero = computeLineBom({ bays: 0, beamLevels: 1, deckRequiringLevels: 1, palletLevels: 2, palletsPerLevel: 1 });
    const negative = computeLineBom({ bays: -3, beamLevels: 1, deckRequiringLevels: 1, palletLevels: 2, palletsPerLevel: 1 });
    expect(zero.kind).toBe("error");
    expect(negative.kind).toBe("error");
  });
});

describe("bomAggregator — Spec §3.2 double-deep convergence", () => {
  it("makes wire decks equal PPO exactly for a standard 2-pallet-wide double-deep rack", () => {
    const example = doubleDeepConvergenceExample;
    const result = aggregateBom({
      configurationType: example.configurationType,
      bays: example.bays,
      palletsPerLevel: example.palletsPerLevel,
      palletLevels: example.palletLevels,
      rackColumns: example.rackColumns,
      uprightHeightIn: example.uprightHeightIn,
      resolvedRowSpacerLengthIn: example.resolvedRowSpacerLengthIn,
      lineEndProtectors: buildLineEndProtectors(example.rackColumns),
      columnProtectorCount: 0,
      anchorsPerUpright: 3,
      anchorsPerProtector: 8,
      catalog,
    });

    expect(result.kind).not.toBe("error");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.wireDecks).toBe(result.value.ppo);
    expect(result.value.wireDecks).toBe(80);
  });
});

describe("bomAggregator + diffEngine — Spec §3.4 config-change worked example", () => {
  function runExample(side: typeof configChangeExample.before | typeof configChangeExample.after): BomResult {
    const result = aggregateBom({
      configurationType: side.configurationType,
      bays: side.bays,
      palletsPerLevel: side.palletsPerLevel,
      palletLevels: side.palletLevels,
      rackColumns: side.rackColumns,
      uprightHeightIn: side.uprightHeightIn,
      resolvedRowSpacerLengthIn: side.resolvedRowSpacerLengthIn,
      lineEndProtectors: buildLineEndProtectors(side.rackColumns),
      columnProtectorCount: 0,
      anchorsPerUpright: 3,
      anchorsPerProtector: 8,
      catalog,
    });
    if (result.kind === "error") throw new Error(`Unexpected error: ${result.message}`);
    return result.value;
  }

  it("matches every hand-derived total for the before (back-to-back) layout", () => {
    const before = runExample(configChangeExample.before);
    expect(before.uprights).toBe(configChangeExample.expected.upright.before);
    expect(before.beams).toBe(configChangeExample.expected.beams.before);
    expect(before.ppo).toBe(configChangeExample.expected.ppo.before);
    expect(before.rowSpacers).toBe(configChangeExample.expected.rowSpacers.before);
    expect(before.rowSpacerLengthIn).toBe(configChangeExample.expected.rowSpacers.beforeLengthIn);
  });

  it("matches every hand-derived total for the after (double-deep) layout", () => {
    const after = runExample(configChangeExample.after);
    expect(after.uprights).toBe(configChangeExample.expected.upright.after);
    expect(after.beams).toBe(configChangeExample.expected.beams.after);
    expect(after.ppo).toBe(configChangeExample.expected.ppo.after);
    expect(after.rowSpacers).toBe(configChangeExample.expected.rowSpacers.after);
    expect(after.rowSpacerLengthIn).toBe(configChangeExample.expected.rowSpacers.afterLengthIn);
  });

  it("reproduces every qualitative delta the Specification calls out", () => {
    const before = runExample(configChangeExample.before);
    const after = runExample(configChangeExample.after);

    // Uprights increase, despite the after-layout having more separate lines/groups and a smaller footprint.
    expect(after.uprights).toBeGreaterThan(before.uprights);
    // Beam count increases — Double-Deep requires its own floor-level beam.
    expect(after.beams).toBeGreaterThan(before.beams);
    // PPO nets down — an accepted trade-off for density.
    expect(after.ppo).toBeLessThan(before.ppo);
    // Row spacer length itself changes — a different physical part, not just a quantity change.
    expect(toInches(after.rowSpacerLengthIn)).not.toBe(toInches(before.rowSpacerLengthIn));
  });

  it("diffs the two layouts as a removal-of-old + addition-of-new pair for row spacers, never a netted number", () => {
    const before = runExample(configChangeExample.before);
    const after = runExample(configChangeExample.after);

    const diffResult = diffBom(after, before);
    expect(diffResult.kind).toBe("ok");
    if (diffResult.kind === "error") throw new Error("unreachable");

    const rowSpacerItems = diffResult.value.lineItems.filter((item) => item.material.startsWith("rowSpacers"));
    // Two distinct line items: a removal of the old 12" spacers and an addition of the new 8" spacers.
    expect(rowSpacerItems).toHaveLength(2);
    expect(rowSpacerItems.some((item) => item.material.includes("12") && item.delta === -14)).toBe(true);
    expect(rowSpacerItems.some((item) => item.material.includes("8") && item.delta === 18)).toBe(true);
    // Never collapsed into one misleading net number (18 - 14 = 4).
    expect(rowSpacerItems.some((item) => item.delta === 4)).toBe(false);
  });
});

describe("bomAggregator — configuration/column-count guards", () => {
  it("rejects a single configuration with more than 1 physical line", () => {
    const result = aggregateBom({
      configurationType: "single",
      bays: 5,
      palletsPerLevel: 1,
      palletLevels: 4,
      rackColumns: 2,
      uprightHeightIn: 96,
      resolvedRowSpacerLengthIn: fromInches(12),
      lineEndProtectors: buildLineEndProtectors(2),
      columnProtectorCount: 0,
      anchorsPerUpright: 3,
      anchorsPerProtector: 8,
      catalog,
    });
    expect(result.kind).toBe("error");
  });

  it("rejects an unknown configuration type as a visible error, never a silent default to single", () => {
    const result = aggregateBom({
      configurationType: "triple-stack-of-nonsense",
      bays: 5,
      palletsPerLevel: 1,
      palletLevels: 4,
      rackColumns: 1,
      uprightHeightIn: 96,
      resolvedRowSpacerLengthIn: fromInches(0),
      lineEndProtectors: buildLineEndProtectors(1),
      columnProtectorCount: 0,
      anchorsPerUpright: 3,
      anchorsPerProtector: 8,
      catalog,
    });
    expect(result.kind).toBe("error");
  });
});
