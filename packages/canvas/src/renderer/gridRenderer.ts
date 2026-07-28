/**
 * Draws the background grid (Engineering File Plan §5.1).
 */

import { Graphics } from "pixi.js";
import { toInches, type Length } from "@rack-app/rules-engine";

export interface GridRenderOptions {
  readonly widthIn: Length;
  readonly heightIn: Length;
  readonly intervalIn: Length;
  /** Hex color string, e.g. from uiPreferencesStore's gridColor. */
  readonly color: string;
  readonly lineWidth?: number;
}

function hexColorToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

const DEFAULT_LINE_WIDTH = 1;

export function renderGrid(options: GridRenderOptions): Graphics {
  const graphics = new Graphics();
  const widthIn = toInches(options.widthIn);
  const heightIn = toInches(options.heightIn);
  const intervalIn = toInches(options.intervalIn);

  // Guard against a zero/negative interval, which would otherwise loop forever.
  if (intervalIn <= 0 || widthIn <= 0 || heightIn <= 0) {
    return graphics;
  }

  for (let x = 0; x <= widthIn; x += intervalIn) {
    graphics.moveTo(x, 0).lineTo(x, heightIn);
  }
  for (let y = 0; y <= heightIn; y += intervalIn) {
    graphics.moveTo(0, y).lineTo(widthIn, y);
  }
  graphics.stroke({ width: options.lineWidth ?? DEFAULT_LINE_WIDTH, color: hexColorToNumber(options.color) });

  return graphics;
}
