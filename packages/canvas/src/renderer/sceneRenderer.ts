/**
 * Sets up and owns the top-level PixiJS scene graph for the active
 * Layout (Engineering File Plan §5.1). A pure assembly function: every
 * input is already resolved (rack instances paired with their Template
 * and computed depth, per rackRenderer.ts) — sceneRenderer.ts does not
 * itself call into rules-engine or fetch Templates, keeping "resolve the
 * business data" and "assemble the scene graph" separate concerns.
 */

import { Container } from "pixi.js";
import type { PathLane, WarehouseElement } from "@rack-app/state";
import { renderGrid, type GridRenderOptions } from "./gridRenderer.js";
import { renderWarehouseElements } from "./warehouseElementRenderer.js";
import { renderRackInstances, type RackRenderInput } from "./rackRenderer.js";
import { renderPathLanes } from "./pathRenderer.js";

export interface SceneInput {
  readonly grid: GridRenderOptions;
  readonly warehouseElements: readonly WarehouseElement[];
  readonly rackInstances: readonly RackRenderInput[];
  readonly pathLanes: readonly PathLane[];
}

export interface Scene {
  readonly root: Container;
  readonly gridLayer: Container;
  readonly warehouseElementLayer: Container;
  readonly rackInstanceLayer: Container;
  readonly pathLaneLayer: Container;
}

/** Bottom-to-top draw order: grid, then warehouse structure, then racks, then paths (paths stay visible on top). */
export function renderScene(input: SceneInput): Scene {
  const root = new Container();

  const gridLayer = new Container();
  gridLayer.addChild(renderGrid(input.grid));

  const warehouseElementLayer = renderWarehouseElements(input.warehouseElements);
  const rackInstanceLayer = renderRackInstances(input.rackInstances);
  const pathLaneLayer = renderPathLanes(input.pathLanes);

  root.addChild(gridLayer, warehouseElementLayer, rackInstanceLayer, pathLaneLayer);

  return { root, gridLayer, warehouseElementLayer, rackInstanceLayer, pathLaneLayer };
}
