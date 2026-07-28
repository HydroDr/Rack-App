/**
 * Draws one Rack Instance from its resolved geometry and per-component
 * colors (Spec §6.3.2). A repeated row (however many bays) renders as one
 * efficient draw call/object, not N individually tracked sprites — every
 * upright marker for the whole row is drawn into the SAME Graphics
 * instance, and the instance's Container always has exactly one child
 * regardless of bay count (Engineering File Plan §5.1, §9.5).
 *
 * Exact top-down symbology (marker size/shape) is a reasonable placeholder
 * pending visual review once the ui package exists and this can actually
 * be looked at in a browser — nothing here is final art direction.
 */

import { Container, Graphics } from "pixi.js";
import { toInches, type Length } from "@rack-app/rules-engine";
import type { ComponentColorMap, RackInstance, RackTemplate } from "@rack-app/state";

export interface RackRenderInput {
  readonly instance: RackInstance;
  readonly template: RackTemplate;
  /** Resolved via rules-engine's configResolver: single-frame depth, or combined back-to-back/double-deep depth. */
  readonly ratioDepthIn: Length;
}

const DEFAULT_UPRIGHT_COLOR = 0x2255aa;
const DEFAULT_OUTLINE_COLOR = 0xff6600;
const UPRIGHT_MARKER_SIZE_IN = 3;

function colorFor(colors: ComponentColorMap, component: keyof ComponentColorMap, fallback: number): number {
  const hex = colors[component];
  return hex !== undefined ? parseInt(hex.replace("#", ""), 16) : fallback;
}

export function renderRackInstance(input: RackRenderInput): Container {
  const container = new Container();
  const graphics = new Graphics();

  const beamLengthIn = toInches(input.template.beamLengthIn);
  const depthIn = toInches(input.ratioDepthIn);
  const totalWidthIn = input.instance.bays * beamLengthIn;
  const uprightSizeIn = Math.min(UPRIGHT_MARKER_SIZE_IN, beamLengthIn / 4);

  const uprightColor = colorFor(input.template.componentColors, "upright", DEFAULT_UPRIGHT_COLOR);
  const outlineColor = colorFor(input.template.componentColors, "beam", DEFAULT_OUTLINE_COLOR);

  graphics.rect(0, 0, totalWidthIn, depthIn).stroke({ width: 1, color: outlineColor });

  // Uprights = bays + 1 (Spec §3.1), one marker per upright position, all drawn into this same Graphics object.
  for (let uprightIndex = 0; uprightIndex <= input.instance.bays; uprightIndex++) {
    const x = uprightIndex * beamLengthIn - uprightSizeIn / 2;
    graphics.rect(x, -uprightSizeIn / 2, uprightSizeIn, uprightSizeIn).fill({ color: uprightColor });
  }

  container.addChild(graphics);
  container.pivot.set(totalWidthIn / 2, depthIn / 2);
  container.position.set(toInches(input.instance.positionXIn) + totalWidthIn / 2, toInches(input.instance.positionYIn) + depthIn / 2);
  container.rotation = (input.instance.rotationDeg * Math.PI) / 180;

  return container;
}

export function renderRackInstances(inputs: readonly RackRenderInput[]): Container {
  const container = new Container();
  for (const input of inputs) {
    container.addChild(renderRackInstance(input));
  }
  return container;
}
