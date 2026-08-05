/**
 * Dockable, customizable tool categories + quick-menu, plus the
 * precision-tools cluster (Grid Snap / Ortho / Object Snap) living
 * alongside it (Spec §6.3.1, §6.3.1a).
 *
 * Deliberately performs no layoutStore mutations of any kind — it never
 * even imports layoutStore. Tool selection and snap settings are reported
 * upward via callback props; the parent (CanvasTab) is what actually
 * routes a tool's resulting action through commandStack. This is a
 * structural guarantee, not just a convention (Engineering File Plan §5.2,
 * §6.3).
 */

import { useUiPreferencesStore } from "../app/stores.js";
import type { ToolbarPosition } from "@rack-app/state";

export type ToolCategory = "selectionNavigation" | "drawingStructure" | "measurement" | "annotation";
export type ToolId = "select" | "place" | "arrayRepeat" | "mirror" | "pathLane" | "wall" | "buildingColumn" | "dockDoor" | "door" | "zone";

interface ToolDefinition {
  readonly id: ToolId;
  readonly label: string;
  readonly category: ToolCategory;
}

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  { id: "select", label: "Select", category: "selectionNavigation" },
  { id: "place", label: "Place Template", category: "drawingStructure" },
  { id: "arrayRepeat", label: "Array/Repeat", category: "drawingStructure" },
  { id: "mirror", label: "Mirror", category: "drawingStructure" },
  { id: "pathLane", label: "Path/Lane", category: "drawingStructure" },
  { id: "zone", label: "Draw Zone", category: "drawingStructure" },
  { id: "wall", label: "Wall", category: "drawingStructure" },
  { id: "buildingColumn", label: "Building Column", category: "drawingStructure" },
  { id: "dockDoor", label: "Dock Door", category: "drawingStructure" },
  { id: "door", label: "Door", category: "drawingStructure" },
];

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  selectionNavigation: "Selection/Navigation",
  drawingStructure: "Drawing/Structure",
  measurement: "Measurement",
  annotation: "Annotation",
};

export interface SnapSettings {
  readonly gridSnapEnabled: boolean;
  readonly orthoModeEnabled: boolean;
  readonly objectSnapEnabled: boolean;
}

export interface ToolbarProps {
  readonly activeToolId: ToolId | null;
  readonly onSelectTool: (toolId: ToolId) => void;
  readonly snapSettings: SnapSettings;
  readonly onChangeSnapSettings: (next: SnapSettings) => void;
}

export function Toolbar({ activeToolId, onSelectTool, snapSettings, onChangeSnapSettings }: ToolbarProps) {
  const toolbarPosition = useUiPreferencesStore((state) => state.toolbarPosition);
  const setToolbarPosition = useUiPreferencesStore((state) => state.setToolbarPosition);
  const visibleCategories = useUiPreferencesStore((state) => state.toolbarVisibleCategories);
  const toggleCategory = useUiPreferencesStore((state) => state.toggleToolbarCategory);
  const quickMenuTools = useUiPreferencesStore((state) => state.quickMenuTools);
  const addToQuickMenu = useUiPreferencesStore((state) => state.addToQuickMenu);

  const isHorizontal = toolbarPosition === "top" || toolbarPosition === "bottom";

  return (
    <div
      role="toolbar"
      style={{
        display: "flex",
        flexDirection: isHorizontal ? "row" : "column",
        flexWrap: "wrap",
        gap: 12,
        padding: 8,
        background: "var(--color-surface)",
        borderBottom: toolbarPosition === "top" ? "1px solid var(--color-border)" : undefined,
        alignItems: "center",
      }}
    >
      <label>
        Dock:{" "}
        <select value={toolbarPosition} onChange={(event) => setToolbarPosition(event.target.value as ToolbarPosition)}>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>

      <div>
        {(Object.keys(CATEGORY_LABELS) as ToolCategory[]).map((category) => (
          <label key={category} style={{ marginRight: 8, fontSize: 13 }}>
            <input type="checkbox" checked={visibleCategories.has(category)} onChange={() => toggleCategory(category)} /> {CATEGORY_LABELS[category]}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        {TOOL_DEFINITIONS.filter((tool) => visibleCategories.has(tool.category)).map((tool) => (
          <button
            key={tool.id}
            aria-pressed={activeToolId === tool.id}
            onClick={() => onSelectTool(tool.id)}
            style={{ fontWeight: activeToolId === tool.id ? 700 : 400 }}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {quickMenuTools.length > 0 && (
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Quick:</span>
          {quickMenuTools.map((toolId) => {
            const tool = TOOL_DEFINITIONS.find((definition) => definition.id === toolId);
            if (tool === undefined) return null;
            return (
              <button key={toolId} onClick={() => onSelectTool(tool.id)}>
                {tool.label}
              </button>
            );
          })}
        </div>
      )}

      <button disabled={activeToolId === null} onClick={() => activeToolId !== null && addToQuickMenu(activeToolId)}>
        Add to quick menu
      </button>

      <div style={{ display: "flex", gap: 10, borderLeft: "1px solid var(--color-border)", paddingLeft: 10 }}>
        <label>
          <input
            type="checkbox"
            checked={snapSettings.gridSnapEnabled}
            onChange={(event) => onChangeSnapSettings({ ...snapSettings, gridSnapEnabled: event.target.checked })}
          />{" "}
          Grid Snap
        </label>
        <label>
          <input
            type="checkbox"
            checked={snapSettings.orthoModeEnabled}
            onChange={(event) => onChangeSnapSettings({ ...snapSettings, orthoModeEnabled: event.target.checked })}
          />{" "}
          Ortho
        </label>
        <label>
          <input
            type="checkbox"
            checked={snapSettings.objectSnapEnabled}
            onChange={(event) => onChangeSnapSettings({ ...snapSettings, objectSnapEnabled: event.target.checked })}
          />{" "}
          Object Snap
        </label>
      </div>
    </div>
  );
}
