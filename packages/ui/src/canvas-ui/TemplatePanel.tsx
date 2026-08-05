/**
 * Quick/Normal mode toggle, pallet-profile filter, variant grouping
 * (Spec §6.4.4). Mode currently lives as local component state, not a
 * persisted preference — §6.5's Account Settings table doesn't list it,
 * unlike toolbar layout/position, so it isn't added to uiPreferencesStore
 * speculatively; it can move there later if Juan wants it remembered
 * across sessions.
 */

import { useState } from "react";
import { toInches } from "@rack-app/rules-engine";
import { getVariantDisplayName, type EntityId, type RackTemplate, type Variant } from "@rack-app/state";

export interface TemplatePanelProps {
  readonly templates: readonly RackTemplate[];
  readonly variants: readonly Variant[];
  /** Empty set = no filter (show everything) — Spec §6.5's pallet size/weight filter is multi-select. */
  readonly activePalletProfileIds: ReadonlySet<EntityId>;
  readonly onSelectTemplate: (templateId: EntityId, variantId?: EntityId) => void;
  /** Routes to the Template Editor pre-filled with this template (Spec §6.4.1, Phase 7). */
  readonly onEditTemplate: (templateId: EntityId) => void;
}

type PanelMode = "quick" | "normal";

export function TemplatePanel({ templates, variants, activePalletProfileIds, onSelectTemplate, onEditTemplate }: TemplatePanelProps) {
  const [mode, setMode] = useState<PanelMode>("quick");

  const visibleTemplates =
    activePalletProfileIds.size === 0 ? templates : templates.filter((template) => activePalletProfileIds.has(template.palletProfileId));

  function variantsFor(templateId: EntityId): readonly Variant[] {
    return variants.filter((variant) => variant.parentTemplateId === templateId);
  }

  return (
    <aside style={{ width: 240, padding: 12, borderRight: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <div role="group" aria-label="Template panel mode" style={{ marginBottom: 8 }}>
        <button aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>
          Quick
        </button>
        <button aria-pressed={mode === "normal"} onClick={() => setMode("normal")}>
          Normal
        </button>
      </div>

      {visibleTemplates.length === 0 && <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No templates match the active filter.</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visibleTemplates.map((template) => (
          <li key={template.id} style={{ marginBottom: 10 }}>
            {mode === "normal" && (
              <div style={{ aspectRatio: "4 / 3", background: "#e9ebee", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Thumbnail</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
              <button onClick={() => onSelectTemplate(template.id)} style={{ display: "block", flex: 1, textAlign: "left" }}>
                <strong>{template.name}</strong>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {template.palletLevels} lvl
                  {mode === "normal" && (
                    <>
                      {" · "}
                      {toInches(template.frameDepthIn)}" depth · {toInches(template.beamLengthIn)}" beam
                    </>
                  )}
                </div>
              </button>
              <button
                type="button"
                aria-label={`Edit ${template.name}`}
                onClick={() => onEditTemplate(template.id)}
                style={{ fontSize: 11, padding: "2px 6px", flexShrink: 0 }}
              >
                Edit
              </button>
            </div>

            {variantsFor(template.id).length > 0 && (
              <ul style={{ listStyle: "none", paddingLeft: 12, margin: "4px 0 0" }}>
                {variantsFor(template.id).map((variant) => (
                  <li key={variant.id}>
                    <button onClick={() => onSelectTemplate(template.id, variant.id)} style={{ fontSize: 12 }}>
                      {getVariantDisplayName(template, variant)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
