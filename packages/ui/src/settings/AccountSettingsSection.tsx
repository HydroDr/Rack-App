/**
 * Toppling threshold display (read-only value, code-derived), variant
 * auto-promotion, toolbar prefs, drawing/display prefs, default
 * anchors-per-upright (Spec §6.5), and DXF drawing-style import.
 *
 * The toppling threshold renders as a plain readout div, not any kind of
 * input/select/contentEditable element — there is no form control here a
 * user could type into. Keeps the hard-threshold decision (Spec §2.5)
 * from being undone by a UI that implies it's freely editable
 * (Engineering File Plan §6.6).
 *
 * DXF import here actually applies its result (unlike
 * ProjectSettingsSection's read-only preview of the same parser): a
 * layer's color is the only part of ImportedDrawingPreferences with a
 * real uiPreferencesStore counterpart — gridColor/annotationColor/
 * selectionHighlightColor are all colors, so the first, second, and
 * third layers with a defined ACI color number map onto them in that
 * order. Text styles/dimension styles/linetypes have no comparable
 * existing preference field, so they're listed in the summary for
 * visibility but not applied to anything.
 */

import { useState } from "react";
import { TOPPLING_RATIO_THRESHOLD } from "@rack-app/rules-engine";
import { importDxfStylePreferences, type ImportedDrawingPreferences } from "@rack-app/import";
import type { ThemePreference, ToolbarPosition, UnitsPreference } from "@rack-app/state";
import { useUiPreferencesStore } from "../app/stores.js";
import { readFileAsText } from "../app/readFileAsText.js";
import { aciToHex } from "./aciColor.js";

