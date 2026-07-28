/**
 * Click/drag selection of canvas objects (Spec §6.3.3). Uses
 * geometry/hitTest.ts for a single click and geometry/regionQuery.ts
 * (the same shared implementation Zone membership uses) for a marquee
 * drag (Engineering File Plan §5.0, §5.2).
 *
 * Deliberately NOT routed through commandStack/historyStore: selection is
 * view state, not part of the undo-able design history — standard CAD
 * convention is that undo never un-selects something. Every other
 * mutating tool in this package must go through commandStack; this file
 * is the one documented exception, and only for this reason.
 */

import type { StoreApi } from "zustand/vanilla";
import type { LayoutStore, RackInstance, ZoneBoundaryPoint } from "@rack-app/state";
import { pointInBounds } from "../geometry/hitTest.js";
import { computeRegionBounds, type Bounds } from "../geometry/bounds.js";
import { queryInstancesInRegion, type Region } from "../geometry/regionQuery.js";

export interface SelectionToolDeps {
  readonly layoutStore: StoreApi<LayoutStore>;
  readonly boundsOf: (instance: RackInstance) => Bounds;
}

/** Click selection: hits the topmost (last-inserted-order) instance under the point, if any. */
export function selectAtPoint(deps: SelectionToolDeps, point: ZoneBoundaryPoint, additive = false): void {
  const state = deps.layoutStore.getState();
  const hit = Array.from(state.rackInstances.values()).find((instance) => pointInBounds(point, deps.boundsOf(instance)));

  if (hit === undefined) {
    if (!additive) state.clearSelection();
    return;
  }

  if (additive) {
    state.toggleSelection(hit.id);
  } else {
    state.setSelection(new Set([hit.id]));
  }
}

/** Marquee-drag selection: every instance whose bounds intersect the dragged box. */
export function selectInMarquee(deps: SelectionToolDeps, cornerA: ZoneBoundaryPoint, cornerB: ZoneBoundaryPoint, additive = false): void {
  const state = deps.layoutStore.getState();
  const region: Region = { kind: "bounds", bounds: computeRegionBounds(cornerA, cornerB) };
  const matched = queryInstancesInRegion(region, state.rackInstances, deps.boundsOf);

  if (additive) {
    const next = new Set(state.selectedIds);
    for (const instance of matched) next.add(instance.id);
    state.setSelection(next);
  } else {
    state.setSelection(new Set(matched.map((instance) => instance.id)));
  }
}
