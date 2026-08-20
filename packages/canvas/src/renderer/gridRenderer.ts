/**
 * Draws the background grid (Engineering File Plan §5.1).
 */

import { Container, Graphics, Text } from "pixi.js";
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

export interface GridLabelOptions extends GridRenderOptions {
  /** Hex color string for the label text — a UI-chrome tint (Design_System.docx §3.3's --color-text-secondary), resolved by the caller since this package has no DOM/CSS access. */
  readonly labelColor: string;
}

/**
 * Column-letter (A, B, C…) markers along the top edge and row-number (1,
 * 2, 3…) markers along the left edge, one per grid interval — lets a
 * designer call out a rack position ("row C, column 4") to a client or
 * installer the same way a spreadsheet or floor-plan grid would
 * (Design_System.docx §5.1, §6.3). Font size is a world-inch constant
 * tuned against CanvasTab's PIXELS_PER_INCH (0.15) so labels read at
 * roughly Caption size (§4.2) on screen at 100% zoom — it lives in world
 * space (like the grid lines themselves) rather than screen space, so it
 * scales with zoom exactly as the grid it's labeling does.
 */
const LABEL_FONT_SIZE_IN = 70;

function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

export function renderGridLabels(options: GridLabelOptions): Container {
  const container = new Container();
  const widthIn = toInches(options.widthIn);
  const heightIn = toInches(options.heightIn);
  const intervalIn = toInches(options.intervalIn);

  if (intervalIn <= 0 || widthIn <= 0 || heightIn <= 0) {
    return container;
  }

  const fill = hexColorToNumber(options.labelColor);
  const style = { fontFamily: "Inter, system-ui, sans-serif", fontSize: LABEL_FONT_SIZE_IN, fill };

  let columnIndex = 0;
  for (let x = 0; x <= widthIn; x += intervalIn) {
    const label = new Text({ text: columnLetter(columnIndex), style });
    label.anchor.set(0, 1);
    label.position.set(x, 0);
    container.addChild(label);
    columnIndex += 1;
  }

  let rowIndex = 1;
  for (let y = 0; y <= heightIn; y += intervalIn) {
    const label = new Text({ text: String(rowIndex), style });
    label.anchor.set(1, 0.5);
    label.position.set(0, y);
    container.addChild(label);
    rowIndex += 1;
  }

  return container;
}
