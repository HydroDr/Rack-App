/**
 * Hosts the canvas renderer + toolbar + panels (Spec §6.3, §6.3.1-§6.3.4).
 *
 * Coordinate/interaction scope for Phase 4: click-to-place (after picking
 * a template in TemplatePanel) rather than full drag-and-drop, and simple
 * prompt()-based inputs for Array/Repeat count and Mirror axis position.
 * These are intentional MVP simplifications flagged for refinement once
 * this is visible and Juan can react to how it actually feels to use —
 * not a substitute for the real interaction design.
 *
 * Pan/zoom (Phase 7, Spec §6.3): the view transform (viewTransform.zoom/
 * panX/panY) lives on `app.stage` — `scene.root` (rebuilt fresh every
 * render by renderScene()) carries no transform of its own. Every
 * screen<->world conversion (screenToWorldIn, the zone-drag preview
 * overlay) must go through the current transform, never the bare
 * PIXELS_PER_INCH constant directly, or tool placement/zone drawing/
 * selection will misfire the moment the canvas is panned or zoomed.
 *
 * Every mutating action here goes through commandStack (placeTemplate,
 * applyArrayRepeat, mirrorSelection, createPathLaneTool, and the generic
 * commitCommand for Properties Panel edits) — this file never calls
 * layoutStore's upsert/remove actions directly.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { collectInstanceWarnings, type InstanceWarning } from "./warningsEngine.js";
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
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 1.1;

interface ViewTransform {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

function isEditableElement(element: Element | null): boolean {
  if (element === null) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (element as HTMLElement).isContentEditable;
}

export function CanvasTab({ templates, variants, palletProfiles }: CanvasTabProps) {
  const navigate = useNavigate();
  const { layoutStore, historyStore } = useAppStores();
  const rackInstances = useLayoutStore((state) => state.rackInstances);
  const warehouseElements = useLayoutStore((state) => state.warehouseElements);
  const pathLanes = useLayoutStore((state) => state.pathLanes);
  const groupLayers = useLayoutStore((state) => state.groupLayers);
  const protectorPlacements = useLayoutStore((state) => state.protectorPlacements);
  const selectedIds = useLayoutStore((state) => state.selectedIds);
  const gridColor = useUiPreferencesStore((state) => state.gridColor);
  const defaultAnchorsPerUpright = useUiPreferencesStore((state) => state.defaultAnchorsPerUpright);
  const defaultCapacityMarginLb = useUiPreferencesStore((state) => state.defaultCapacityMarginLb);
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
  const [isWarningsPanelOpen, setIsWarningsPanelOpen] = useState(false);

  const [viewTransform, setViewTransform] = useState<ViewTransform>({ zoom: 1, panX: 0, panY: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startScreenX: number; startScreenY: number; startPanX: number; startPanY: number } | null>(null);
  const effectiveScale = PIXELS_PER_INCH * viewTransform.zoom;

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

  // Spacebar-held pan mode, tracked globally (not scoped to the canvas div) so releasing the
  // key anywhere still ends panning. Ignored while typing into a form control, so a designer
  // typing "Fast Movers" into a Zone-name prompt doesn't accidentally arm panning on each space.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.code !== "Space" || isEditableElement(document.activeElement)) return;
      event.preventDefault();
      setIsSpacePressed(true);
    }
    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code !== "Space") return;
      setIsSpacePressed(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Mouse-wheel zoom, centered on the cursor. Attached as a native, non-passive listener —
  // React's synthetic onWheel is passive by default, so event.preventDefault() inside it
  // wouldn't actually stop the page from scrolling underneath the canvas.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      const rect = container!.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const zoomFactor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;

      setViewTransform((current) => {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * zoomFactor));
        const oldScale = PIXELS_PER_INCH * current.zoom;
        const newScale = PIXELS_PER_INCH * nextZoom;
        const worldX = (cursorX - current.panX) / oldScale;
        const worldY = (cursorY - current.panY) / oldScale;
        return { zoom: nextZoom, panX: cursorX - worldX * newScale, panY: cursorY - worldY * newScale };
      });
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
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

  const instanceWarnings = useMemo((): readonly InstanceWarning[] => {
    const warnings: InstanceWarning[] = [];
    for (const { instance, template, ratioDepthIn } of renderInputs) {
      const palletProfile = palletProfiles.find((profile) => profile.id === template.palletProfileId);
      if (palletProfile === undefined) continue;
      warnings.push(...collectInstanceWarnings(instance, template, palletProfile, ratioDepthIn, defaultCapacityMarginLb));
    }
    return warnings;
  }, [renderInputs, palletProfiles, defaultCapacityMarginLb]);

  useEffect(() => {
    const app = appRef.current;
    if (app === null) return;
    const scene = renderScene({
      grid: { widthIn: fromInches(6000), heightIn: fromInches(3000), intervalIn: fromInches(120), color: gridColor },
      warehouseElements: Array.from(warehouseElements.values()),
      rackInstances: renderInputs,
      pathLanes: Array.from(pathLanes.values()),
    });
    app.stage.scale.set(effectiveScale);
    app.stage.position.set(viewTransform.panX, viewTransform.panY);
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
    return {
      xIn: fromInches((localX - viewTransform.panX) / effectiveScale),
      yIn: fromInches((localY - viewTransform.panY) / effectiveScale),
    };
  }

  /** Inverse of screenToWorldIn — used by screen-space overlays (the zone-drag preview) so they track the canvas under the current pan/zoom instead of drifting from it. */
  function worldInToScreenPx(xIn: ReturnType<typeof fromInches>, yIn: ReturnType<typeof fromInches>): { x: number; y: number } {
    return {
      x: toInches(xIn) * effectiveScale + viewTransform.panX,
      y: toInches(yIn) * effectiveScale + viewTransform.panY,
    };
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

  /** Middle mouse button, or spacebar held with the left button — Spec §6.3's pan gesture. */
  function isPanTrigger(event: React.MouseEvent<HTMLDivElement>): boolean {
    return event.button === 1 || (event.button === 0 && isSpacePressed);
  }

  function handleCanvasMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    if (isPanTrigger(event)) {
      event.preventDefault();
      panStateRef.current = { startScreenX: event.clientX, startScreenY: event.clientY, startPanX: viewTransform.panX, startPanY: viewTransform.panY };
      setIsPanning(true);
      return;
    }
    if (activeToolId !== "zone") return;
    const point = screenToWorldIn(event);
    setZoneDragStart(point);
    setZoneDragCurrent(point);
  }

  function handleCanvasMouseMove(event: React.MouseEvent<HTMLDivElement>): void {
    const panState = panStateRef.current;
    if (panState !== null) {
      const dx = event.clientX - panState.startScreenX;
      const dy = event.clientY - panState.startScreenY;
      setViewTransform((current) => ({ ...current, panX: panState.startPanX + dx, panY: panState.startPanY + dy }));
      return;
    }
    if (activeToolId !== "zone" || zoneDragStart === null) return;
    setZoneDragCurrent(screenToWorldIn(event));
  }

  function handleCanvasMouseUp(event: React.MouseEvent<HTMLDivElement>): void {
    if (panStateRef.current !== null) {
      panStateRef.current = null;
      setIsPanning(false);
      return;
    }
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

  /**
   * Captures a static snapshot of what renderScene() already drew to the
   * canvas — never re-implements rack drawing (Spec §6.3c, carried over
   * from the Phase 4 review). Goes through the renderer's extract system
   * (renderer.extract.canvas(...).toDataURL()) rather than reading
   * app.canvas directly: a raw WebGL canvas's own toDataURL() can return a
   * blank image unless the context was created with preserveDrawingBuffer,
   * which this app doesn't set — extract.canvas() handles the readback
   * correctly regardless of renderer backend.
   */
  async function handleExportPdf(): Promise<void> {
    setPdfExportError(null);
    const app = appRef.current;
    if (app === null) return;
    const extractedCanvas = app.renderer.extract.canvas(app.stage);
    if (extractedCanvas.toDataURL === undefined) {
      setPdfExportError("This browser can't read back the canvas as an image.");
      return;
    }
    const snapshot: CanvasSnapshot = {
      imageDataUrl: extractedCanvas.toDataURL("image/png"),
      widthPx: extractedCanvas.width,
      heightPx: extractedCanvas.height,
    };
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
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{Math.round(viewTransform.zoom * 100)}%</span>
        <button type="button" onClick={() => setViewTransform({ zoom: 1, panX: 0, panY: 0 })}>
          Reset View
        </button>
        {instanceWarnings.length > 0 && (
          <button
            type="button"
            onClick={() => setIsWarningsPanelOpen((open) => !open)}
            style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 4, padding: "4px 10px" }}
          >
            ⚠ {instanceWarnings.length} warning{instanceWarnings.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
      {isWarningsPanelOpen && instanceWarnings.length > 0 && (
        <div
          role="alert"
          style={{ padding: "8px 12px", background: "#fffbeb", borderBottom: "1px solid #f59e0b", maxHeight: 160, overflowY: "auto" }}
        >
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {instanceWarnings.map((warning, index) => (
              <li key={`${warning.instanceId}-${warning.code}-${index}`}>
                <strong>{warning.code}:</strong> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <TemplatePanel
          templates={templates}
          variants={variants}
          activePalletProfileIds={new Set()}
          onSelectTemplate={(templateId) => setSelectedTemplateId(templateId)}
          onEditTemplate={(templateId) => navigate(`/templates/${templateId}/edit`)}
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
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: "#f4f5f7",
            cursor: isPanning ? "grabbing" : isSpacePressed ? "grab" : undefined,
          }}
        >
          {zoneDragStart !== null &&
            zoneDragCurrent !== null &&
            (() => {
              const startPx = worldInToScreenPx(zoneDragStart.xIn, zoneDragStart.yIn);
              const currentPx = worldInToScreenPx(zoneDragCurrent.xIn, zoneDragCurrent.yIn);
              return (
                <div
                  data-testid="zone-drag-preview"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    border: "1px dashed #2684ff",
                    background: "rgba(38, 132, 255, 0.1)",
                    left: Math.min(startPx.x, currentPx.x),
                    top: Math.min(startPx.y, currentPx.y),
                    width: Math.abs(currentPx.x - startPx.x),
                    height: Math.abs(currentPx.y - startPx.y),
                  }}
                />
              );
            })()}
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
