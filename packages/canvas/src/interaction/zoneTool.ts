/**
 * Draw-a-rectangle Zone creation tool (Spec §6.3.3). A Zone is a simple
 * drag-to-rectangle boundary (unlike pathLaneTool.ts's multi-click
 * polyline) — one drag, one commit. Structurally isolated from Groups/
 * Layers: this file never reads or writes a GroupLayer, and the Zone
 * entity itself (data/models/zone.ts) has no group/layer field at all.
 */

import type { StoreApi } from "zustand/vanilla";
import type { Result } from "@rack-app/rules-engine";
import { createZone, type HistoryStore, type LayoutStore, type RoiMode, type Zone, type ZoneBoundaryPoint } from "@rack-app/state";
import { commitCommand, createUpsertCommand, type EntityCommandOps } from "./commandStack.js";

export interface DrawZoneInput {
  readonly name: string;
  readonly roiMode: RoiMode;
  readonly boundary: readonly ZoneBoundaryPoint[];
}

function zoneOps(layoutStore: StoreApi<LayoutStore>): EntityCommandOps<Zone> {
  return {
    upsert: (zone) => layoutStore.getState().upsertZone(zone),
    remove: (id) => layoutStore.getState().removeZone(id),
  };
}

/** Turns two opposite corners of a dragged rectangle into the 4-point polygon boundary Zone/validateZone() expects. */
export function rectangleToZoneBoundary(corner1: ZoneBoundaryPoint, corner2: ZoneBoundaryPoint): readonly ZoneBoundaryPoint[] {
  return [
    { xIn: corner1.xIn, yIn: corner1.yIn },
    { xIn: corner2.xIn, yIn: corner1.yIn },
    { xIn: corner2.xIn, yIn: corner2.yIn },
    { xIn: corner1.xIn, yIn: corner2.yIn },
  ];
}

/**
 * Commits a drawn Zone, routed through commandStack so it's undo-able.
 * Throws if no Layout is loaded — a caller-sequencing bug (the UI must
 * never offer this tool without an open Layout), not a recoverable
 * domain-rule warning, matching placementTool.ts's convention. Returns
 * the createZone() Result as-is otherwise (e.g. an empty-name or
 * too-few-points error), so the caller can surface it without this file
 * needing to know how the UI displays errors.
 */
export function drawZone(layoutStore: StoreApi<LayoutStore>, historyStore: StoreApi<HistoryStore>, input: DrawZoneInput): Result<Zone> {
  const layoutId = layoutStore.getState().layoutId;
  if (layoutId === null) {
    throw new Error("Cannot draw a zone: no Layout is currently loaded.");
  }

  const result = createZone({ layoutId, name: input.name, roiMode: input.roiMode, boundary: input.boundary });
  if (result.kind === "error") return result;

  commitCommand(historyStore, createUpsertCommand(zoneOps(layoutStore), result.value));
  return result;
}
