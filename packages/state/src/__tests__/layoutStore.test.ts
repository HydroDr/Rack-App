import { describe, expect, it } from "vitest";
import { fromInches } from "@rack-app/rules-engine";
import { generateId, nowIsoTimestamp, CURRENT_SCHEMA_VERSION, type RackInstance } from "@rack-app/data";
import { createLayoutStore, selectRackInstances } from "../layoutStore.js";

function makeRackInstance(layoutId: string, templateId = generateId()): RackInstance {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    layoutId: layoutId as never,
    templateId,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays: 5,
    configurationType: "backToBack",
    rackColumns: 2,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

describe("layoutStore.ts — Spec §6.3: single source of truth the canvas renders from", () => {
  it("loadLayout replaces the working set and resets selection", () => {
    const store = createLayoutStore();
    const layoutId = generateId();
    const instance = makeRackInstance(layoutId);

    store.getState().loadLayout(layoutId, { rackInstances: new Map([[instance.id, instance]]) });

    expect(store.getState().layoutId).toBe(layoutId);
    expect(selectRackInstances(store.getState())).toEqual([instance]);
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("upsertRackInstance and removeRackInstance mutate the same Map the selectors read from — no separate copy", () => {
    const store = createLayoutStore();
    const layoutId = generateId();
    store.getState().loadLayout(layoutId, {});

    const instance = makeRackInstance(layoutId);
    store.getState().upsertRackInstance(instance);
    expect(selectRackInstances(store.getState())).toEqual([instance]);

    const updated = { ...instance, bays: 8 };
    store.getState().upsertRackInstance(updated);
    expect(selectRackInstances(store.getState())).toEqual([updated]);

    store.getState().removeRackInstance(instance.id);
    expect(selectRackInstances(store.getState())).toEqual([]);
  });

  it("toggleSelection adds and removes ids from the selection set", () => {
    const store = createLayoutStore();
    const id = generateId();
    store.getState().toggleSelection(id);
    expect(store.getState().selectedIds.has(id)).toBe(true);
    store.getState().toggleSelection(id);
    expect(store.getState().selectedIds.has(id)).toBe(false);
  });

  it("unloadLayout clears everything back to the no-layout state", () => {
    const store = createLayoutStore();
    const layoutId = generateId();
    store.getState().loadLayout(layoutId, { rackInstances: new Map([[generateId(), makeRackInstance(layoutId)]]) });
    store.getState().unloadLayout();

    expect(store.getState().layoutId).toBeNull();
    expect(selectRackInstances(store.getState())).toEqual([]);
  });
});
