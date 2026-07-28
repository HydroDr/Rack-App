import { describe, expect, it } from "vitest";
import { fromInches, toInches } from "@rack-app/rules-engine";
import { createHistoryStore, createLayoutStore, type RackInstance } from "@rack-app/state";
import type { Bounds } from "../geometry/bounds.js";
import { selectAtPoint, selectInMarquee } from "../interaction/selectionTool.js";
import { placeTemplate } from "../interaction/placementTool.js";
import { applyArrayRepeat, MAX_REPEAT_COUNT } from "../interaction/arrayRepeatTool.js";
import { mirrorSelection } from "../interaction/mirrorTool.js";
import { createPathLaneTool } from "../interaction/pathLaneTool.js";

function makeInstance(overrides: Partial<RackInstance> = {}): RackInstance {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: "instance-1" as never,
    layoutId: "layout-1" as never,
    templateId: "template-1" as never,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays: 5,
    configurationType: "single",
    rackColumns: 1,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...overrides,
  };
}

// A fixed 10x10 bounds at the instance's position, for tests that don't care about real template geometry.
function fixedBoundsOf(instance: RackInstance): Bounds {
  const x = instance.positionXIn;
  const y = instance.positionYIn;
  return { minXIn: x, minYIn: y, maxXIn: fromInches(toInches(x) + 10), maxYIn: fromInches(toInches(y) + 10) };
}

describe("interaction/selectionTool.ts", () => {
  it("selectAtPoint selects the instance under the click, or clears selection if none hit", () => {
    const layoutStore = createLayoutStore();
    const instance = makeInstance({ id: "a" as never, positionXIn: fromInches(0), positionYIn: fromInches(0) });
    layoutStore.getState().loadLayout("layout-1" as never, { rackInstances: new Map([[instance.id, instance]]) });

    selectAtPoint({ layoutStore, boundsOf: fixedBoundsOf }, { xIn: fromInches(5), yIn: fromInches(5) });
    expect(layoutStore.getState().selectedIds.has(instance.id)).toBe(true);

    selectAtPoint({ layoutStore, boundsOf: fixedBoundsOf }, { xIn: fromInches(500), yIn: fromInches(500) });
    expect(layoutStore.getState().selectedIds.size).toBe(0);
  });

  it("selectInMarquee selects every instance whose bounds intersect the dragged box", () => {
    const layoutStore = createLayoutStore();
    const inside = makeInstance({ id: "inside" as never, positionXIn: fromInches(5), positionYIn: fromInches(5) });
    const outside = makeInstance({ id: "outside" as never, positionXIn: fromInches(500), positionYIn: fromInches(500) });
    layoutStore.getState().loadLayout("layout-1" as never, {
      rackInstances: new Map([
        [inside.id, inside],
        [outside.id, outside],
      ]),
    });

    selectInMarquee({ layoutStore, boundsOf: fixedBoundsOf }, { xIn: fromInches(0), yIn: fromInches(0) }, { xIn: fromInches(20), yIn: fromInches(20) });
    expect(layoutStore.getState().selectedIds).toEqual(new Set([inside.id]));
  });
});

describe("interaction/placementTool.ts", () => {
  it("places a new Rack Instance and records it as one undo-able Command", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    layoutStore.getState().loadLayout("layout-1" as never, {});

    const instance = placeTemplate(layoutStore, historyStore, {
      templateId: "template-1" as never,
      positionXIn: fromInches(0),
      positionYIn: fromInches(0),
      rotationDeg: 0,
      bays: 5,
      configurationType: "single",
      rackColumns: 1,
    });

    expect(layoutStore.getState().rackInstances.get(instance.id)).toEqual(instance);
    expect(historyStore.getState().past).toHaveLength(1);

    historyStore.getState().undo();
    expect(layoutStore.getState().rackInstances.has(instance.id)).toBe(false);
  });

  it("throws when no Layout is loaded, rather than silently placing into nowhere", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    expect(() =>
      placeTemplate(layoutStore, historyStore, {
        templateId: "template-1" as never,
        positionXIn: fromInches(0),
        positionYIn: fromInches(0),
        rotationDeg: 0,
        bays: 5,
        configurationType: "single",
        rackColumns: 1,
      }),
    ).toThrow();
  });
});

describe("interaction/arrayRepeatTool.ts — Spec §6.3.1b, guards a pathological repeat count", () => {
  it("applies the requested bay count when it's reasonable", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    const instance = makeInstance({ bays: 1 });
    layoutStore.getState().loadLayout("layout-1" as never, { rackInstances: new Map([[instance.id, instance]]) });

    const result = applyArrayRepeat(layoutStore, historyStore, { baseInstance: instance, requestedBayCount: 12 });
    expect(result.clamped).toBe(false);
    expect(result.instance.bays).toBe(12);
    expect(layoutStore.getState().rackInstances.get(instance.id)?.bays).toBe(12);
  });

  it("clamps a pathological repeat count (e.g. a typo of 100,000) to MAX_REPEAT_COUNT and warns", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    const instance = makeInstance({ bays: 1 });
    layoutStore.getState().loadLayout("layout-1" as never, { rackInstances: new Map([[instance.id, instance]]) });

    const result = applyArrayRepeat(layoutStore, historyStore, { baseInstance: instance, requestedBayCount: 100_000 });
    expect(result.clamped).toBe(true);
    expect(result.instance.bays).toBe(MAX_REPEAT_COUNT);
    expect(result.warning).toBeDefined();
  });

  it("undo restores the original bay count", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    const instance = makeInstance({ bays: 1 });
    layoutStore.getState().loadLayout("layout-1" as never, { rackInstances: new Map([[instance.id, instance]]) });

    applyArrayRepeat(layoutStore, historyStore, { baseInstance: instance, requestedBayCount: 20 });
    historyStore.getState().undo();
    expect(layoutStore.getState().rackInstances.get(instance.id)?.bays).toBe(1);
  });
});

