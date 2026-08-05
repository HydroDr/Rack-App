/**
 * Renders the live BOM table and the area-selection control (Spec §6.3,
 * §6.3.3). Recomputes from layoutStore + rules-engine's aggregateBom on
 * every render via useMemo keyed on the live instances — never holds a
 * separately-cached count that could go stale after a mutation elsewhere
 * in the app (Engineering File Plan §6.2).
 *
 * Materials-by-area uses the two mechanisms Spec §6.3.3 resolves: a
 * transient marquee selection (layoutStore.selectedIds, set by
 * CanvasTab's selection tool — read here, never duplicated) and any
 * saved Zone as a reusable filter (via zoneMembership.ts).
 */

import { useMemo, useState } from "react";
import { computeZoneMembership } from "@rack-app/canvas";
import type { EntityId, PalletProfile, RackInstance, RackTemplate } from "@rack-app/state";
import { useLayoutStore, useUiPreferencesStore } from "../app/stores.js";
import { computeInstanceBounds } from "../app/instanceGeometry.js";
import { buildMaterialLineItems, computeInstanceBom } from "./bomUtils.js";

export interface MaterialsTabProps {
  readonly templates: readonly RackTemplate[];
  readonly palletProfiles: readonly PalletProfile[];
}

type Scope = "all" | "selection" | EntityId;

export function MaterialsTab({ templates, palletProfiles }: MaterialsTabProps) {
  const rackInstances = useLayoutStore((state) => state.rackInstances);
  const selectedIds = useLayoutStore((state) => state.selectedIds);
  const zones = useLayoutStore((state) => state.zones);
  const protectorPlacements = useLayoutStore((state) => state.protectorPlacements);
  const defaultAnchorsPerUpright = useUiPreferencesStore((state) => state.defaultAnchorsPerUpright);

  const [scope, setScope] = useState<Scope>("all");

  const scopedInstances = useMemo((): readonly RackInstance[] => {
    const allInstances = Array.from(rackInstances.values());
    if (scope === "all") return allInstances;
    if (scope === "selection") return allInstances.filter((instance) => selectedIds.has(instance.id));

    const zone = zones.get(scope);
    if (zone === undefined) return allInstances;
    const boundsOf = (instance: RackInstance) => {
      const template = templates.find((candidate) => candidate.id === instance.templateId);
      return template === undefined
        ? { minXIn: instance.positionXIn, minYIn: instance.positionYIn, maxXIn: instance.positionXIn, maxYIn: instance.positionYIn }
        : computeInstanceBounds(instance, template);
    };
    return computeZoneMembership(zone, rackInstances, boundsOf, () => 0).containedInstances;
  }, [scope, rackInstances, selectedIds, zones, templates]);

  const lineItems = useMemo(() => {
    const results = [];
    for (const instance of scopedInstances) {
      const template = templates.find((candidate) => candidate.id === instance.templateId);
      if (template === undefined) continue;
      const palletProfile = palletProfiles.find((candidate) => candidate.id === template.palletProfileId);
      if (palletProfile === undefined) continue;
      const protectorPlacement = Array.from(protectorPlacements.values()).find((candidate) => candidate.rackInstanceId === instance.id);

      const result = computeInstanceBom(instance, template, palletProfile, defaultAnchorsPerUpright, protectorPlacement);
      if (result.kind !== "error") results.push(result.value);
    }
    return buildMaterialLineItems(results);
  }, [scopedInstances, templates, palletProfiles, defaultAnchorsPerUpright, protectorPlacements]);

  return (
    <div style={{ padding: 16 }}>
      <label>
        Area:{" "}
        <select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
          <option value="all">All</option>
          <option value="selection">Current Selection ({selectedIds.size})</option>
          {Array.from(zones.values()).map((zone) => (
            <option key={zone.id} value={zone.id}>
              Zone: {zone.name}
            </option>
          ))}
        </select>
      </label>

      <table style={{ marginTop: 12, borderCollapse: "collapse", width: "100%", maxWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)", padding: "4px 8px" }}>Material</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid var(--color-border)", padding: "4px 8px" }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 && (
            <tr>
              <td colSpan={2} style={{ padding: "8px", color: "var(--color-text-muted)" }}>
                No materials in this area yet.
              </td>
            </tr>
          )}
          {lineItems.map((item) => (
            <tr key={item.material}>
              <td style={{ padding: "4px 8px" }}>{item.material}</td>
              <td style={{ padding: "4px 8px", textAlign: "right" }}>{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
