import { describe, expect, it } from "vitest";
import { fromInches } from "@rack-app/rules-engine";
import { CURRENT_SCHEMA_VERSION, generateId, nowIsoTimestamp, type PalletProfile, type ProtectorPlacement, type RackInstance, type RackTemplate } from "@rack-app/state";
import { computeInstanceBom, computeLayoutBom } from "../bomUtils.js";

function makePalletProfile(): PalletProfile {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    name: "Standard 48x40",
    depthIn: fromInches(40),
    widthIn: fromInches(48),
    heightIn: fromInches(6),
    weightLb: 2000 as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function makeTemplate(palletProfileId: RackTemplate["palletProfileId"]): RackTemplate {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    templateType: "rack",
    name: "Standard Rack",
    componentColors: {},
    palletProfileId,
    palletLevels: 3,
    palletHeightIn: fromInches(48),
    clearanceIn: fromInches(6),
    frameDepthIn: fromInches(42),
    beamLengthIn: fromInches(96),
    levelCapacitiesLb: [4000, 4000, 4000] as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function makeInstance(layoutId: RackInstance["layoutId"], templateId: RackInstance["templateId"]): RackInstance {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    layoutId,
    templateId,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays: 4,
    configurationType: "backToBack",
    rackColumns: 2,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function makeProtectorPlacement(layoutId: RackInstance["layoutId"], rackInstanceId: RackInstance["id"], rackColumns: number): ProtectorPlacement {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    layoutId,
    rackInstanceId,
    lineEndProtectors: Array.from({ length: rackColumns }, () => ({ frontEnd: true, backEnd: true })),
    columnProtectorUprightIndices: [0, 1, 3],
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

describe("bomUtils.ts — ProtectorPlacement wiring (carried over from Phase 4 review)", () => {
  it("computeInstanceBom counts zero protectors when no ProtectorPlacement exists for the instance", () => {
    const palletProfile = makePalletProfile();
    const template = makeTemplate(palletProfile.id);
    const instance = makeInstance(template.id as never, template.id);

    const result = computeInstanceBom(instance, template, palletProfile, 4, undefined);
    expect(result.kind).not.toBe("error");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.endOfAisleProtectors).toBe(0);
    expect(result.value.columnProtectors).toBe(0);
  });

  it("computeInstanceBom counts real protector quantities when a matching ProtectorPlacement is supplied", () => {
    const palletProfile = makePalletProfile();
    const template = makeTemplate(palletProfile.id);
    const instance = makeInstance(template.id as never, template.id);
    const placement = makeProtectorPlacement(instance.layoutId, instance.id, instance.rackColumns);

    const withoutProtectors = computeInstanceBom(instance, template, palletProfile, 4, undefined);
    const withProtectors = computeInstanceBom(instance, template, palletProfile, 4, placement);
    expect(withoutProtectors.kind).not.toBe("error");
    expect(withProtectors.kind).not.toBe("error");
    if (withoutProtectors.kind === "error" || withProtectors.kind === "error") throw new Error("unreachable");

    expect(withProtectors.value.endOfAisleProtectors).toBeGreaterThan(withoutProtectors.value.endOfAisleProtectors);
    expect(withProtectors.value.columnProtectors).toBe(3);
  });

  it("computeLayoutBom looks up each instance's ProtectorPlacement by rackInstanceId, not position", () => {
    const palletProfile = makePalletProfile();
    const template = makeTemplate(palletProfile.id);
    const instanceA = makeInstance(template.id as never, template.id);
    const instanceB = makeInstance(template.id as never, template.id);
    const placementForB = makeProtectorPlacement(instanceB.layoutId, instanceB.id, instanceB.rackColumns);

    const bom = computeLayoutBom([instanceA, instanceB], [template], [palletProfile], 4, [placementForB]);
    expect(bom.columnProtectors).toBe(3);
  });

  it("computeInstanceBom pads a ProtectorPlacement whose lineEndProtectors length has drifted below the instance's rackColumns", () => {
    const palletProfile = makePalletProfile();
    const template = makeTemplate(palletProfile.id);
    const instance = makeInstance(template.id as never, template.id);
    const driftedPlacement: ProtectorPlacement = {
      ...makeProtectorPlacement(instance.layoutId, instance.id, instance.rackColumns),
      lineEndProtectors: [{ frontEnd: true, backEnd: false }],
    };

    const result = computeInstanceBom(instance, template, palletProfile, 4, driftedPlacement);
    expect(result.kind).not.toBe("error");
  });
});