describe("interaction/mirrorTool.ts — Spec §6.3.1c", () => {
  const footprintOf = () => ({ widthIn: fromInches(96), depthIn: fromInches(42) });

  it("mirrors across a vertical axis, creating a new instance without touching the original", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    const instance = makeInstance({ positionXIn: fromInches(0), positionYIn: fromInches(0), rotationDeg: 0 });
    layoutStore.getState().loadLayout("layout-1" as never, { rackInstances: new Map([[instance.id, instance]]) });

    const [mirrored] = mirrorSelection(layoutStore, historyStore, [instance], { kind: "vertical", xIn: fromInches(200) }, footprintOf);

    expect(mirrored).toBeDefined();
    expect(mirrored!.id).not.toBe(instance.id);
    expect(layoutStore.getState().rackInstances.has(instance.id)).toBe(true);
    expect(layoutStore.getState().rackInstances.has(mirrored!.id)).toBe(true);
    // Original center is at x=48 (0 + 96/2); mirrored across x=200 -> new center at 352 -> new position at 352-48=304.
    expect(toInches(mirrored!.positionXIn)).toBeCloseTo(304, 1);
    expect(mirrored!.rotationDeg).toBeCloseTo(180, 5);
  });

  it("undo removes every mirrored copy in one step", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    const a = makeInstance({ id: "a" as never });
    const b = makeInstance({ id: "b" as never, positionXIn: fromInches(200) });
    layoutStore.getState().loadLayout("layout-1" as never, {
      rackInstances: new Map([
        [a.id, a],
        [b.id, b],
      ]),
    });

    mirrorSelection(layoutStore, historyStore, [a, b], { kind: "horizontal", yIn: fromInches(100) }, footprintOf);
    expect(layoutStore.getState().rackInstances.size).toBe(4);
    expect(historyStore.getState().past).toHaveLength(1);

    historyStore.getState().undo();
    expect(layoutStore.getState().rackInstances.size).toBe(2);
  });
});

describe("interaction/pathLaneTool.ts — Spec §6.3.1d", () => {
  it("constrains each new point to the nearest common-angle increment from the previous point", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    layoutStore.getState().loadLayout("layout-1" as never, {});

    const tool = createPathLaneTool(layoutStore, historyStore, {
      laneType: "foot",
      widthIn: fromInches(36),
      markerIntervalIn: fromInches(60),
      angleSnapDegrees: 45,
    });

    tool.addPoint({ xIn: fromInches(0), yIn: fromInches(0) });
    // Nearly horizontal (slight y drift) should snap to exactly horizontal (0 degrees).
    tool.addPoint({ xIn: fromInches(100), yIn: fromInches(3) });

    const segments = tool.getCurrentSegments();
    expect(segments).toHaveLength(2);
    expect(toInches(segments[1]!.yIn)).toBeCloseTo(0, 5);
  });

  it("finish() returns null and commits nothing with fewer than 2 points", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    layoutStore.getState().loadLayout("layout-1" as never, {});

    const tool = createPathLaneTool(layoutStore, historyStore, { laneType: "forklift", widthIn: fromInches(144), markerIntervalIn: fromInches(120) });
    tool.addPoint({ xIn: fromInches(0), yIn: fromInches(0) });

    expect(tool.finish()).toBeNull();
    expect(historyStore.getState().past).toHaveLength(0);
  });

  it("finish() commits the lane as one undo-able Command and resets the builder", () => {
    const layoutStore = createLayoutStore();
    const historyStore = createHistoryStore();
    layoutStore.getState().loadLayout("layout-1" as never, {});

    const tool = createPathLaneTool(layoutStore, historyStore, { laneType: "forklift", widthIn: fromInches(144), markerIntervalIn: fromInches(120) });
    tool.addPoint({ xIn: fromInches(0), yIn: fromInches(0) });
    tool.addPoint({ xIn: fromInches(200), yIn: fromInches(0) });

    const lane = tool.finish();
    expect(lane).not.toBeNull();
    expect(layoutStore.getState().pathLanes.has(lane!.id)).toBe(true);
    expect(historyStore.getState().past).toHaveLength(1);
    expect(tool.getCurrentSegments()).toHaveLength(0);

    historyStore.getState().undo();
    expect(layoutStore.getState().pathLanes.has(lane!.id)).toBe(false);
  });
});
