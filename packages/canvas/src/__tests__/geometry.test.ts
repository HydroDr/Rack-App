import { describe, expect, it } from "vitest";
import { fromInches, toInches } from "@rack-app/rules-engine";
import { computeBounds, computeRegionBounds, boundsWidth, boundsDepth, unionBounds, type Bounds } from "../geometry/bounds.js";
import { boundsOverlap, boundsIntersectsPolygon, pointInBounds, pointInPolygon } from "../geometry/hitTest.js";
import { queryInstancesInRegion } from "../geometry/regionQuery.js";
import type { RackInstance } from "@rack-app/state";

describe("geometry/bounds.ts", () => {
  it("computes bounds for an unrotated rectangle", () => {
    const bounds = computeBounds({ positionXIn: fromInches(10), positionYIn: fromInches(20), widthIn: fromInches(96), depthIn: fromInches(42), rotationDeg: 0 });
    expect(toInches(bounds.minXIn)).toBeCloseTo(10, 5);
    expect(toInches(bounds.minYIn)).toBeCloseTo(20, 5);
    expect(toInches(bounds.maxXIn)).toBeCloseTo(106, 5);
    expect(toInches(bounds.maxYIn)).toBeCloseTo(62, 5);
  });

  it("rotates around the rectangle's center — a 90 degree rotation swaps width/depth extent", () => {
    const bounds = computeBounds({ positionXIn: fromInches(0), positionYIn: fromInches(0), widthIn: fromInches(100), depthIn: fromInches(40), rotationDeg: 90 });
    expect(toInches(boundsWidth(bounds))).toBeCloseTo(40, 1);
    expect(toInches(boundsDepth(bounds))).toBeCloseTo(100, 1);
  });

  it("computeRegionBounds normalizes two arbitrary corner points into min/max form", () => {
    const bounds = computeRegionBounds({ xIn: fromInches(50), yIn: fromInches(10) }, { xIn: fromInches(0), yIn: fromInches(100) });
    expect(toInches(bounds.minXIn)).toBe(0);
    expect(toInches(bounds.maxXIn)).toBe(50);
    expect(toInches(bounds.minYIn)).toBe(10);
    expect(toInches(bounds.maxYIn)).toBe(100);
  });

  it("unionBounds spans every bounds in the list, and errors on an empty list", () => {
    const a: Bounds = { minXIn: fromInches(0), minYIn: fromInches(0), maxXIn: fromInches(10), maxYIn: fromInches(10) };
    const b: Bounds = { minXIn: fromInches(20), minYIn: fromInches(-5), maxXIn: fromInches(30), maxYIn: fromInches(5) };
    const result = unionBounds([a, b]);
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(toInches(result.value.minXIn)).toBe(0);
    expect(toInches(result.value.minYIn)).toBe(-5);
    expect(toInches(result.value.maxXIn)).toBe(30);
    expect(toInches(result.value.maxYIn)).toBe(10);

    expect(unionBounds([]).kind).toBe("error");
  });
});

describe("geometry/hitTest.ts", () => {
  const bounds: Bounds = { minXIn: fromInches(0), minYIn: fromInches(0), maxXIn: fromInches(100), maxYIn: fromInches(50) };

  it("pointInBounds is inclusive of the edges", () => {
    expect(pointInBounds({ xIn: fromInches(0), yIn: fromInches(0) }, bounds)).toBe(true);
    expect(pointInBounds({ xIn: fromInches(50), yIn: fromInches(25) }, bounds)).toBe(true);
    expect(pointInBounds({ xIn: fromInches(101), yIn: fromInches(25) }, bounds)).toBe(false);
  });

  it("boundsOverlap detects overlapping and non-overlapping rectangles", () => {
    const overlapping: Bounds = { minXIn: fromInches(50), minYIn: fromInches(0), maxXIn: fromInches(150), maxYIn: fromInches(50) };
    const disjoint: Bounds = { minXIn: fromInches(200), minYIn: fromInches(0), maxXIn: fromInches(300), maxYIn: fromInches(50) };
    expect(boundsOverlap(bounds, overlapping)).toBe(true);
    expect(boundsOverlap(bounds, disjoint)).toBe(false);
  });

  it("pointInPolygon correctly classifies a simple square", () => {
    const square = [
      { xIn: fromInches(0), yIn: fromInches(0) },
      { xIn: fromInches(10), yIn: fromInches(0) },
      { xIn: fromInches(10), yIn: fromInches(10) },
      { xIn: fromInches(0), yIn: fromInches(10) },
    ];
    expect(pointInPolygon({ xIn: fromInches(5), yIn: fromInches(5) }, square)).toBe(true);
    expect(pointInPolygon({ xIn: fromInches(20), yIn: fromInches(20) }, square)).toBe(false);
  });

  it("boundsIntersectsPolygon detects a rect fully inside a polygon, and rejects a disjoint one", () => {
    const bigSquare = [
      { xIn: fromInches(0), yIn: fromInches(0) },
      { xIn: fromInches(100), yIn: fromInches(0) },
      { xIn: fromInches(100), yIn: fromInches(100) },
      { xIn: fromInches(0), yIn: fromInches(100) },
    ];
    const insideRect: Bounds = { minXIn: fromInches(10), minYIn: fromInches(10), maxXIn: fromInches(20), maxYIn: fromInches(20) };
    const outsideRect: Bounds = { minXIn: fromInches(200), minYIn: fromInches(200), maxXIn: fromInches(220), maxYIn: fromInches(220) };
    expect(boundsIntersectsPolygon(insideRect, bigSquare)).toBe(true);
    expect(boundsIntersectsPolygon(outsideRect, bigSquare)).toBe(false);
  });
});

describe("geometry/regionQuery.ts — single shared implementation", () => {
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

  it("matches instances via a bounds region (marquee) and a polygon region (Zone) using the same function", () => {
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

    const marqueeMatches = queryInstancesInRegion(
      { kind: "bounds", bounds: { minXIn: fromInches(0), minYIn: fromInches(0), maxXIn: fromInches(20), maxYIn: fromInches(20) } },
      instances,
      boundsOf,
    );
    expect(marqueeMatches.map((i) => i.id)).toEqual([inside.id]);

    const polygonMatches = queryInstancesInRegion(
      {
        kind: "polygon",
        points: [
          { xIn: fromInches(0), yIn: fromInches(0) },
          { xIn: fromInches(20), yIn: fromInches(0) },
          { xIn: fromInches(20), yIn: fromInches(20) },
          { xIn: fromInches(0), yIn: fromInches(20) },
        ],
      },
      instances,
      boundsOf,
    );
    expect(polygonMatches.map((i) => i.id)).toEqual([inside.id]);
  });
});
