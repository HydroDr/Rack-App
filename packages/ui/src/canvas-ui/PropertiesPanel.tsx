/**
 * Selected-instance details: template/variant, config + recompute,
 * levels, PPO, thumbnail, per-component color, protector placement
 * (Spec §6.3.2, §3.1, §3.1b).
 *
 * Bay-count and protector-placement edits apply live; configuration-type
 * changes are staged locally and only take effect when "Recompute" is
 * clicked — per Spec §6.4.2, restructuring single/back-to-back/double-
 * deep is a heavier, deliberate change, distinct from the values that
 * are already kept current automatically. This component never touches
 * layoutStore or commandStack directly — every change is reported
 * upward via callback props, exactly like Toolbar.tsx.
 *
 * Column-protector placement is exposed as a simple count (the first N
 * upright positions along the line get a column protector) rather than
 * a per-upright spatial picker — ProtectorPlacement.columnProtectorUprightIndices
 * supports arbitrary positions, but a count is the simplest UI that
 * still produces a valid placement; a future phase can add per-upright
 * picking on the canvas itself if that granularity turns out to matter.
 */

import { useEffect, useState } from "react";
import { CONFIGURATION_TYPES, type ConfigurationType } from "@rack-app/rules-engine";
import {
  getVariantDisplayName,
  type ComponentType,
  type LineEndProtectorFlags,
  type ProtectorPlacement,
  type RackInstance,
  type RackTemplate,
  type Variant,
} from "@rack-app/state";

export interface PropertiesPanelProps {
  readonly instance: RackInstance | null;
  readonly template: RackTemplate | null;
  readonly variant: Variant | null;
  readonly ppo: number | null;
  readonly protectorPlacement: ProtectorPlacement | undefined;
  readonly onUpdateBays: (bays: number) => void;
  readonly onRecomputeConfiguration: (next: { configurationType: ConfigurationType; rackColumns: number }) => void;
  readonly onComponentColorOverrideChange: (component: ComponentType, color: string | undefined) => void;
  readonly onToggleLineEndProtector: (lineIndex: number, side: "frontEnd" | "backEnd", value: boolean) => void;
  readonly onSetColumnProtectorCount: (count: number) => void;
}

const COMPONENT_TYPES: readonly ComponentType[] = ["upright", "beam", "wireDeck", "rowSpacer", "protector"];

export function PropertiesPanel({
  instance,
  template,
  variant,
  ppo,
  protectorPlacement,
  onUpdateBays,
  onRecomputeConfiguration,
  onComponentColorOverrideChange,
  onToggleLineEndProtector,
  onSetColumnProtectorCount,
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

  const lineEndProtectors: readonly LineEndProtectorFlags[] = Array.from(
    { length: instance.rackColumns },
    (_, index) => protectorPlacement?.lineEndProtectors[index] ?? { frontEnd: false, backEnd: false },
  );
  const columnProtectorCount = protectorPlacement?.columnProtectorUprightIndices.length ?? 0;

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

      <fieldset style={{ marginTop: 8 }}>
        <legend>Protectors</legend>
        {lineEndProtectors.map((flags, lineIndex) => (
          <div key={lineIndex} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
            <span>Line {lineIndex + 1}:</span>
            <label>
              <input
                type="checkbox"
                checked={flags.frontEnd}
                onChange={(event) => onToggleLineEndProtector(lineIndex, "frontEnd", event.target.checked)}
              />{" "}
              Front
            </label>
            <label>
              <input
                type="checkbox"
                checked={flags.backEnd}
                onChange={(event) => onToggleLineEndProtector(lineIndex, "backEnd", event.target.checked)}
              />{" "}
              Back
            </label>
          </div>
        ))}
        <label style={{ display: "block", marginTop: 6 }}>
          Column protectors (uprights):{" "}
          <input
            type="number"
            min={0}
            value={columnProtectorCount}
            onChange={(event) => onSetColumnProtectorCount(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
            style={{ width: 50 }}
          />
        </label>
      </fieldset>
    </aside>
  );
}
