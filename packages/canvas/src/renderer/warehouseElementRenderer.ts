/**
 * Draws walls, building columns, docks, and doors (Spec §2.6, §6.3.4;
 * Engineering File Plan §5.1).
 */

import { Container, Graphics } from "pixi.js";
import { toInches } from "@rack-app/rules-engine";
import type { WarehouseElement } from "@rack-app/state";

const ELEMENT_COLORS: Record<WarehouseElement["elementType"], number> = {
  wall: 0x444444,
  buildingColumn: 0x888888,
  dockDoor: 0x4477aa,
  door: 0x66aa66,
};

/** Rotates around the rect's center, matching geometry/bounds.ts's convention. */
export function renderWarehouseElement(element: WarehouseElement): Graphics {
  const graphics = new Graphics();
  const widthIn = toInches(element.widthIn);
  const depthIn = toInches(element.depthIn);

  graphics.rect(0, 0, widthIn, depthIn).fill({ color: ELEMENT_COLORS[element.elementType] });
  graphics.pivot.set(widthIn / 2, depthIn / 2);
  graphics.position.set(toInches(element.positionXIn) + widthIn / 2, toInches(element.positionYIn) + depthIn / 2);
  graphics.rotation = (element.rotationDeg * Math.PI) / 180;

  return graphics;
}

export function renderWarehouseElements(elements: readonly WarehouseElement[]): Container {
  const container = new Container();
  for (const element of elements) {
    container.addChild(renderWarehouseElement(element));
  }
  return container;
}
