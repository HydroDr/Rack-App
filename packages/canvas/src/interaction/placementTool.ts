/**
 * Drag-and-drop and typed/exact-dimension placement of a Template onto
 * the canvas (Spec §6.3.4). Creates a new Rack Instance, routed through
 * commandStack so the placement is undo-able (Engineering File Plan §5.2).
 */

import type { StoreApi } from "zustand/vanilla";
import type { ConfigurationType, Length } from "@rack-app/rules-engine";
import {
  CURRENT_SCHEMA_VERSION,
  generateId,
  nowIsoTimestamp,
  type ComponentColorMap,
  type EntityId,
  type HistoryStore,
  type LayoutStore,
  type RackInstance,
} from "@rack-app/state";
import { commitCommand, createUpsertCommand, type EntityCommandOps } from "./commandStack.js";

export interface PlacementInput {
  readonly templateId: EntityId;
  readonly positionXIn: Length;
  readonly positionYIn: Length;
  readonly rotationDeg: number;
  readonly bays: number;
  readonly configurationType: ConfigurationType;
  readonly rackColumns: number;
  readonly componentColorOverrides?: ComponentColorMap;
}

function rackInstanceOps(layoutStore: StoreApi<LayoutStore>): EntityCommandOps<RackInstance> {
  return {
    upsert: (instance) => layoutStore.getState().upsertRackInstance(instance),
    remove: (id) => layoutStore.getState().removeRackInstance(id),
  };
}

/**
 * Places a Template as a new Rack Instance on the currently loaded Layout.
 * Throws if no Layout is loaded — that's a caller-sequencing bug (the UI
 * must never offer placement without an open Layout), not a recoverable
 * domain-rule warning.
 */
export function placeTemplate(layoutStore: StoreApi<LayoutStore>, historyStore: StoreApi<HistoryStore>, input: PlacementInput): RackInstance {
  const layoutId = layoutStore.getState().layoutId;
  if (layoutId === null) {
    throw new Error("Cannot place a template: no Layout is currently loaded.");
  }

  const now = nowIsoTimestamp();
  const instance: RackInstance = {
    id: generateId(),
    layoutId,
    templateId: input.templateId,
    positionXIn: input.positionXIn,
    positionYIn: input.positionYIn,
    rotationDeg: input.rotationDeg,
    bays: input.bays,
    configurationType: input.configurationType,
    rackColumns: input.rackColumns,
    anchoredOrBracedException: false,
    ...(input.componentColorOverrides !== undefined ? { componentColorOverrides: input.componentColorOverrides } : {}),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };

  commitCommand(historyStore, createUpsertCommand(rackInstanceOps(layoutStore), instance));
  return instance;
}
