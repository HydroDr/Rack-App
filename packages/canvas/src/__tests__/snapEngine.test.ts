import { describe, expect, it } from "vitest";
import { fromInches, toInches } from "@rack-app/rules-engine";
import { computeSnapPoint, type SnapCandidateGeometry, type SnapEngineOptions } from "../interaction/snapEngine.js";

const emptyGeometry: SnapCandidateGeometry = { endpoints: [], midpoints: [], centers: [], edges: [] };

const baseOptions: SnapEngineOptions = {
  gridSnapEnabled: false,
  gridIntervalIn: fromInches(12),
  objectSnapEnabled: false,
  objectSnapTypes: new Set(),
  snapRadiusIn: fromInches(6),
  orthoModeEnabled: false,
};

describe("interaction/snapEngine.ts — Spec §6.3.1a", () => {
  it("returns the raw cursor position, typed 'none', when nothing is enabled", () => {
    const cursor = { xIn: fromInches(13), yIn: fromInches(7) };
    const result = computeSnapPoint(cursor, emptyGeometry, baseOptions);
    expect(result.type).toBe("none");
    expect(result.xIn).toBe(cursor.xIn);
    expect(result.yIn).toBe(cursor.yIn);
  });

  it("grid snap rounds to the nearest grid interval", () => {
    const options: SnapEngineOptions = { ...baseOptions, gridSnapEnabled: true, gridIntervalIn: fromInches(12) };
    const result = computeSnapPoint({ xIn: fromInches(13), yIn: fromInches(7) }, emptyGeometry, options);
    expect(result.type).toBe("grid");
    expect(toInches(result.xIn)).toBeCloseTo(12, 5);
    expect(toInches(result.yIn)).toBeCloseTo(12, 5);
  });

  it("object snap (endpoint) takes priority over grid snap when both are enabled and an endpoint is within radius", () => {
    const geometry: SnapCandidateGeometry = { ...emptyGeometry, endpoints: [{ xIn: fromInches(14), yIn: fromInches(8) }] };
    const options: SnapEngineOptions = {
      ...baseOptions,
      gridSnapEnabled: true,
      objectSnapEnabled: true,
      objectSnapTypes: new Set(["endpoint"]),
      snapRadiusIn: fromInches(6),
    };
    const result = computeSnapPoint({ xIn: fromInches(13), yIn: fromInches(7) }, geometry, options);
    expect(result.type).toBe("endpoint");
    expect(toInches(result.xIn)).toBeCloseTo(14, 5);
    expect(toInches(result.yIn)).toBeCloseTo(8, 5);
  });

  it("falls back to grid snap when no object-snap candidate is within radius", () => {
    const geometry: SnapCandidateGeometry = { ...emptyGeometry, endpoints: [{ xIn: fromInches(500), yIn: fromInches(500) }] };
    const options: SnapEngineOptions = {
      ...baseOptions,
      gridSnapEnabled: true,
      gridIntervalIn: fromInches(12),
      objectSnapEnabled: true,
      objectSnapTypes: new Set(["endpoint"]),
      snapRadiusIn: fromInches(6),
    };
    const result = computeSnapPoint({ xIn: fromInches(13), yIn: fromInches(7) }, geometry, options);
    expect(result.type).toBe("grid");
  });

  it("only considers object-snap types that are individually toggled on", () => {
    const geometry: SnapCandidateGeometry = { ...emptyGeometry, centers: [{ xIn: fromInches(13.5), yIn: fromInches(7.5) }] };
    const options: SnapEngineOptions = {
      ...baseOptions,
      objectSnapEnabled: true,
      objectSnapTypes: new Set(["endpoint"]), // center NOT enabled
      snapRadiusIn: fromInches(6),
    };
    const result = computeSnapPoint({ xIn: fromInches(13), yIn: fromInches(7) }, geometry, options);
    expect(result.type).toBe("none");
  });

  it("edge snap finds the nearest point on a segment, clamped to the segment", () => {
    const geometry: SnapCandidateGeometry = {
      ...emptyGeometry,
      edges: [{ a: { xIn: fromInches(0), yIn: fromInches(0) }, b: { xIn: fromInches(100), yIn: fromInches(0) } }],
    };
    const options: SnapEngineOptions = { ...baseOptions, objectSnapEnabled: true, objectSnapTypes: new Set(["edge"]), snapRadiusIn: fromInches(10) };
    const result = computeSnapPoint({ xIn: fromInches(40), yIn: fromInches(5) }, geometry, options);
    expect(result.type).toBe("edge");
    expect(toInches(result.xIn)).toBeCloseTo(40, 5);
    expect(toInches(result.yIn)).toBeCloseTo(0, 5);
  });

  it("intersection snap finds where two edges cross", () => {
    const geometry: SnapCandidateGeometry = {
      ...emptyGeometry,
      edges: [
        { a: { xIn: fromInches(0), yIn: fromInches(50) }, b: { xIn: fromInches(100), yIn: fromInches(50) } },
        { a: { xIn: fromInches(50), yIn: fromInches(0) }, b: { xIn: fromInches(50), yIn: fromInches(100) } },
      ],
    };
    const options: SnapEngineOptions = { ...baseOptions, objectSnapEnabled: true, objectSnapTypes: new Set(["intersection"]), snapRadiusIn: fromInches(10) };
    const result = computeSnapPoint({ xIn: fromInches(48), yIn: fromInches(48) }, geometry, options);
    expect(result.type).toBe("intersection");
    expect(toInches(result.xIn)).toBeCloseTo(50, 5);
    expect(toInches(result.yIn)).toBeCloseTo(50, 5);
  });

  it("ortho mode locks the resolved point to horizontal or vertical relative to the origin", () => {
    const options: SnapEngineOptions = {
      ...baseOptions,
      orthoModeEnabled: true,
      orthoOriginIn: { xIn: fromInches(0), yIn: fromInches(0) },
    };
    // Cursor moved further in X than Y -> locks to horizontal (y stays at origin's y).
    const horizontal = computeSnapPoint({ xIn: fromInches(20), yIn: fromInches(3) }, emptyGeometry, options);
    expect(toInches(horizontal.yIn)).toBe(0);
    expect(toInches(horizontal.xIn)).toBeCloseTo(20, 5);

    // Cursor moved further in Y than X -> locks to vertical (x stays at origin's x).
    const vertical = computeSnapPoint({ xIn: fromInches(3), yIn: fromInches(20) }, emptyGeometry, options);
    expect(toInches(vertical.xIn)).toBe(0);
    expect(toInches(vertical.yIn)).toBeCloseTo(20, 5);
  });
});
