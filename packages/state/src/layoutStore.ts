/**
 * Holds the active Layout's live canvas state: instances, selection,
 * groups, zones, paths (Spec §6.3). This store is the single source of
 * truth the canvas renders from — BOM/Diff/ROI must read from it, never
 * maintain a separate copy that can drift (Engineering File Plan §4).
 * The exported select* functions are the one sanctioned way to read a
 * flat array out of this store's Maps for feeding into rules-engine.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  BlockStackZone,
  EntityId,
  GroupLayer,
  PathLane,
  ProtectorPlacement,
  RackInstance,
  WarehouseElement,
  Zone,
} from "@rack-app/data";

export interface LayoutEntities {
  readonly rackInstances: ReadonlyMap<EntityId, RackInstance>;
  readonly warehouseElements: ReadonlyMap<EntityId, WarehouseElement>;
  readonly pathLanes: ReadonlyMap<EntityId, PathLane>;
  readonly groupLayers: ReadonlyMap<EntityId, GroupLayer>;
  readonly zones: ReadonlyMap<EntityId, Zone>;
  readonly blockStackZones: ReadonlyMap<EntityId, BlockStackZone>;
  readonly protectorPlacements: ReadonlyMap<EntityId, ProtectorPlacement>;
}

export interface LayoutStoreState extends LayoutEntities {
  readonly layoutId: EntityId | null;
  readonly selectedIds: ReadonlySet<EntityId>;
}

function emptyEntities(): LayoutEntities {
  return {
    rackInstances: new Map(),
    warehouseElements: new Map(),
    pathLanes: new Map(),
    groupLayers: new Map(),
    zones: new Map(),
    blockStackZones: new Map(),
    protectorPlacements: new Map(),
  };
}

export interface LayoutStoreActions {
  /** Replaces the entire working set — called when opening a Layout. Resets selection. */
  loadLayout(layoutId: EntityId, entities: Partial<LayoutEntities>): void;
  /** Clears back to an empty, no-layout-loaded state. */
  unloadLayout(): void;

  upsertRackInstance(instance: RackInstance): void;
  removeRackInstance(id: EntityId): void;

  upsertWarehouseElement(element: WarehouseElement): void;
  removeWarehouseElement(id: EntityId): void;

  upsertPathLane(lane: PathLane): void;
  removePathLane(id: EntityId): void;

  upsertGroupLayer(group: GroupLayer): void;
  removeGroupLayer(id: EntityId): void;

  upsertZone(zone: Zone): void;
  removeZone(id: EntityId): void;

  upsertBlockStackZone(zone: BlockStackZone): void;
  removeBlockStackZone(id: EntityId): void;

  upsertProtectorPlacement(placement: ProtectorPlacement): void;
  removeProtectorPlacement(id: EntityId): void;

  setSelection(ids: ReadonlySet<EntityId>): void;
  toggleSelection(id: EntityId): void;
  clearSelection(): void;
}

export type LayoutStore = LayoutStoreState & LayoutStoreActions;

function withUpsert<K, V>(map: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> {
  const next = new Map(map);
  next.set(key, value);
  return next;
}

function withRemoval<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  const next = new Map(map);
  next.delete(key);
  return next;
}

export function createLayoutStore(): StoreApi<LayoutStore> {
  return createStore<LayoutStore>((set) => ({
    layoutId: null,
    selectedIds: new Set(),
    ...emptyEntities(),

    loadLayout: (layoutId, entities) =>
      set({
        layoutId,
        selectedIds: new Set(),
        ...emptyEntities(),
        ...entities,
      }),

    unloadLayout: () =>
      set({
        layoutId: null,
        selectedIds: new Set(),
        ...emptyEntities(),
      }),

    upsertRackInstance: (instance) => set((state) => ({ rackInstances: withUpsert(state.rackInstances, instance.id, instance) })),
    removeRackInstance: (id) => set((state) => ({ rackInstances: withRemoval(state.rackInstances, id) })),

    upsertWarehouseElement: (element) =>
      set((state) => ({ warehouseElements: withUpsert(state.warehouseElements, element.id, element) })),
    removeWarehouseElement: (id) => set((state) => ({ warehouseElements: withRemoval(state.warehouseElements, id) })),

    upsertPathLane: (lane) => set((state) => ({ pathLanes: withUpsert(state.pathLanes, lane.id, lane) })),
    removePathLane: (id) => set((state) => ({ pathLanes: withRemoval(state.pathLanes, id) })),

    upsertGroupLayer: (group) => set((state) => ({ groupLayers: withUpsert(state.groupLayers, group.id, group) })),
    removeGroupLayer: (id) => set((state) => ({ groupLayers: withRemoval(state.groupLayers, id) })),

    upsertZone: (zone) => set((state) => ({ zones: withUpsert(state.zones, zone.id, zone) })),
    removeZone: (id) => set((state) => ({ zones: withRemoval(state.zones, id) })),

    upsertBlockStackZone: (zone) => set((state) => ({ blockStackZones: withUpsert(state.blockStackZones, zone.id, zone) })),
    removeBlockStackZone: (id) => set((state) => ({ blockStackZones: withRemoval(state.blockStackZones, id) })),

    upsertProtectorPlacement: (placement) =>
      set((state) => ({ protectorPlacements: withUpsert(state.protectorPlacements, placement.id, placement) })),
    removeProtectorPlacement: (id) => set((state) => ({ protectorPlacements: withRemoval(state.protectorPlacements, id) })),

    setSelection: (selectedIds) => set({ selectedIds }),

    toggleSelection: (id) =>
      set((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedIds: next };
      }),

    clearSelection: () => set({ selectedIds: new Set() }),
  }));
}

// Selector functions — the sanctioned way to read a flat array out of this store's Maps.
// BOM/Diff/ROI must go through these (or the Maps directly) rather than caching their own copy.

export function selectRackInstances(state: LayoutStoreState): readonly RackInstance[] {
  return Array.from(state.rackInstances.values());
}

export function selectWarehouseElements(state: LayoutStoreState): readonly WarehouseElement[] {
  return Array.from(state.warehouseElements.values());
}

export function selectPathLanes(state: LayoutStoreState): readonly PathLane[] {
  return Array.from(state.pathLanes.values());
}

export function selectGroupLayers(state: LayoutStoreState): readonly GroupLayer[] {
  return Array.from(state.groupLayers.values());
}

export function selectZones(state: LayoutStoreState): readonly Zone[] {
  return Array.from(state.zones.values());
}

export function selectBlockStackZones(state: LayoutStoreState): readonly BlockStackZone[] {
  return Array.from(state.blockStackZones.values());
}

export function selectProtectorPlacements(state: LayoutStoreState): readonly ProtectorPlacement[] {
  return Array.from(state.protectorPlacements.values());
}
