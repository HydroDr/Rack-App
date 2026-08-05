/**
 * Tab container for Canvas / Materials / Compare / ROI / Notes (Spec
 * §6.3). Loads the Template/Variant/PalletProfile catalog and the active
 * Layout's entities once here, and passes them down — this is the one
 * place those fetches happen, so no individual tab risks holding its own
 * stale copy.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { Result } from "@rack-app/rules-engine";
import type { BlockStackZone, EntityId, GroupLayer, PalletProfile, PathLane, ProtectorPlacement, RackInstance, RackTemplate, Variant, WarehouseElement, Zone } from "@rack-app/state";
import { useAppStores, useLayoutStore, useProjectStore } from "../app/stores.js";
import { CanvasTab } from "./CanvasTab.js";
import { MaterialsTab } from "./MaterialsTab.js";
import { CompareTab } from "./CompareTab.js";
import { RoiTab } from "./RoiTab.js";
import { NotesTab } from "./NotesTab.js";

type TabId = "canvas" | "materials" | "compare" | "roi" | "notes";
const TABS: readonly { id: TabId; label: string }[] = [
  { id: "canvas", label: "Canvas" },
  { id: "materials", label: "Materials" },
  { id: "compare", label: "Compare" },
  { id: "roi", label: "ROI" },
  { id: "notes", label: "Notes" },
];

export function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const layoutIdParam = searchParams.get("layout");

  const { repositories, layoutStore } = useAppStores();
  const allLayouts = useProjectStore((state) => state.layouts);
  const activeLayoutId = useLayoutStore((state) => state.layoutId);

  const [templates, setTemplates] = useState<readonly RackTemplate[]>([]);
  const [variants, setVariants] = useState<readonly Variant[]>([]);
  const [palletProfiles, setPalletProfiles] = useState<readonly PalletProfile[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("canvas");

  const layouts = allLayouts.filter((layout) => layout.projectId === projectId);

  useEffect(() => {
    async function loadCatalog(): Promise<void> {
      const [templatesResult, variantsResult, profilesResult] = await Promise.all([
        repositories.templates.listTemplates(),
        repositories.templates.listVariants(),
        repositories.palletProfiles.list(),
      ]);
      if (templatesResult.kind !== "error") {
        setTemplates(templatesResult.value.filter((template): template is RackTemplate => template.templateType === "rack"));
      }
      if (variantsResult.kind !== "error") setVariants(variantsResult.value);
      if (profilesResult.kind !== "error") setPalletProfiles(profilesResult.value);
    }
    void loadCatalog();
  }, [repositories]);

  useEffect(() => {
    const targetLayoutId = (layoutIdParam ?? layouts[0]?.id) as EntityId | undefined;
    if (targetLayoutId === undefined || targetLayoutId === activeLayoutId) return;

    async function loadLayoutData(): Promise<void> {
      const [instances, elements, lanes, groups, zonesList, blockStacks, protectorPlacements] = await Promise.all([
        repositories.rackInstances.list(),
        repositories.warehouseElements.list(),
        repositories.pathLanes.list(),
        repositories.groupLayers.list(),
        repositories.zones.list(),
        repositories.blockStackZones.list(),
        repositories.protectorPlacements.list(),
      ]);

      function toMap<T extends { readonly id: EntityId; readonly layoutId: EntityId }>(result: Result<readonly T[]>): ReadonlyMap<EntityId, T> {
        if (result.kind === "error") return new Map();
        return new Map(result.value.filter((entity) => entity.layoutId === targetLayoutId).map((entity) => [entity.id, entity]));
      }

      layoutStore.getState().loadLayout(targetLayoutId as EntityId, {
        rackInstances: toMap<RackInstance>(instances),
        warehouseElements: toMap<WarehouseElement>(elements),
        pathLanes: toMap<PathLane>(lanes),
        groupLayers: toMap<GroupLayer>(groups),
        zones: toMap<Zone>(zonesList),
        blockStackZones: toMap<BlockStackZone>(blockStacks),
        protectorPlacements: toMap<ProtectorPlacement>(protectorPlacements),
      });
    }
    void loadLayoutData();
  }, [layoutIdParam, layouts, activeLayoutId, repositories, layoutStore]);

  if (projectId === undefined) {
    return <p style={{ padding: 24 }}>Project not found.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <nav style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ fontWeight: activeTab === tab.id ? 700 : 400, background: "none", border: "none", padding: "6px 10px", cursor: "pointer" }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {activeTab === "canvas" && <CanvasTab templates={templates} variants={variants} palletProfiles={palletProfiles} />}
        {activeTab === "materials" && <MaterialsTab templates={templates} palletProfiles={palletProfiles} />}
        {activeTab === "compare" && activeLayoutId !== null && (
          <CompareTab currentLayoutId={activeLayoutId} layouts={layouts} templates={templates} palletProfiles={palletProfiles} />
        )}
        {activeTab === "roi" && <RoiTab templates={templates} palletProfiles={palletProfiles} />}
        {activeTab === "notes" && activeLayoutId !== null && <NotesTab projectId={projectId as EntityId} layoutId={activeLayoutId} />}
      </div>
    </div>
  );
}
