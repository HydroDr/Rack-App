/**
 * Mirrors a selected rack line or group across an axis (Spec §6.3.1c) —
 * useful for symmetric layouts (e.g. two mirrored aisles flanking a
 * center aisle). Creates mirrored copies rather than transforming the
 * originals in place, so the result is both the original and its mirror
 * (Engineering File Plan §5.2).
 *
 * Supports axis-aligned mirrors (vertical or horizontal line) only —
 * covers the described "flanking a center aisle" use case; arbitrary-
 * angle mirror axes are not implemented.
 */

import type { StoreApi } from "zustand/vanilla";
import {
  addMilliinches,
  scaleMilliinches,
  subtractMilliinches,
  type Length,
} from "@rack-app/rules-engine";
import { generateId, nowIsoTimestamp, type HistoryStore, type LayoutStore, type RackInstance } from "@rack-app/state";
import { commitCommand, createBatchCommand, createUpsertCommand, type EntityCommandOps } from "./commandStack.js";

export type MirrorAxis = { readonly kind: "vertical"; readonly xIn: Length } | { readonly kind: "horizontal"; readonly yIn: Length };

export interface RackFootprintSize {
  readonly widthIn: Length;
  readonly depthIn: Length;
}

function normalizeAngleDeg(degrees: number): number {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function mirrorTransform(
  instance: RackInstance,
  axis: MirrorAxis,
  footprint: RackFootprintSize,
): { positionXIn: Length; positionYIn: Length; rotationDeg: number } {
  const halfWidthIn = scaleMilliinches(footprint.widthIn, 0.5);
  const halfDepthIn = scaleMilliinches(footprint.depthIn, 0.5);
  const centerXIn = addMilliinches(instance.positionXIn, halfWidthIn);
  const centerYIn = addMilliinches(instance.positionYIn, halfDepthIn);

  if (axis.kind === "vertical") {
    const mirroredCenterXIn = subtractMilliinches(scaleMilliinches(axis.xIn, 2), centerXIn);
    return {
      positionXIn: subtractMilliinches(mirroredCenterXIn, halfWidthIn),
      positionYIn: instance.positionYIn,
      rotationDeg: normalizeAngleDeg(180 - instance.rotationDeg),
    };
  }

  const mirroredCenterYIn = subtractMilliinches(scaleMilliinches(axis.yIn, 2), centerYIn);
  return {
    positionXIn: instance.positionXIn,
    positionYIn: subtractMilliinches(mirroredCenterYIn, halfDepthIn),
    rotationDeg: normalizeAngleDeg(-instance.rotationDeg),
  };
}

function rackInstanceOps(layoutStore: StoreApi<LayoutStore>): EntityCommandOps<RackInstance> {
  return {
    upsert: (instance) => layoutStore.getState().upsertRackInstance(instance),
    remove: (id) => layoutStore.getState().removeRackInstance(id),
  };
}

/**
 * footprintOf is caller-supplied, matching every other geometry-touching
 * file in this package: a Rack Instance's true size depends on its
 * Template and resolved configuration depth, which this file has no
 * business resolving itself.
 */
export function mirrorSelection(
  layoutStore: StoreApi<LayoutStore>,
  historyStore: StoreApi<HistoryStore>,
  instances: readonly RackInstance[],
  axis: MirrorAxis,
  footprintOf: (instance: RackInstance) => RackFootprintSize,
): readonly RackInstance[] {
  if (instances.length === 0) return [];

  const layoutId = layoutStore.getState().layoutId;
  if (layoutId === null) {
    throw new Error("Cannot mirror: no Layout is currently loaded.");
  }

  const now = nowIsoTimestamp();
  const mirrored: RackInstance[] = instances.map((instance) => ({
    ...instance,
    id: generateId(),
    ...mirrorTransform(instance, axis, footprintOf(instance)),
    createdAt: now,
    updatedAt: now,
  }));

  const ops = rackInstanceOps(layoutStore);
  const commands = mirrored.map((instance) => createUpsertCommand(ops, instance));
  commitCommand(historyStore, createBatchCommand(commands));

  return mirrored;
}
