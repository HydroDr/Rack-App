/**
 * Computes the bounding box of a Rack Instance, Warehouse Element, or
 * arbitrary region (Engineering File Plan §5.0). One shared rotation-aware
 * core (computeBounds) backs all three — kept decoupled from Template
 * resolution: callers that need a Rack Instance's true footprint (which
 * depends on its Template's beam length and the resolved configuration
 * depth) build a RectFootprint themselves and pass it in here, rather than
 * this file reaching into Template data on its own.
 */

import { error, fromInches, ok, subtractMilliinches, toInches, type Length, type Result } from "@rack-app/rules-engine";
import type { ZoneBoundaryPoint } from "@rack-app/state";

export interface Bounds {
  readonly minXIn: Length;
  readonly minYIn: Length;
  readonly maxXIn: Length;
  readonly maxYIn: Length;
}

export interface RectFootprint {
  /** Top-left corner of the un-rotated rectangle. */
  readonly positionXIn: Length;
  readonly positionYIn: Length;
  readonly widthIn: Length;
  readonly depthIn: Length;
  /** Rotation is applied around the rectangle's center. */
  readonly rotationDeg: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** The one shared rotation-aware bounding-box algorithm every other function in this file builds on. */
export function computeBounds(footprint: RectFootprint): Bounds {
  const widthIn = toInches(footprint.widthIn);
  const depthIn = toInches(footprint.depthIn);
  const centerXIn = toInches(footprint.positionXIn) + widthIn / 2;
  const centerYIn = toInches(footprint.positionYIn) + depthIn / 2;

  const halfWidth = widthIn / 2;
  const halfDepth = depthIn / 2;
  const localCorners = [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth },
  ];

  const angle = toRadians(footprint.rotationDeg);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const worldXs = localCorners.map((corner) => centerXIn + corner.x * cos - corner.y * sin);
  const worldYs = localCorners.map((corner) => centerYIn + corner.x * sin + corner.y * cos);

  return {
    minXIn: fromInches(Math.min(...worldXs)),
    minYIn: fromInches(Math.min(...worldYs)),
    maxXIn: fromInches(Math.max(...worldXs)),
    maxYIn: fromInches(Math.max(...worldYs)),
  };
}

export interface RackInstanceFootprintInput {
  readonly positionXIn: Length;
  readonly positionYIn: Length;
  readonly rotationDeg: number;
  readonly bays: number;
  /** From the instance's Template — one bay's beam span. */
  readonly beamLengthIn: Length;
  /** Resolved via rules-engine's configResolver (single-frame depth, or combined back-to-back/double-deep depth). */
  readonly ratioDepthIn: Length;
}

export function computeRackInstanceBounds(input: RackInstanceFootprintInput): Bounds {
  const widthIn = fromInches(toInches(input.beamLengthIn) * input.bays);
  return computeBounds({
    positionXIn: input.positionXIn,
    positionYIn: input.positionYIn,
    widthIn,
    depthIn: input.ratioDepthIn,
    rotationDeg: input.rotationDeg,
  });
}

export function computeWarehouseElementBounds(footprint: RectFootprint): Bounds {
  return computeBounds(footprint);
}

/** Axis-aligned bounds spanning two arbitrary corner points — the shape a marquee-drag region takes. */
export function computeRegionBounds(pointA: ZoneBoundaryPoint, pointB: ZoneBoundaryPoint): Bounds {
  return {
    minXIn: fromInches(Math.min(toInches(pointA.xIn), toInches(pointB.xIn))),
    minYIn: fromInches(Math.min(toInches(pointA.yIn), toInches(pointB.yIn))),
    maxXIn: fromInches(Math.max(toInches(pointA.xIn), toInches(pointB.xIn))),
    maxYIn: fromInches(Math.max(toInches(pointA.yIn), toInches(pointB.yIn))),
  };
}

export function boundsWidth(bounds: Bounds): Length {
  return subtractMilliinches(bounds.maxXIn, bounds.minXIn);
}

export function boundsDepth(bounds: Bounds): Length {
  return subtractMilliinches(bounds.maxYIn, bounds.minYIn);
}

export function unionBounds(boundsList: readonly Bounds[]): Result<Bounds> {
  if (boundsList.length === 0) {
    return error("BOUNDS_EMPTY_LIST", "Cannot compute a union of zero bounds.");
  }
  let minXIn = boundsList[0]!.minXIn;
  let minYIn = boundsList[0]!.minYIn;
  let maxXIn = boundsList[0]!.maxXIn;
  let maxYIn = boundsList[0]!.maxYIn;

  for (const bounds of boundsList.slice(1)) {
    if (bounds.minXIn < minXIn) minXIn = bounds.minXIn;
    if (bounds.minYIn < minYIn) minYIn = bounds.minYIn;
    if (bounds.maxXIn > maxXIn) maxXIn = bounds.maxXIn;
    if (bounds.maxYIn > maxYIn) maxYIn = bounds.maxYIn;
  }

  return ok({ minXIn, minYIn, maxXIn, maxYIn });
}
