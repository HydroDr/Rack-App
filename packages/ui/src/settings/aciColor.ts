/**
 * Maps an AutoCAD Color Index (ACI) number — the raw integer DXF layer
 * colors are stored as — to a CSS hex color, for applying a DXF-imported
 * layer's color to a uiPreferencesStore color field. Only the 9 standard
 * ACI colors (the ones every AutoCAD-derived tool uses for basic layers)
 * are mapped; any other index falls back to a neutral gray rather than
 * guessing — the full 256-color ACI table varies by rendering context and
 * isn't worth reproducing here for a best-effort import.
 */
const ACI_HEX_BY_INDEX: Readonly<Record<number, string>> = {
  1: "#ff0000", // red
  2: "#ffff00", // yellow
  3: "#00ff00", // green
  4: "#00ffff", // cyan
  5: "#0000ff", // blue
  6: "#ff00ff", // magenta
  7: "#000000", // white/black (foreground) — black reads correctly on this app's light UI
  8: "#808080", // dark gray
  9: "#c0c0c0", // light gray
};

const FALLBACK_HEX = "#808080";

export function aciToHex(colorNumber: number | undefined): string | undefined {
  if (colorNumber === undefined) return undefined;
  return ACI_HEX_BY_INDEX[colorNumber] ?? FALLBACK_HEX;
}
