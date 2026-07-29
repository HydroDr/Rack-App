/**
 * Selected-instance details: template/variant, config + recompute,
 * levels, PPO, thumbnail, per-component color (Spec §6.3.2).
 *
 * Bay-count edits apply live; configuration-type changes are staged
 * locally and only take effect when "Recompute" is clicked — per Spec
 * §6.4.2, restructuring single/back-to-back/double-deep is a heavier,
 * deliberate change, distinct from the values that are already kept
 * current automatically. This component never touches layoutStore or
 * commandStack directly — every change is reported upward via callback
 * props, exactly like Toolbar.tsx.
 */

import { useEffect, useState } from "react";
import { CONFIGURATION_TYPES, type ConfigurationType } from "@rack-app/rules-engine";
import { getVariantDisplayName, type ComponentType, type RackInstance, type RackTemplate, type Variant } from "@rack-app/state";

export interface PropertiesPanelProps {
  readonly instance: RackInstance | null;
  readonly template: RackTemplate | null;
  readonly variant: Variant | null;
  readonly ppo: number | null;
  readonly onUpdateBays: (bays: number) => void;
  readonly onRecomputeConfiguration: (next: { configurationType: ConfigurationType; rackColumns: number }) => void;
  readonly onComponentColorOverrideChange: (component: ComponentType, color: string | undefined) => void;
}

const COMPONENT_TYPES: readonly ComponentType[] = ["upright", "beam", "wireDeck", "rowSpacer", "protector"];

export function PropertiesPanel({
  instance,
  template,
  variant,
  ppo,
  onUpdateBays,
  onRecomputeConfiguration,
  onComponentColorOverrideChange,
}: PropertiesPanelProps) {
  const [pendingConfigType, setPendingConfigType] = useState<ConfigurationType>(instance?.configurationType ?? "single");
  const [pendingColumns, setPendingColumns] = useState<number>(instance?.rackColumns ?? 1);

  // Re-stage the pending fields whenever a different instance is selected.
  useEffect(() => {
    if (instance !== null) {
      setPendingConfigType(instance.configurationType);
      setPendingColumns(instance.rackColumns);
    }
  }, [instance?.id]);

  if (instance === null || template === null) {
    return (
      <aside style={{ width: 260, padding: 12, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No selection.</p>
      </aside>
    );
  }

  const hasPendingConfigChange = pendingConfigType !== instance.configurationType || pendingColumns !== instance.rackColumns;

  return (
    <aside style={{ width: 260, padding: 12, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", overflowY: "auto" }}>
      <h3 style={{ marginTop: 0 }}>{variant !== null ? getVariantDisplayName(template, variant) : template.name}</h3>

      <div style={{ aspectRatio: "4 / 3", background: "#e9ebee", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Front-view thumbnail</span>
      </div>

      <label style={{ display: "block", marginBottom: 8 }}>
        Bays:{" "}
        <input
          type="number"
          min={1}
          value={instance.bays}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (Number.isInteger(next) && next > 0) onUpdateBays(next);
          }}
          style={{ width: 60 }}
        />
      </label>

      <div style={{ marginBottom: 8 }}>
        Levels: {template.palletLevels} &nbsp;|&nbsp; PPO: {ppo ?? "—"}
      </div>

      <fieldset style={{ marginBottom: 8 }}>
        <legend>Configuration</legend>
        <select value={pendingConfigType} onChange={(event) => setPendingConfigType(event.target.value as ConfigurationType)}>
          {CONFIGURATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <label style={{ display: "block", marginTop: 6 }}>
          Rack columns:{" "}
          <input
            type="number"
            min={1}
            max={4}
            value={pendingColumns}
            onChange={(event) => setPendingColumns(Number.parseInt(event.target.value, 10) || 1)}
            style={{ width: 50 }}
          />
        </label>
        <button
          disabled={!hasPendingConfigChange}
          onClick={() => onRecomputeConfiguration({ configurationType: pendingConfigType, rackColumns: pendingColumns })}
          style={{ marginTop: 6 }}
        >
          Recompute
        </button>
      </fieldset>

      <fieldset>
        <legend>Component color</legend>
        {COMPONENT_TYPES.map((component) => (
          <label key={component} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            {component}
            <input
              type="color"
              value={instance.componentColorOverrides?.[component] ?? template.componentColors[component] ?? "#888888"}
              onChange={(event) => onComponentColorOverrideChange(component, event.target.value)}
            />
          </label>
        ))}
      </fieldset>
    </aside>
  );
}
