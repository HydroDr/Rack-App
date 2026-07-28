import { describe, expect, it } from "vitest";
import { fromInches } from "@rack-app/rules-engine";
import type { RackInstance, Zone } from "@rack-app/state";
import { computeZoneMembership } from "../selection/zoneMembership.js";
import type { Bounds } from "../geometry/bounds.js";

function makeInstance(id: string): RackInstance {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: id as never,
    layoutId: "layout-1" as never,
    templateId: "template-1" as never,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays: 1,
    configurationType: "single",
    rackColumns: 1,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

describe("selection/zoneMembership.ts — Spec §5.2-§5.3", () => {
  it("computes a 100ft x 50ft square zone's footprint area as 5000 sq ft", () => {
    // 100ft x 50ft square, expressed in inches (1200in x 600in): 1200 * 600 = 720,000 sq in / 144 = 5000 sq ft.
    const zone: Zone = {
      id: "zone-1" as never,
      layoutId: "layout-1" as never,
      name: "Forwarding",
      roiMode: "forwarding",
      boundary: [
        { xIn: fromInches(0), yIn: fromInches(0) },
        { xIn: fromInches(1200), yIn: fromInches(0) },
        { xIn: fromInches(1200), yIn: fromInches(600) },
        { xIn: fromInches(0), yIn: fromInches(600) },
      ],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      schemaVersion: 1,
    };

    const result = computeZoneMembership(zone, new Map(), () => ({ minXIn: fromInches(0), minYIn: fromInches(0), maxXIn: fromInches(0), maxYIn: fromInches(0) }), () => 0);
    expect(result.footprintAreaSqFt).toBeCloseTo(5000, 0);
  });

  it("sums getPositionCount across every instance actually contained in the zone, via the shared region query", () => {
    const inside = makeInstance("inside");
    const outside = makeInstance("outside");
    const instances = new Map([
      [inside.id, inside],
      [outside.id, outside],
    ]);

    const boundsOf = (instance: RackInstance): Bounds =>
      instance.id === inside.id
        ? { minXIn: fromInches(5), minYIn: fromInches(5), maxXIn: fromInches(15), maxYIn: fromInches(15) }
        : { minXIn: fromInches(500), minYIn: fromInches(500), maxXIn: fromInches(520), maxYIn: fromInches(520) };

    const zone: Zone = {
      id: "zone-1" as never,
      layoutId: "layout-1" as never,
      name: "Forwarding",
      roiMode: "forwarding",
      boundary: [
        { xIn: fromInches(0), yIn: fromInches(0) },
        { xIn: fromInches(20), yIn: fromInches(0) },
        { xIn: fromInches(20), yIn: fromInches(20) },
        { xIn: fromInches(0), yIn: fromInches(20) },
      ],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      schemaVersion: 1,
    };

    const getPositionCount = (instance: RackInstance): number => (instance.id === inside.id ? 12 : 999);
    const result = computeZoneMembership(zone, instances, boundsOf, getPositionCount);

    expect(result.containedInstances.map((i) => i.id)).toEqual([inside.id]);
    expect(result.positionCount).toBe(12);
  });
});
