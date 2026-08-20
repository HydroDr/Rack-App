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
import {
  createLayout,
  type BlockStackZone,
  type EntityId,
  type GroupLayer,
  type PalletProfile,
  type PathLane,
  type ProtectorPlacement,
  type RackInstance,
  type RackTemplate,
  type Variant,
  type WarehouseElement,
  type Zone,
} from "@rack-app/state";
import { useAppStores, useLayoutStore, useProjectStore } from "../app/stores.js";
import { CanvasTab } from "./CanvasTab.js";
import { MaterialsTab } from "./MaterialsTab.js";
import { CompareTab } from "./CompareTab.js";
import { RoiTab } from "./RoiTab.js";
import { NotesTab } from "./NotesTab.js";
import { SharePanel } from "./SharePanel.js";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const layoutIdParam = searchParams.get("layout");

  const { repositories, layoutStore } = useAppStores();
  const allLayouts = useProjectStore((state) => state.layouts);
  const upsertLayout = useProjectStore((state) => state.upsertLayout);
  const activeLayoutId = useLayoutStore((state) => state.layoutId);

  const [templates, setTemplates] = useState<readonly RackTemplate[]>([]);
  const [variants, setVariants] = useState<readonly Variant[]>([]);
  const [palletProfiles, setPalletProfiles] = useState<readonly PalletProfile[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("canvas");
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);

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
    if (projectId === undefined) return;
    async function loadLayouts(): Promise<void> {
      const result = await repositories.layouts.list();
      if (result.kind === "error") return;
      for (const layout of result.value) {
        if (layout.projectId === projectId) upsertLayout(layout);
      }
    }
    void loadLayouts();
  }, [repositories, projectId, upsertLayout]);

  async function handleNewLayout(): Promise<void> {
    if (projectId === undefined) return;
    const name = window.prompt("Layout name?");
    if (name === null || name.trim() === "") return;

    const result = createLayout({ projectId: projectId as EntityId, name });
    if (result.kind === "error") {
      window.alert(result.message);
      return;
    }

    const saveResult = await repositories.layouts.save(result.value);
    if (saveResult.kind === "error") {
      window.alert(saveResult.message);
      return;
    }

    upsertLayout(result.value);
  }

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
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 4,
          padding: "8px 16px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-card)",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ fontWeight: activeTab === tab.id ? 500 : 400, background: "none", border: "none", padding: "6px 10px", cursor: "pointer" }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {layouts.length > 0 && (
            <select
              value={layoutIdParam ?? activeLayoutId ?? ""}
              onChange={(event) => setSearchParams({ layout: event.target.value })}
            >
              {layouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => void handleNewLayout()}>
            + New Layout
          </button>
          <button type="button" onClick={() => setIsSharePanelOpen(true)}>
            Share
          </button>
        </div>
      </nav>

      {layouts.length === 0 ? (
        <p style={{ padding: 24, color: "var(--color-text-secondary)" }}>
          This project has no layouts yet — click "+ New Layout" above to create one before placing racks.
        </p>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {activeTab === "canvas" && <CanvasTab templates={templates} variants={variants} palletProfiles={palletProfiles} />}
          {activeTab === "materials" && <MaterialsTab templates={templates} palletProfiles={palletProfiles} />}
          {activeTab === "compare" && activeLayoutId !== null && (
            <CompareTab currentLayoutId={activeLayoutId} layouts={layouts} templates={templates} palletProfiles={palletProfiles} />
          )}
          {activeTab === "roi" && <RoiTab templates={templates} palletProfiles={palletProfiles} />}
          {activeTab === "notes" && activeLayoutId !== null && <NotesTab projectId={projectId as EntityId} layoutId={activeLayoutId} />}
        </div>
      )}

      {isSharePanelOpen && <SharePanel projectId={projectId as EntityId} layouts={layouts} onClose={() => setIsSharePanelOpen(false)} />}
    </div>
  );
}
