import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  createIndexedDbRepository,
  generateId,
  LayoutRepository,
  nowIsoTimestamp,
  RackAppDatabase,
  type Layout,
  type RackInstance,
} from "@rack-app/data";
import { fromInches } from "@rack-app/rules-engine";
import { createHistoryStore, type Command } from "../historyStore.js";
import { createLayoutStore } from "../layoutStore.js";
import { createAutosaveManager, detectRecoverableSave, type AutosaveRepositories } from "../autosaveManager.js";

function makeRackInstance(layoutId: string): RackInstance {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    layoutId: layoutId as never,
    templateId: generateId(),
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

function dummyCommand(id: string): Command {
  return { id, execute: () => {}, invert: () => {} };
}

function makeRepositories(db: RackAppDatabase): AutosaveRepositories {
  return {
    layouts: new LayoutRepository(createIndexedDbRepository(db.layouts as never)),
    rackInstances: createIndexedDbRepository<RackInstance>(db.rackInstances as never),
    warehouseElements: createIndexedDbRepository(db.warehouseElements as never),
    pathLanes: createIndexedDbRepository(db.pathLanes as never),
    groupLayers: createIndexedDbRepository(db.groupLayers as never),
    zones: createIndexedDbRepository(db.zones as never),
    blockStackZones: createIndexedDbRepository(db.blockStackZones as never),
  };
}

describe("autosaveManager.ts — Spec §6.3.5", () => {
  it("flushNow() reconciles layoutStore's current entities into the repository layer", async () => {
    const db = new RackAppDatabase(`test-${generateId()}`);
    const repositories = makeRepositories(db);
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();

    const layoutId = generateId();
    const now = nowIsoTimestamp();
    const layout: Layout = {
      id: layoutId as never,
      projectId: generateId(),
      name: "Current State",
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    await repositories.layouts.save(layout);

    layoutStore.getState().loadLayout(layoutId, {});
    const instance = makeRackInstance(layoutId);
    layoutStore.getState().upsertRackInstance(instance);

    const manager = createAutosaveManager(historyStore, layoutStore, repositories, 5000);
    const result = await manager.flushNow();
    expect(result.kind).toBe("ok");

    const saved = await repositories.rackInstances.list();
    if (saved.kind !== "ok") throw new Error("unreachable");
    expect(saved.value.map((entity) => entity.id)).toEqual([instance.id]);

    manager.dispose();
    db.close();
  });

  it("removes a rack instance from storage once it's removed from layoutStore — reconcile deletes stale records", async () => {
    const db = new RackAppDatabase(`test-${generateId()}`);
    const repositories = makeRepositories(db);
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();

    const layoutId = generateId();
    layoutStore.getState().loadLayout(layoutId, {});
    const instance = makeRackInstance(layoutId);
    layoutStore.getState().upsertRackInstance(instance);

    const manager = createAutosaveManager(historyStore, layoutStore, repositories, 5000);
    await manager.flushNow();

    layoutStore.getState().removeRackInstance(instance.id);
    await manager.flushNow();

    const saved = await repositories.rackInstances.list();
    if (saved.kind !== "ok") throw new Error("unreachable");
    expect(saved.value).toEqual([]);

    manager.dispose();
    db.close();
  });

  it("debounces: rapid commits collapse into a single flush pass, not one flush per commit", async () => {
    const db = new RackAppDatabase(`test-${generateId()}`);
    const repositories = makeRepositories(db);
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();

    const layoutId = generateId();
    layoutStore.getState().loadLayout(layoutId, {});

    let saveCount = 0;
    const countingRackInstances: AutosaveRepositories["rackInstances"] = {
      ...repositories.rackInstances,
      save: (entity) => {
        saveCount += 1;
        return repositories.rackInstances.save(entity);
      },
    };

    const manager = createAutosaveManager(
      historyStore,
      layoutStore,
      { ...repositories, rackInstances: countingRackInstances },
      30,
    );

    layoutStore.getState().upsertRackInstance(makeRackInstance(layoutId));
    historyStore.getState().push(dummyCommand("a"));
    layoutStore.getState().upsertRackInstance(makeRackInstance(layoutId));
    historyStore.getState().push(dummyCommand("b"));
    layoutStore.getState().upsertRackInstance(makeRackInstance(layoutId));
    historyStore.getState().push(dummyCommand("c"));

    await new Promise((resolve) => setTimeout(resolve, 100));

    // If each commit had triggered its own immediate flush (no debounce), the growing rack
    // instance count would have produced 1 + 2 + 3 = 6 save() calls. One collapsed flush
    // reconciling all 3 current instances produces exactly 3.
    expect(saveCount).toBe(3);

    manager.dispose();
    db.close();
  });

  it("never mutates historyStore's stacks — only reads them via subscribe()", async () => {
    const db = new RackAppDatabase(`test-${generateId()}`);
    const repositories = makeRepositories(db);
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    layoutStore.getState().loadLayout(generateId(), {});

    const manager = createAutosaveManager(historyStore, layoutStore, repositories, 10);
    historyStore.getState().push(dummyCommand("a"));
    expect(historyStore.getState().past).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // The command pushed by the test is still there — autosave never cleared/truncated it.
    expect(historyStore.getState().past).toHaveLength(1);
    expect(historyStore.getState().past[0]?.id).toBe("a");

    manager.dispose();
    db.close();
  });
});

describe("detectRecoverableSave — Spec §6.3.5: offers, never forces, recovery", () => {
  it("returns true when the persisted layout is newer than the session's last known state", () => {
    const older = new Date(Date.now() - 60_000).toISOString();
    const newer = new Date().toISOString();
    const layout = { updatedAt: newer } as Layout;
    expect(detectRecoverableSave(layout, older)).toBe(true);
  });

  it("returns false when the session's last known state is already current", () => {
    const now = new Date().toISOString();
    const layout = { updatedAt: now } as Layout;
    expect(detectRecoverableSave(layout, now)).toBe(false);
  });
});
