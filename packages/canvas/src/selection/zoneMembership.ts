/**
 * Derives a Zone's footprint and contained-position count from the
 * instances inside it, for ROI's "derived from geometry" inputs (Spec
 * §5.2-§5.3). Built on regionQuery.ts's shared implementation rather than
 * writing a separate Zone-specific containment check.
 */

import { toInches } from "@rack-app/rules-engine";
import type { EntityId, RackInstance, Zone, ZoneBoundaryPoint } from "@rack-app/state";
import type { Bounds } from "../geometry/bounds.js";
import { queryInstancesInRegion } from "../geometry/regionQuery.js";

export interface ZoneMembershipResult {
  readonly containedInstances: readonly RackInstance[];
  /** The Zone's own drawn boundary area — the "actual rack-area footprint" ROI Mode A input. */
  readonly footprintAreaSqFt: number;
  /** Sum of each contained instance's PPO, via the caller-supplied getPositionCount (a BOM concern, not this file's job). */
  readonly positionCount: number;
}

/** Shoelace formula; result is always non-negative regardless of the polygon's winding order. */
function computePolygonAreaSqFt(points: readonly ZoneBoundaryPoint[]): number {
  let signedAreaSqIn = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    signedAreaSqIn += toInches(current.xIn) * toInches(next.yIn) - toInches(next.xIn) * toInches(current.yIn);
  }
  const areaSqIn = Math.abs(signedAreaSqIn) / 2;
  const squareInchesPerSquareFoot = 144;
  return areaSqIn / squareInchesPerSquareFoot;
}

export function computeZoneMembership(
  zone: Zone,
  instances: ReadonlyMap<EntityId, RackInstance>,
  boundsOf: (instance: RackInstance) => Bounds,
  getPositionCount: (instance: RackInstance) => number,
): ZoneMembershipResult {
  const containedInstances = queryInstancesInRegion({ kind: "polygon", points: zone.boundary }, instances, boundsOf);
  const footprintAreaSqFt = computePolygonAreaSqFt(zone.boundary);
  const positionCount = containedInstances.reduce((sum, instance) => sum + getPositionCount(instance), 0);

  return { containedInstances, footprintAreaSqFt, positionCount };
}
