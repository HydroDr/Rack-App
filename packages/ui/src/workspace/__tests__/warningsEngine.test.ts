import { describe, expect, it } from "vitest";
import { fromInches } from "@rack-app/rules-engine";
import { CURRENT_SCHEMA_VERSION, generateId, nowIsoTimestamp, type PalletProfile, type RackInstance, type RackTemplate } from "@rack-app/state";
import { collectInstanceWarnings } from "../warningsEngine.js";

function makePalletProfile(overrides: Partial<PalletProfile> = {}): PalletProfile {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    name: "Standard 48x40",
    depthIn: fromInches(40),
    widthIn: fromInches(48),
    heightIn: fromInches(6),
    weightLb: 1500 as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...overrides,
  };
}

function makeTemplate(palletProfileId: RackTemplate["palletProfileId"], overrides: Partial<RackTemplate> = {}): RackTemplate {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    templateType: "rack",
    name: "Test Rack",
    componentColors: {},
    palletProfileId,
    palletLevels: 2,
    palletHeightIn: fromInches(48),
    clearanceIn: fromInches(4),
    frameDepthIn: fromInches(42),
    beamLengthIn: fromInches(96),
    levelCapacitiesLb: [4000, 4000] as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...overrides,
  };
}

function makeInstance(templateId: RackInstance["templateId"], overrides: Partial<RackInstance> = {}): RackInstance {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    layoutId: generateId(),
    templateId,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays: 4,
    configurationType: "single",
    rackColumns: 1,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...overrides,
  };
}

describe("warningsEngine.ts — wires rules-engine checks into a per-instance warning list, never reimplements them", () => {
  it("returns no warnings for a well-proportioned, adequately-capacity instance", () => {
    const palletProfile = makePalletProfile();
    const template = makeTemplate(palletProfile.id);
    const instance = makeInstance(template.id);

    const warnings = collectInstanceWarnings(instance, template, palletProfile, template.frameDepthIn);
    expect(warnings).toHaveLength(0);
  });

  it("flags a toppling ratio violation and a cross-aisle-tie requirement for a tall, narrow rack", () => {
    const palletProfile = makePalletProfile();
    // (60 + 6) * 6 = 396in tall on a 42in depth => ratio ~9.43, over both the 6:1 toppling
    // threshold and the 8:1 cross-aisle-tie threshold.
    const template = makeTemplate(palletProfile.id, { palletLevels: 6, palletHeightIn: fromInches(60), clearanceIn: fromInches(6) });
    const instance = makeInstance(template.id);

    const warnings = collectInstanceWarnings(instance, template, palletProfile, template.frameDepthIn);
    const codes = warnings.map((warning) => warning.code);
    expect(codes).toContain("TOPPLING_RATIO_EXCEEDS_THRESHOLD");
    expect(codes).toContain("CROSS_AISLE_TIES_REQUIRED");
    expect(warnings.every((warning) => warning.instanceId === instance.id)).toBe(true);
  });

  it("anchoredOrBracedException suppresses only the toppling warning, not cross-aisle ties", () => {
    const palletProfile = makePalletProfile();
    const template = makeTemplate(palletProfile.id, { palletLevels: 6, palletHeightIn: fromInches(60), clearanceIn: fromInches(6) });
    const instance = makeInstance(template.id, { anchoredOrBracedException: true });

    const warnings = collectInstanceWarnings(instance, template, palletProfile, template.frameDepthIn);
    const codes = warnings.map((warning) => warning.code);
    expect(codes).not.toContain("TOPPLING_RATIO_EXCEEDS_THRESHOLD");
    expect(codes).toContain("CROSS_AISLE_TIES_REQUIRED");
  });

  it("surfaces a beam-capacity error (weight exceeds every catalog rating) even though WarningCollector only captures warning-kind Results", () => {
    // 1 pallet per 96in beam (pallet as wide as the beam) at an enormous weight — no catalog
    // rating at a 96in span comes anywhere close to covering this.
    const palletProfile = makePalletProfile({ widthIn: fromInches(96), weightLb: 999_999 as never });
    const template = makeTemplate(palletProfile.id);
    const instance = makeInstance(template.id);

    const warnings = collectInstanceWarnings(instance, template, palletProfile, template.frameDepthIn);
    const codes = warnings.map((warning) => warning.code);
    expect(codes).toContain("CATALOG_EXCEEDS_MAX_RATING");
  });
});
