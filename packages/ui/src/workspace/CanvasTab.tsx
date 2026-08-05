/**
 * Hosts the canvas renderer + toolbar + panels (Spec §6.3, §6.3.1-§6.3.4).
 *
 * Coordinate/interaction scope for Phase 4: a fixed pixels-per-inch scale
 * (no pan/zoom yet), click-to-place (after picking a template in
 * TemplatePanel) rather than full drag-and-drop, and simple prompt()-based
 * inputs for Array/Repeat count and Mirror axis position. These are
 * intentional MVP simplifications flagged for refinement once this is
 * visible and Juan can react to how it actually feels to use — not a
 * substitute for the real interaction design.
 *
 * Every mutating action here goes through commandStack (placeTemplate,
 * applyArrayRepeat, mirrorSelection, createPathLaneTool, and the generic
 * commitCommand for Properties Panel edits) — this file never calls
 * layoutStore's upsert/remove actions directly.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Application } from "pixi.js";
import {
  applyArrayRepeat,
  commitCommand,
  createPathLaneTool,
  createUpsertCommand,
  drawZone,
  mirrorSelection,
  placeTemplate,
  rectangleToZoneBoundary,
  renderScene,
  selectAtPoint,
  type EntityCommandOps,
  type RackRenderInput,
} from "@rack-app/canvas";
import { fromInches, resolveConfiguration, resolveLevelDefinitions, toInches, type ConfigurationType } from "@rack-app/rules-engine";
import { exportLayoutPdf, type CanvasSnapshot } from "@rack-app/export";
import { nowIsoTimestamp, type ComponentType, type EntityId, type GroupLayer, type PalletProfile, type RackTemplate, type Variant } from "@rack-app/state";
import { useAppStores, useHistoryStore, useLayoutStore, useUiPreferencesStore } from "../app/stores.js";
import { computeInstanceBounds } from "../app/instanceGeometry.js";
import { computeInstanceBom } from "./bomUtils.js";
import { Toolbar, type SnapSettings, type ToolId } from "../canvas-ui/Toolbar.js";
import { PropertiesPanel } from "../canvas-ui/PropertiesPanel.js";
import { LayersGroupsPanel } from "../canvas-ui/LayersGroupsPanel.js";
import { TemplatePanel } from "../canvas-ui/TemplatePanel.js";

export interface CanvasTabProps {
  readonly templates: readonly RackTemplate[];
  readonly variants: readonly Variant[];
  readonly palletProfiles: readonly PalletProfile[];
}

const PIXELS_PER_INCH = 0.15;

export function CanvasTab({ templates, variants, palletProfiles }: CanvasTabProps) {
  const { layoutStore, historyStore } = useAppStores();
  const rackInstances = useLayoutStore((state) => state.rackInstances);
  const warehouseElements = useLayoutStore((state) => state.warehouseElements);
  const pathLanes = useLayoutStore((state) => state.pathLanes);
  const groupLayers = useLayoutStore((state) => state.groupLayers);
  const protectorPlacements = useLayoutStore((state) => state.protectorPlacements);
  const selectedIds = useLayoutStore((state) => state.selectedIds);
  const gridColor = useUiPreferencesStore((state) => state.gridColor);
  const defaultAnchorsPerUpright = useUiPreferencesStore((state) => state.defaultAnchorsPerUpright);
  void useHistoryStore((state) => state.past.length); // re-render after undo/redo changes committed state

  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);

  const [activeToolId, setActiveToolId] = useState<ToolId | null>("select");
  const [selectedTemplateId, setSelectedTemplateId] = useState<EntityId | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<EntityId | null>(null);
  const [pathLaneBuilder, setPathLaneBuilder] = useState<ReturnType<typeof createPathLaneTool> | null>(null);
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({ gridSnapEnabled: true, orthoModeEnabled: false, objectSnapEnabled: false });
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);
  const [zoneDragStart, setZoneDragStart] = useState<{ xIn: ReturnType<typeof fromInches>; yIn: ReturnType<typeof fromInches> } | null>(null);
  const [zoneDragCurrent, setZoneDragCurrent] = useState<{ xIn: ReturnType<typeof fromInches>; yIn: ReturnType<typeof fromInches> } | null>(null);

  useEffect(() => {
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const initOptions = containerRef.current === null ? { background: "#f4f5f7" } : { background: "#f4f5f7", resizeTo: containerRef.current };
    void app.init(initOptions).then(() => {
      initialized = true;
      // init() is async, so React StrictMode's mount->cleanup->remount cycle can call the
      // cleanup below before this resolves — destroying a not-yet-initialized Application
      // throws inside PixiJS (its resize teardown isn't set up yet), so if disposal already
      // happened, destroy here instead, once it's actually safe to.
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      if (containerRef.current === null) return;
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;
    });
    return () => {
      disposed = true;
      appRef.current = null;
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  const renderInputs = useMemo((): readonly RackRenderInput[] => {
    const inputs: RackRenderInput[] = [];
    for (const instance of rackInstances.values()) {
      const template = templates.find((candidate) => candidate.id === instance.templateId);
      if (template === undefined) continue;
      const configResult = resolveConfiguration({
        configurationType: instance.configurationType,
        frameDepthIn: template.frameDepthIn,
        resolvedRowSpacerLengthIn: fromInches(12),
      });
      const ratioDepthIn = configResult.kind === "error" ? template.frameDepthIn : configResult.value.ratioDepthIn;
      inputs.push({ instance, template, ratioDepthIn });
    }
    return inputs;
  }, [rackInstances, templates]);

  useEffect(() => {
    const app = appRef.current;
    if (app === null) return;
    const scene = renderScene({
      grid: { widthIn: fromInches(6000), heightIn: fromInches(3000), intervalIn: fromInches(120), color: gridColor },
      warehouseElements: Array.from(warehouseElements.values()),
      rackInstances: renderInputs,
      pathLanes: Array.from(pathLanes.values()),
    });
    scene.root.scale.set(PIXELS_PER_INCH);
    app.stage.removeChildren();
    app.stage.addChild(scene.root);
  });

  function boundsOf(instance: Parameters<typeof computeInstanceBounds>[0]) {
    const template = templates.find((candidate) => candidate.id === instance.templateId);
    return template === undefined
      ? { minXIn: instance.positionXIn, minYIn: instance.positionYIn, maxXIn: instance.positionXIn, maxYIn: instance.positionYIn }
      : computeInstanceBounds(instance, template);
  }

  function screenToWorldIn(event: React.MouseEvent<HTMLDivElement>): { xIn: ReturnType<typeof fromInches>; yIn: ReturnType<typeof fromInches> } {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    return { xIn: fromInches(localX / PIXELS_PER_INCH), yIn: fromInches(localY / PIXELS_PER_INCH) };
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>): void {
    const point = screenToWorldIn(event);

    if (activeToolId === "select") {
      selectAtPoint({ layoutStore, boundsOf }, point, event.shiftKey);
      return;
    }

    if (activeToolId === "place") {
      if (selectedTemplateId === null) {
        window.alert("Pick a template in the Template Panel first.");
        return;
      }
      placeTemplate(layoutStore, historyStore, {
        templateId: selectedTemplateId,
        positionXIn: point.xIn,
        positionYIn: point.yIn,
        rotationDeg: 0,
        bays: 5,
        configurationType: "single",
        rackColumns: 1,
      });
      return;
    }

    if (activeToolId === "pathLane") {
      const builder = pathLaneBuilder ?? createPathLaneTool(layoutStore, historyStore, { laneType: "foot", widthIn: fromInches(36), markerIntervalIn: fromInches(60) });
      builder.addPoint(point);
      setPathLaneBuilder(builder);
    }
  }

  function handleCanvasDoubleClick(): void {
    if (activeToolId === "pathLane" && pathLaneBuilder !== null) {
      pathLaneBuilder.finish();
      setPathLaneBuilder(null);
    }
  }

  const MIN_ZONE_DRAG_IN = 12;

  function handleCanvasMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    if (activeToolId !== "zone") return;
    const point = screenToWorldIn(event);
    setZoneDragStart(point);
    setZoneDragCurrent(point);
  }

  function handleCanvasMouseMove(event: React.MouseEvent<HTMLDivElement>): void {
    if (activeToolId !== "zone" || zoneDragStart === null) return;
    setZoneDragCurrent(screenToWorldIn(event));
  }

  function handleCanvasMouseUp(event: React.MouseEvent<HTMLDivElement>): void {
    if (activeToolId !== "zone" || zoneDragStart === null) return;
    const end = screenToWorldIn(event);
    setZoneDragStart(null);
    setZoneDragCurrent(null);

    const widthIn = Math.abs(toInches(end.xIn) - toInches(zoneDragStart.xIn));
    const heightIn = Math.abs(toInches(end.yIn) - toInches(zoneDragStart.yIn));
    if (widthIn < MIN_ZONE_DRAG_IN || heightIn < MIN_ZONE_DRAG_IN) return;

    const name = window.prompt("Zone name?");
    if (name === null || name.trim() === "") return;
    const roiModeInput = window.prompt('ROI mode: "forwarding" or "distribution"?', "forwarding");
    if (roiModeInput === null) return;
    const roiMode = roiModeInput.trim() === "distribution" ? "distribution" : "forwarding";

    const boundary = rectangleToZoneBoundary(zoneDragStart, end);
    const result = drawZone(layoutStore, historyStore, { name, roiMode, boundary });
    if (result.kind === "error") {
      window.alert(result.message);
    }
  }

  function handleArrayRepeat(): void {
    const [selectedId] = selectedIds;
    const instance = selectedId === undefined ? undefined : rackInstances.get(selectedId);
    if (instance === undefined) {
      window.alert("Select a Rack Instance first.");
      return;
    }
    const input = window.prompt("Total bays for this line?", String(instance.bays));
    const requestedBayCount = input === null ? NaN : Number.parseInt(input, 10);
    if (!Number.isInteger(requestedBayCount)) return;
    const result = applyArrayRepeat(layoutStore, historyStore, { baseInstance: instance, requestedBayCount });
    if (result.clamped && result.warning !== undefined) window.alert(result.warning);
  }

  function handleMirror(): void {
    const selection = Array.from(selectedIds)
      .map((id) => rackInstances.get(id))
      .filter((instance): instance is NonNullable<typeof instance> => instance !== undefined);
    if (selection.length === 0) {
      window.alert("Select at least one Rack Instance first.");
      return;
    }
    const input = window.prompt("Mirror axis: vertical X position (inches)?");
    const xIn = input === null ? NaN : Number.parseFloat(input);
    if (Number.isNaN(xIn)) return;
    mirrorSelection(layoutStore, historyStore, selection, { kind: "vertical", xIn: fromInches(xIn) }, (instance) => {
      const template = templates.find((candidate) => candidate.id === instance.templateId);
      const beamLengthIn = template?.beamLengthIn ?? fromInches(96);
      const depthIn = template?.frameDepthIn ?? fromInches(42);
      return { widthIn: fromInches(toInches(beamLengthIn) * instance.bays), depthIn };
    });
  }

  function handleSelectTool(toolId: ToolId): void {
    setActiveToolId(toolId);
    if (toolId === "arrayRepeat") handleArrayRepeat();
    if (toolId === "mirror") handleMirror();
  }

  /** Captures a static snapshot of what renderScene() already drew to the canvas — never re-implements rack drawing (Spec §6.3c, carried over from the Phase 4 review). */
  async function handleExportPdf(): Promise<void> {
    setPdfExportError(null);
    const canvas = appRef.current?.canvas;
    if (canvas === undefined) return;
    const snapshot: CanvasSnapshot = { imageDataUrl: canvas.toDataURL("image/png"), widthPx: canvas.width, heightPx: canvas.height };
    const result = await exportLayoutPdf(snapshot, "Rack Layout");
    if (result.kind === "error" && result.code !== "SAVE_FILE_CANCELLED") {
      setPdfExportError(result.message);
    }
  }

  const groupLayerOps: EntityCommandOps<GroupLayer> = {
    upsert: (group) => layoutStore.getState().upsertGroupLayer(group),
    remove: (id) => layoutStore.getState().removeGroupLayer(id),
  };

  const selectedInstanceId = selectedIds.size === 1 ? Array.from(selectedIds)[0]! : null;
  const selectedInstance = selectedInstanceId === null ? null : (rackInstances.get(selectedInstanceId) ?? null);
  const selectedTemplate = selectedInstance === null ? null : (templates.find((t) => t.id === selectedInstance.templateId) ?? null);
  const selectedVariant = selectedInstance?.variantId === undefined ? null : (variants.find((v) => v.id === selectedInstance.variantId) ?? null);

  const selectedPpo = useMemo(() => {
    if (selectedInstance === null || selectedTemplate === null) return null;
    const palletProfile = palletProfiles.find((profile) => profile.id === selectedTemplate.palletProfileId);
    if (palletProfile === undefined) return null;
    const protectorPlacement = Array.from(protectorPlacements.values()).find(
      (candidate) => candidate.rackInstanceId === selectedInstance.id,
    );
    const result = computeInstanceBom(selectedInstance, selectedTemplate, palletProfile, defaultAnchorsPerUpright, protectorPlacement);
    return result.kind === "error" ? null : result.value.ppo;
  }, [selectedInstance, selectedTemplate, palletProfiles, defaultAnchorsPerUpright, protectorPlacements]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar activeToolId={activeToolId} onSelectTool={handleSelectTool} snapSettings={snapSettings} onChangeSnapSettings={setSnapSettings} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px" }}>
        <button type="button" onClick={() => void handleExportPdf()}>
          Export PDF
        </button>
        {pdfExportError !== null && <span style={{ color: "crimson" }}>{pdfExportError}</span>}
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <TemplatePanel
          templates={templates}
          variants={variants}
          activePalletProfileIds={new Set()}
          onSelectTemplate={(templateId) => setSelectedTemplateId(templateId)}
        />
        <LayersGroupsPanel
          groups={Array.from(groupLayers.values())}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onToggleVisibility={(groupId) => {
            const group = groupLayers.get(groupId);
            if (group !== undefined) commitCommand(historyStore, createUpsertCommand(groupLayerOps, { ...group, visible: !group.visible }, group));
          }}
          onToggleLock={(groupId) => {
            const group = groupLayers.get(groupId);
            if (group !== undefined) commitCommand(historyStore, createUpsertCommand(groupLayerOps, { ...group, locked: !group.locked }, group));
          }}
        />
        <div
          ref={containerRef}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          style={{ flex: 1, position: "relative", overflow: "hidden", background: "#f4f5f7" }}
        >
          {zoneDragStart !== null && zoneDragCurrent !== null && (
            <div
              data-testid="zone-drag-preview"
              style={{
                position: "absolute",
                pointerEvents: "none",
                border: "1px dashed #2684ff",
                background: "rgba(38, 132, 255, 0.1)",
                left: Math.min(toInches(zoneDragStart.xIn), toInches(zoneDragCurrent.xIn)) * PIXELS_PER_INCH,
                top: Math.min(toInches(zoneDragStart.yIn), toInches(zoneDragCurrent.yIn)) * PIXELS_PER_INCH,
                width: Math.abs(toInches(zoneDragCurrent.xIn) - toInches(zoneDragStart.xIn)) * PIXELS_PER_INCH,
                height: Math.abs(toInches(zoneDragCurrent.yIn) - toInches(zoneDragStart.yIn)) * PIXELS_PER_INCH,
              }}
            />
          )}
        </div>
        <PropertiesPanel
          instance={selectedInstance}
          template={selectedTemplate}
          variant={selectedVariant}
          ppo={selectedPpo}
          onUpdateBays={(bays) => {
            if (selectedInstance === null) return;
            const ops: EntityCommandOps<typeof selectedInstance> = {
              upsert: (i) => layoutStore.getState().upsertRackInstance(i),
              remove: (id) => layoutStore.getState().removeRackInstance(id),
            };
            commitCommand(historyStore, createUpsertCommand(ops, { ...selectedInstance, bays, updatedAt: nowIsoTimestamp() }, selectedInstance));
          }}
          onRecomputeConfiguration={(next: { configurationType: ConfigurationType; rackColumns: number }) => {
            if (selectedInstance === null) return;
            const levelDefsResult = resolveLevelDefinitions(next.configurationType, selectedTemplate?.palletLevels ?? 1);
            if (levelDefsResult.kind === "error") {
              window.alert(levelDefsResult.message);
              return;
            }
            const ops: EntityCommandOps<typeof selectedInstance> = {
              upsert: (i) => layoutStore.getState().upsertRackInstance(i),
              remove: (id) => layoutStore.getState().removeRackInstance(id),
            };
            commitCommand(
              historyStore,
              createUpsertCommand(
                ops,
                { ...selectedInstance, configurationType: next.configurationType, rackColumns: next.rackColumns, updatedAt: nowIsoTimestamp() },
                selectedInstance,
              ),
            );
          }}
          onComponentColorOverrideChange={(component: ComponentType, color) => {
            if (selectedInstance === null) return;
            const ops: EntityCommandOps<typeof selectedInstance> = {
              upsert: (i) => layoutStore.getState().upsertRackInstance(i),
              remove: (id) => layoutStore.getState().removeRackInstance(id),
            };
            const nextOverrides = { ...selectedInstance.componentColorOverrides, [component]: color };
            commitCommand(
              historyStore,
              createUpsertCommand(ops, { ...selectedInstance, componentColorOverrides: nextOverrides, updatedAt: nowIsoTimestamp() }, selectedInstance),
            );
          }}
        />
      </div>
      <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--color-text-muted)", borderTop: "1px solid var(--color-border)" }}>
        {`Tool: ${activeToolId ?? "none"} — Selected: ${selectedIds.size}`}
      </div>
    </div>
  );
}
