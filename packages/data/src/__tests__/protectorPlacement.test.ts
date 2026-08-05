import { describe, expect, it } from "vitest";
import { generateId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp } from "../migrations/schemaVersion.js";
import { createProtectorPlacement, validateProtectorPlacement, type ProtectorPlacement } from "../models/protectorPlacement.js";

function baseInput() {
  return {
    layoutId: generateId(),
    rackInstanceId: generateId(),
    lineEndProtectors: [{ frontEnd: true, backEnd: false }],
    columnProtectorUprightIndices: [0, 3, 3],
  };
}

describe("protectorPlacement.ts — Spec §3.1, §3.1b: records end-of-aisle and column protector placement", () => {
  it("creates a well-formed placement", () => {
    const result = createProtectorPlacement(baseInput());
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.lineEndProtectors).toEqual([{ frontEnd: true, backEnd: false }]);
    expect(result.value.columnProtectorUprightIndices).toEqual([0, 3, 3]);
  });

  it("allows a duplicate upright index — both forklift-exposed sides of the same upright can each have a protector", () => {
    const result = createProtectorPlacement(baseInput());
    expect(result.kind).toBe("ok");
  });

  it("rejects a negative or non-integer column protector upright index", () => {
    const negative = createProtectorPlacement({ ...baseInput(), columnProtectorUprightIndices: [-1] });
    const fractional = createProtectorPlacement({ ...baseInput(), columnProtectorUprightIndices: [1.5] });
    expect(negative.kind).toBe("error");
    expect(fractional.kind).toBe("error");
  });

  it("validates lineEndProtectors length against the Rack Instance's rackColumns when expectedLineCount is supplied", () => {
    const now = nowIsoTimestamp();
    const placement: ProtectorPlacement = {
      id: generateId(),
      layoutId: generateId(),
      rackInstanceId: generateId(),
      lineEndProtectors: [{ frontEnd: true, backEnd: false }],
      columnProtectorUprightIndices: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };

    expect(validateProtectorPlacement(placement, 1).kind).toBe("ok");

    const mismatched = validateProtectorPlacement(placement, 2);
    expect(mismatched.kind).toBe("error");
    if (mismatched.kind !== "error") throw new Error("unreachable");
    expect(mismatched.code).toBe("PROTECTOR_PLACEMENT_LINE_COUNT_MISMATCH");
  });

  it("skips the line-count check entirely when expectedLineCount is omitted", () => {
    const now = nowIsoTimestamp();
    const placement: ProtectorPlacement = {
      id: generateId(),
      layoutId: generateId(),
      rackInstanceId: generateId(),
      lineEndProtectors: [{ frontEnd: false, backEnd: false }, { frontEnd: true, backEnd: true }, { frontEnd: false, backEnd: true }],
      columnProtectorUprightIndices: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    expect(validateProtectorPlacement(placement).kind).toBe("ok");
  });
});
