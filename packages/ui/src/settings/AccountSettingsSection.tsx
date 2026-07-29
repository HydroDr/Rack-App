/**
 * Toppling threshold display (read-only value, code-derived), variant
 * auto-promotion, toolbar prefs, drawing/display prefs, default
 * anchors-per-upright (Spec §6.5).
 *
 * The toppling threshold renders as a plain readout div, not any kind of
 * input/select/contentEditable element — there is no form control here a
 * user could type into. Keeps the hard-threshold decision (Spec §2.5)
 * from being undone by a UI that implies it's freely editable
 * (Engineering File Plan §6.6).
 */

import { TOPPLING_RATIO_THRESHOLD } from "@rack-app/rules-engine";
import type { ToolbarPosition, UnitsPreference } from "@rack-app/state";
import { useUiPreferencesStore } from "../app/stores.js";

export function AccountSettingsSection() {
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
  const variantAutoPromotion = useUiPreferencesStore((state) => state.variantAutoPromotion);
  const setVariantAutoPromotion = useUiPreferencesStore((state) => state.setVariantAutoPromotion);

  return (
    <section style={{ maxWidth: 480 }}>
      <h2>Account Settings</h2>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Toppling ratio threshold</div>
        <div
          role="status"
          aria-readonly="true"
          style={{ padding: "8px 12px", background: "#f4f5f7", borderRadius: 6, border: "1px solid var(--color-border)" }}
        >
          <strong>{TOPPLING_RATIO_THRESHOLD}:1</strong>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
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
    </section>
  );
}