export function AccountSettingsSection() {
  const theme = useUiPreferencesStore((state) => state.theme);
  const setTheme = useUiPreferencesStore((state) => state.setTheme);
  const units = useUiPreferencesStore((state) => state.units);
  const setUnits = useUiPreferencesStore((state) => state.setUnits);
  const toolbarPosition = useUiPreferencesStore((state) => state.toolbarPosition);
  const setToolbarPosition = useUiPreferencesStore((state) => state.setToolbarPosition);
  const textAnnotationSize = useUiPreferencesStore((state) => state.textAnnotationSize);
  const setTextAnnotationSize = useUiPreferencesStore((state) => state.setTextAnnotationSize);
  const gridColor = useUiPreferencesStore((state) => state.gridColor);
  const setGridColor = useUiPreferencesStore((state) => state.setGridColor);
  const annotationColor = useUiPreferencesStore((state) => state.annotationColor);
  const setAnnotationColor = useUiPreferencesStore((state) => state.setAnnotationColor);
  const selectionHighlightColor = useUiPreferencesStore((state) => state.selectionHighlightColor);
  const setSelectionHighlightColor = useUiPreferencesStore((state) => state.setSelectionHighlightColor);
  const defaultAnchorsPerUpright = useUiPreferencesStore((state) => state.defaultAnchorsPerUpright);
  const setDefaultAnchorsPerUpright = useUiPreferencesStore((state) => state.setDefaultAnchorsPerUpright);
  const defaultCapacityMarginLb = useUiPreferencesStore((state) => state.defaultCapacityMarginLb);
  const setDefaultCapacityMarginLb = useUiPreferencesStore((state) => state.setDefaultCapacityMarginLb);
  const variantAutoPromotion = useUiPreferencesStore((state) => state.variantAutoPromotion);
  const setVariantAutoPromotion = useUiPreferencesStore((state) => state.setVariantAutoPromotion);

  const [dxfPreferences, setDxfPreferences] = useState<ImportedDrawingPreferences | null>(null);
  const [dxfError, setDxfError] = useState<string | null>(null);
  const [appliedColorCount, setAppliedColorCount] = useState(0);

  async function handleDxfFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;

    setDxfError(null);
    setDxfPreferences(null);
    setAppliedColorCount(0);

    let preferences: ImportedDrawingPreferences;
    try {
      const text = await readFileAsText(file);
      const result = importDxfStylePreferences(text);
      if (result.kind === "error") {
        setDxfError(result.message);
        return;
      }
      preferences = result.value;
    } catch (cause) {
      setDxfError(cause instanceof Error ? cause.message : "Failed to read the file.");
      return;
    }

    setDxfPreferences(preferences);

    const colorSetters = [setGridColor, setAnnotationColor, setSelectionHighlightColor];
    let applied = 0;
    for (const layer of preferences.layers) {
      if (applied >= colorSetters.length) break;
      const hex = aciToHex(layer.colorNumber);
      if (hex === undefined) continue;
      colorSetters[applied]!(hex);
      applied += 1;
    }
    setAppliedColorCount(applied);
  }

  return (
    <section style={{ maxWidth: 480 }}>
      <h2>Account Settings</h2>

      <fieldset style={{ marginBottom: 16 }}>
        <legend>Appearance</legend>
        <label style={{ display: "block" }}>
          Theme:{" "}
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </fieldset>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Toppling ratio threshold</div>
        <div
          role="status"
          aria-readonly="true"
          style={{ padding: "8px 12px", background: "var(--color-bg-hover)", borderRadius: 6, border: "1px solid var(--color-border)" }}
        >
          <strong>{TOPPLING_RATIO_THRESHOLD}:1</strong>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
            ANSI MH16.1 §12.1.3 code minimum — informational, not editable here. The only override path is the
            documented anchored/braced exception recorded on a specific Rack Instance (Spec §2.5).
          </div>
        </div>
      </div>

      <label style={{ display: "block", marginBottom: 8 }}>
        Default anchors per upright:{" "}
        <input
          type="number"
          min={1}
          value={defaultAnchorsPerUpright}
          onChange={(event) => setDefaultAnchorsPerUpright(Number(event.target.value))}
        />
      </label>

      <label style={{ display: "block", marginBottom: 8 }}>
        Default beam-capacity margin (lb):{" "}
        <input
          type="number"
          min={0}
          value={defaultCapacityMarginLb}
          onChange={(event) => setDefaultCapacityMarginLb(Number(event.target.value))}
        />
      </label>

      <label style={{ display: "block", marginBottom: 16 }}>
        <input type="checkbox" checked={variantAutoPromotion} onChange={(event) => setVariantAutoPromotion(event.target.checked)} /> Variant
        auto-promotion (surface frequently-used variants as quick options)
      </label>

      <fieldset style={{ marginBottom: 16 }}>
        <legend>Toolbar</legend>
        <label>
          Dock position:{" "}
          <select value={toolbarPosition} onChange={(event) => setToolbarPosition(event.target.value as ToolbarPosition)}>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Drawing / Display</legend>
        <label style={{ display: "block", marginBottom: 6 }}>
          Units:{" "}
          <select value={units} onChange={(event) => setUnits(event.target.value as UnitsPreference)}>
            <option value="inches">Inches</option>
            <option value="feetInches">Feet-Inches</option>
            <option value="metric">Metric</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          Text/annotation size: <input type="number" value={textAnnotationSize} onChange={(event) => setTextAnnotationSize(Number(event.target.value))} />
        </label>
        <label style={{ marginRight: 12 }}>
          Grid color: <input type="color" value={gridColor} onChange={(event) => setGridColor(event.target.value)} />
        </label>
        <label style={{ marginRight: 12 }}>
          Annotation color: <input type="color" value={annotationColor} onChange={(event) => setAnnotationColor(event.target.value)} />
        </label>
        <label>
          Selection highlight:{" "}
          <input type="color" value={selectionHighlightColor} onChange={(event) => setSelectionHighlightColor(event.target.value)} />
        </label>
      </fieldset>

      <fieldset style={{ marginTop: 16 }}>
        <legend>Import drawing settings from DXF</legend>
        <input type="file" accept=".dxf" onChange={(event) => void handleDxfFileChange(event)} />
        {dxfError !== null && <p style={{ color: "var(--color-danger)" }}>{dxfError}</p>}
        {dxfPreferences !== null && (
          <div style={{ fontSize: 13 }}>
            <p>
              Applied {appliedColorCount} layer color{appliedColorCount === 1 ? "" : "s"} to Grid/Annotation/Selection-highlight above.
            </p>
            <ul>
              <li>Layers: {dxfPreferences.layers.map((layer) => layer.name).join(", ") || "none"}</li>
              <li>Text styles: {dxfPreferences.textStyles.map((style) => style.name).join(", ") || "none"}</li>
              <li>Dimension styles: {dxfPreferences.dimStyles.map((style) => style.name).join(", ") || "none"}</li>
              <li>Linetypes: {dxfPreferences.lineTypes.map((lineType) => lineType.name).join(", ") || "none"}</li>
            </ul>
          </div>
        )}
      </fieldset>
    </section>
  );
}
