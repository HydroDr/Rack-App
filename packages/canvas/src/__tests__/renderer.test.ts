import { describe, expect, it, vi } from "vitest";
import { Container, Text } from "pixi.js";
import { fromInches } from "@rack-app/rules-engine";
import type { PathLane, RackInstance, RackTemplate, WarehouseElement } from "@rack-app/state";
import { renderGrid, renderGridLabels } from "../renderer/gridRenderer.js";
import { renderWarehouseElement, renderWarehouseElements } from "../renderer/warehouseElementRenderer.js";
import { renderPathLane } from "../renderer/pathRenderer.js";
import { renderRackInstance, renderRackInstances, type RackRenderInput } from "../renderer/rackRenderer.js";
import { renderScene } from "../renderer/sceneRenderer.js";
import { createThumbnailRenderer } from "../renderer/thumbnailRenderer.js";

const now = "2024-01-01T00:00:00.000Z";

function makeTemplate(): RackTemplate {
  return {
    id: "template-1" as never,
    templateType: "rack",
    name: "Selective Rack",
    componentColors: {},
    palletProfileId: "pallet-1" as never,
    palletLevels: 3,
    palletHeightIn: fromInches(52),
    clearanceIn: fromInches(4),
    frameDepthIn: fromInches(42),
    beamLengthIn: fromInches(96),
    levelCapacitiesLb: [2000, 2000, 2000] as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

function makeInstance(bays: number): RackInstance {
  return {
    id: "instance-1" as never,
    layoutId: "layout-1" as never,
    templateId: "template-1" as never,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays,
    configurationType: "single",
    rackColumns: 1,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

describe("renderer/gridRenderer.ts", () => {
  it("returns an empty Graphics for a zero/negative interval, guarding an infinite loop", () => {
    const graphics = renderGrid({ widthIn: fromInches(100), heightIn: fromInches(100), intervalIn: fromInches(0), color: "#cccccc" });
    expect(graphics).toBeDefined();
  });

  it("draws without throwing for a normal grid", () => {
    expect(() => renderGrid({ widthIn: fromInches(1200), heightIn: fromInches(600), intervalIn: fromInches(12), color: "#cccccc" })).not.toThrow();
  });

  it("renderGridLabels returns an empty Container for a zero/negative interval", () => {
    const container = renderGridLabels({ widthIn: fromInches(100), heightIn: fromInches(100), intervalIn: fromInches(0), color: "#cccccc", labelColor: "#6b7280" });
    expect(container.children).toHaveLength(0);
  });

  it("renderGridLabels places one column letter per interval along the top and one row number per interval along the left", () => {
    // 3 columns (0, 12, 24) and 2 rows (0, 12) at a 12in interval over a 24x12 grid.
    const container = renderGridLabels({ widthIn: fromInches(24), heightIn: fromInches(12), intervalIn: fromInches(12), color: "#cccccc", labelColor: "#6b7280" });
    const texts = container.children.map((child) => (child as Text).text);
    expect(texts).toEqual(["A", "B", "C", "1", "2"]);
  });
});

describe("renderer/warehouseElementRenderer.ts", () => {
  it("renders one Graphics per element", () => {
    const elements: WarehouseElement[] = [
      { id: "w1" as never, layoutId: "l1" as never, elementType: "wall", positionXIn: fromInches(0), positionYIn: fromInches(0), widthIn: fromInches(100), depthIn: fromInches(6), rotationDeg: 0, createdAt: now, updatedAt: now, schemaVersion: 1 },
      { id: "w2" as never, layoutId: "l1" as never, elementType: "dockDoor", positionXIn: fromInches(200), positionYIn: fromInches(0), widthIn: fromInches(108), depthIn: fromInches(6), rotationDeg: 0, createdAt: now, updatedAt: now, schemaVersion: 1 },
    ];
    const container = renderWarehouseElements(elements);
    expect(container.children).toHaveLength(2);
  });

  it("positions a single element's center at position + half its footprint (rotate-around-center convention)", () => {
    const element: WarehouseElement = { id: "w1" as never, layoutId: "l1" as never, elementType: "buildingColumn", positionXIn: fromInches(10), positionYIn: fromInches(10), widthIn: fromInches(12), depthIn: fromInches(12), rotationDeg: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
    const graphics = renderWarehouseElement(element);
    expect(graphics.position.x).toBeCloseTo(16, 5);
    expect(graphics.position.y).toBeCloseTo(16, 5);
  });
});

describe("renderer/pathRenderer.ts", () => {
  it("renders a lane with a stroke graphics and a marker graphics as two children", () => {
    const lane: PathLane = {
      id: "p1" as never,
      layoutId: "l1" as never,
      laneType: "foot",
      widthIn: fromInches(36),
      segments: [
        { xIn: fromInches(0), yIn: fromInches(0) },
        { xIn: fromInches(120), yIn: fromInches(0) },
      ],
      markerIntervalIn: fromInches(60),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    const container = renderPathLane(lane);
    expect(container.children).toHaveLength(2);
  });
});

describe("renderer/rackRenderer.ts — single efficient object regardless of bay count", () => {
  it("always produces a Container with exactly one Graphics child, for 1 bay or 200 bays", () => {
    const template = makeTemplate();
    for (const bays of [1, 200]) {
      const container = renderRackInstance({ instance: makeInstance(bays), template, ratioDepthIn: fromInches(42) });
      expect(container.children).toHaveLength(1);
      expect(container.children[0]).toBeDefined();
    }
  });

  it("renderRackInstances produces one child container per instance", () => {
    const template = makeTemplate();
    const inputs: RackRenderInput[] = [
      { instance: makeInstance(3), template, ratioDepthIn: fromInches(42) },
      { instance: { ...makeInstance(3), id: "instance-2" as never }, template, ratioDepthIn: fromInches(42) },
    ];
    const container = renderRackInstances(inputs);
    expect(container.children).toHaveLength(2);
  });
});

describe("renderer/sceneRenderer.ts", () => {
  it("assembles grid, warehouse, rack, and path layers in bottom-to-top order", () => {
    const scene = renderScene({
      grid: { widthIn: fromInches(1200), heightIn: fromInches(600), intervalIn: fromInches(12), color: "#cccccc", labelColor: "#6b7280" },
      warehouseElements: [],
      rackInstances: [],
      pathLanes: [],
    });

    expect(scene.root.children).toEqual([scene.gridLayer, scene.warehouseElementLayer, scene.rackInstanceLayer, scene.pathLaneLayer]);
    expect(scene.root).toBeInstanceOf(Container);
  });
});

describe("renderer/thumbnailRenderer.ts — debounced regeneration", () => {
  it("collapses rapid regeneration requests into a single generate() call", async () => {
    const generate = vi.fn().mockResolvedValue("data:image/png;base64,fake");
    const renderer = createThumbnailRenderer(generate, { debounceMs: 20 });

    renderer.requestRegeneration();
    renderer.requestRegeneration();
    renderer.requestRegeneration();

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(generate).toHaveBeenCalledTimes(1);
    expect(renderer.getLastThumbnail()).toBe("data:image/png;base64,fake");

    renderer.dispose();
  });
});
