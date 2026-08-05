/**
 * Subscribes to every committed Command (via historyStore) and triggers a
 * debounced save through the repository layer, plus exposes the current
 * save-status (Saved/Saving) for the UI indicator (Spec §6.3.5).
 *
 * Debounce, don't save on every individual keystroke — batch rapid edits
 * into one write. Must never clear or truncate historyStore's undo stack —
 * saving a snapshot and limiting undo are unrelated concerns (this file
 * only ever reads historyStore via subscribe(), never calls its actions).
 * On load, compares the most recent auto-saved state against the last
 * clean save and offers — never silently forces — recovery; the undo
 * stack itself starts empty after any reload, by design (Engineering File
 * Plan §4).
 */

import type { StoreApi } from "zustand/vanilla";
import {
  type BlockStackZone,
  type EntityId,
  type GroupLayer,
  type IsoTimestamp,
  type Layout,
  type LayoutRepository,
  type PathLane,
  type ProtectorPlacement,
  type RackInstance,
  type Repository,
  type WarehouseElement,
  type Zone,
} from "@rack-app/data";
import { ok, type Result } from "@rack-app/rules-engine";
import type { HistoryStore } from "./historyStore.js";
import {
  selectBlockStackZones,
  selectGroupLayers,
  selectPathLanes,
  selectProtectorPlacements,
  selectRackInstances,
  selectWarehouseElements,
  selectZones,
  type LayoutStore,
} from "./layoutStore.js";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveRepositories {
  readonly layouts: LayoutRepository;
  readonly rackInstances: Repository<RackInstance>;
  readonly warehouseElements: Repository<WarehouseElement>;
  readonly pathLanes: Repository<PathLane>;
  readonly groupLayers: Repository<GroupLayer>;
  readonly zones: Repository<Zone>;
  readonly blockStackZones: Repository<BlockStackZone>;
  readonly protectorPlacements: Repository<ProtectorPlacement>;
}

export interface AutosaveManager {
  getStatus(): SaveStatus;
  /** Forces an immediate flush, bypassing the debounce window (e.g. before navigating away). */
  flushNow(): Promise<Result<void>>;
  /** Unsubscribes from historyStore and cancels any pending debounced save. */
  dispose(): void;
}

const DEFAULT_DEBOUNCE_MS = 1500;

/** Entities scoped to a layout must all carry these two fields for the reconcile-save below to work generically. */
interface LayoutScopedEntity {
  readonly id: EntityId;
  readonly layoutId: EntityId;
}

async function reconcileLayoutScopedRepository<T extends LayoutScopedEntity>(
  repository: Repository<T>,
  layoutId: EntityId,
  desired: readonly T[],
): Promise<Result<void>> {
  const existingResult = await repository.list();
  if (existingResult.kind === "error") return existingResult;

  const desiredIds = new Set(desired.map((entity) => entity.id));
  const staleForThisLayout = existingResult.value.filter(
    (entity) => entity.layoutId === layoutId && !desiredIds.has(entity.id),
  );

  for (const stale of staleForThisLayout) {
    const deleteResult = await repository.delete(stale.id);
    if (deleteResult.kind === "error") return deleteResult;
  }

  for (const entity of desired) {
    const saveResult = await repository.save(entity);
    if (saveResult.kind === "error") return saveResult;
  }

  return ok(undefined);
}

export function createAutosaveManager(
  historyStore: StoreApi<HistoryStore>,
  layoutStore: StoreApi<LayoutStore>,
  repositories: AutosaveRepositories,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): AutosaveManager {
  let status: SaveStatus = "idle";
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  async function flush(): Promise<Result<void>> {
    const layoutState = layoutStore.getState();
    if (layoutState.layoutId === null) {
      status = "idle";
      return ok(undefined);
    }
    const layoutId = layoutState.layoutId;

    status = "saving";

    const results = await Promise.all([
      reconcileLayoutScopedRepository(repositories.rackInstances, layoutId, selectRackInstances(layoutState)),
      reconcileLayoutScopedRepository(repositories.warehouseElements, layoutId, selectWarehouseElements(layoutState)),
      reconcileLayoutScopedRepository(repositories.pathLanes, layoutId, selectPathLanes(layoutState)),
      reconcileLayoutScopedRepository(repositories.groupLayers, layoutId, selectGroupLayers(layoutState)),
      reconcileLayoutScopedRepository(repositories.zones, layoutId, selectZones(layoutState)),
      reconcileLayoutScopedRepository(repositories.blockStackZones, layoutId, selectBlockStackZones(layoutState)),
      reconcileLayoutScopedRepository(repositories.protectorPlacements, layoutId, selectProtectorPlacements(layoutState)),
    ]);

    const firstError = results.find((result) => result.kind === "error");
    if (firstError !== undefined) {
      status = "error";
      return firstError;
    }

    const layoutResult = await repositories.layouts.get(layoutId);
    if (layoutResult.kind === "error") {
      status = "error";
      return layoutResult;
    }
    if (layoutResult.value !== undefined) {
      const touched: Layout = { ...layoutResult.value, updatedAt: new Date().toISOString() };
      const saveResult = await repositories.layouts.save(touched);
      if (saveResult.kind === "error") {
        status = "error";
        return saveResult;
      }
    }

    status = "saved";
    return ok(undefined);
  }

  function scheduleSave(): void {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      timeoutHandle = undefined;
      void flush();
    }, debounceMs);
  }

  // Reads historyStore only — every committed Command (a new push onto the
  // past stack) schedules a debounced save. Never calls undo/redo/clear.
  const unsubscribe = historyStore.subscribe((state, prevState) => {
    if (state.past !== prevState.past) {
      scheduleSave();
    }
  });

  return {
    getStatus: () => status,
    flushNow: () => {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
      return flush();
    },
    dispose: () => {
      unsubscribe();
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    },
  };
}

/**
 * Recovery detection for the "on load" check (Spec §6.3.5): compares the
 * persisted Layout's updatedAt against the timestamp the current session
 * last cleanly loaded. Returns a signal only — the caller (a future UI
 * layer) decides whether to prompt the designer; this never auto-restores.
 */
export function detectRecoverableSave(persistedLayout: Layout, sessionLastKnownUpdatedAt: IsoTimestamp): boolean {
  return Date.parse(persistedLayout.updatedAt) > Date.parse(sessionLastKnownUpdatedAt);
}
