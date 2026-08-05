/**
 * Layout picker + diff result display (Spec §4). Reuses the exact same
 * BOM formulas via computeLayoutBom/diffBom — no new counting logic,
 * only comparison/display on top of data the app already produces.
 */

import { useEffect, useState } from "react";
import { diffBom, type DiffResult } from "@rack-app/rules-engine";
import type { EntityId, Layout, PalletProfile, ProtectorPlacement, RackInstance, RackTemplate } from "@rack-app/state";
import { useAppStores, useLayoutStore, useUiPreferencesStore } from "../app/stores.js";
import { computeLayoutBom } from "./bomUtils.js";

export interface CompareTabProps {
  readonly currentLayoutId: EntityId;
  readonly layouts: readonly Layout[];
  readonly templates: readonly RackTemplate[];
  readonly palletProfiles: readonly PalletProfile[];
}

export function CompareTab({ currentLayoutId, layouts, templates, palletProfiles }: CompareTabProps) {
  const { repositories } = useAppStores();
  const currentInstances = useLayoutStore((state) => Array.from(state.rackInstances.values()));
  const currentProtectorPlacements = useLayoutStore((state) => Array.from(state.protectorPlacements.values()));
  const defaultAnchorsPerUpright = useUiPreferencesStore((state) => state.defaultAnchorsPerUpright);

  const [layoutAId, setLayoutAId] = useState<EntityId>(currentLayoutId);
  const [layoutBId, setLayoutBId] = useState<EntityId | "">("");
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  async function loadInstancesFor(layoutId: EntityId): Promise<readonly RackInstance[]> {
    if (layoutId === currentLayoutId) return currentInstances;
    const result = await repositories.rackInstances.list();
    if (result.kind === "error") throw new Error(result.message);
    return result.value.filter((instance) => instance.layoutId === layoutId);
  }

  async function loadProtectorPlacementsFor(layoutId: EntityId): Promise<readonly ProtectorPlacement[]> {
    if (layoutId === currentLayoutId) return currentProtectorPlacements;
    const result = await repositories.protectorPlacements.list();
    if (result.kind === "error") throw new Error(result.message);
    return result.value.filter((placement) => placement.layoutId === layoutId);
  }

  useEffect(() => {
    if (layoutBId === "") {
      setDiffResult(null);
      return;
    }

    let cancelled = false;
    setIsComparing(true);
    setErrorMessage(null);

    Promise.all([
      loadInstancesFor(layoutAId),
      loadInstancesFor(layoutBId),
      loadProtectorPlacementsFor(layoutAId),
      loadProtectorPlacementsFor(layoutBId),
    ])
      .then(([instancesA, instancesB, protectorPlacementsA, protectorPlacementsB]) => {
        if (cancelled) return;
        const bomA = computeLayoutBom(instancesA, templates, palletProfiles, defaultAnchorsPerUpright, protectorPlacementsA);
        const bomB = computeLayoutBom(instancesB, templates, palletProfiles, defaultAnchorsPerUpright, protectorPlacementsB);
        const result = diffBom(bomA, bomB);
        setDiffResult(result.kind === "error" ? null : result.value);
        if (result.kind === "error") setErrorMessage(result.message);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Failed to compare layouts.");
      })
      .finally(() => {
        if (!cancelled) setIsComparing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [layoutAId, layoutBId, templates, palletProfiles, defaultAnchorsPerUpright]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <label>
          Layout A:{" "}
          <select value={layoutAId} onChange={(event) => setLayoutAId(event.target.value as EntityId)}>
            {layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {layout.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Layout B:{" "}
          <select value={layoutBId} onChange={(event) => setLayoutBId(event.target.value as EntityId | "")}>
            <option value="">Select a layout…</option>
            {layouts
              .filter((layout) => layout.id !== layoutAId)
              .map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {isComparing && <p>Comparing…</p>}
      {errorMessage !== null && <p style={{ color: "crimson" }}>{errorMessage}</p>}

      {diffResult !== null && (
        <table style={{ marginTop: 16, borderCollapse: "collapse", width: "100%", maxWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)", padding: "4px 8px" }}>Material</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid var(--color-border)", padding: "4px 8px" }}>Δ (A − B)</th>
            </tr>
          </thead>
          <tbody>
            {diffResult.lineItems.length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: "8px", color: "var(--color-text-muted)" }}>
                  No differences.
                </td>
              </tr>
            )}
            {diffResult.lineItems.map((item) => (
              <tr key={item.material}>
                <td style={{ padding: "4px 8px" }}>{item.material}</td>
                <td style={{ padding: "4px 8px", textAlign: "right", color: item.delta > 0 ? "#166534" : "#991b1b" }}>
                  {item.delta > 0 ? "+" : ""}
                  {item.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
