/**
 * Per-component-type color/material assignment (Spec §6.4.1).
 */

import type { ComponentColorMap, ComponentType } from "@rack-app/state";

export interface ComponentColorPickerProps {
  readonly colors: ComponentColorMap;
  readonly onChange: (component: ComponentType, color: string) => void;
}

const COMPONENT_TYPES: readonly ComponentType[] = ["upright", "beam", "wireDeck", "rowSpacer", "protector"];

const DEFAULT_COLORS: Record<ComponentType, string> = {
  upright: "#2255aa",
  beam: "#ff6600",
  wireDeck: "#cccccc",
  rowSpacer: "#888888",
  protector: "#ffcc00",
};

export function ComponentColorPicker({ colors, onChange }: ComponentColorPickerProps) {
  return (
    <fieldset>
      <legend>Component colors</legend>
      {COMPONENT_TYPES.map((component) => (
        <label key={component} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, minWidth: 160 }}>
          {component}
          <input type="color" value={colors[component] ?? DEFAULT_COLORS[component]} onChange={(event) => onChange(component, event.target.value)} />
        </label>
      ))}
    </fieldset>
  );
}
