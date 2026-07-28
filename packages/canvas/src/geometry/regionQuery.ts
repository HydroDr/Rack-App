/**
 * Given an arbitrary region (marquee box or Zone boundary), returns every
 * Rack Instance whose bounds intersect it. Single shared implementation —
 * both the marquee mechanism (interaction/selectionTool.ts) and the Zone
 * mechanism (selection/zoneMembership.ts) call this rather than each
 * writing its own region logic (Spec §6.3.3; Engineering File Plan §5.0).
 */

import type { EntityId, RackInstance, ZoneBoundaryPoint } from "@rack-app/state";
import { boundsIntersectsPolygon, boundsOverlap } from "./hitTest.js";
import type { Bounds } from "./bounds.js";

export type Region = { readonly kind: "bounds"; readonly bounds: Bounds } | { readonly kind: "polygon"; readonly points: readonly ZoneBoundaryPoint[] };

/**
 * boundsOf is supplied by the caller rather than computed here, since a
 * Rack Instance's true footprint depends on its Template's beam length and
 * the resolved configuration depth (Spec §2.5) — resolving that is not
 * this file's job (Engineering File Plan §5.0, §1.1 single-responsibility).
 */
export function queryInstancesInRegion(
  region: Region,
  instances: ReadonlyMap<EntityId, RackInstance>,
  boundsOf: (instance: RackInstance) => Bounds,
): readonly RackInstance[] {
  const matches: RackInstance[] = [];
  for (const instance of instances.values()) {
    const bounds = boundsOf(instance);
    const intersects = region.kind === "bounds" ? boundsOverlap(bounds, region.bounds) : boundsIntersectsPolygon(bounds, region.points);
    if (intersects) {
      matches.push(instance);
    }
  }
  return matches;
}
