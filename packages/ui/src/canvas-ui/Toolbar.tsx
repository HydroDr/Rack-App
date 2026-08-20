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
  readonly icon: string;
}

/** Minimal geometric glyphs, not literal icon art — enough to give each tool button a distinct silhouette at a glance without pulling in an icon library. */
const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  { id: "select", label: "Select", category: "selectionNavigation", icon: "↖" },
  { id: "place", label: "Place Template", category: "drawingStructure", icon: "▦" },
  { id: "arrayRepeat", label: "Array/Repeat", category: "drawingStructure", icon: "▦▦" },
  { id: "mirror", label: "Mirror", category: "drawingStructure", icon: "⇋" },
  { id: "pathLane", label: "Path/Lane", category: "drawingStructure", icon: "⌁" },
  { id: "zone", label: "Draw Zone", category: "drawingStructure", icon: "▭" },
  { id: "wall", label: "Wall", category: "drawingStructure", icon: "▤" },
  { id: "buildingColumn", label: "Building Column", category: "drawingStructure", icon: "▮" },
  { id: "dockDoor", label: "Dock Door", category: "drawingStructure", icon: "⊟" },
  { id: "door", label: "Door", category: "drawingStructure", icon: "▯" },
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
        gap: "var(--space-md)",
        padding: "var(--space-sm)",
        background: "var(--color-bg-card)",
        borderBottom: toolbarPosition === "top" ? "1px solid var(--color-border)" : undefined,
        alignItems: "center",
      }}
    >
      <label style={{ fontSize: 13 }}>
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
          <label key={category} style={{ marginRight: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
            <input type="checkbox" checked={visibleCategories.has(category)} onChange={() => toggleCategory(category)} /> {CATEGORY_LABELS[category]}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 2 }}>
        {TOOL_DEFINITIONS.filter((tool) => visibleCategories.has(tool.category)).map((tool) => {
          const isActive = activeToolId === tool.id;
          return (
            <button
              key={tool.id}
              aria-pressed={isActive}
              onClick={() => onSelectTool(tool.id)}
              title={tool.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minWidth: 44,
                padding: "4px 6px",
                fontWeight: isActive ? 500 : 400,
                background: isActive ? "var(--color-accent-subtle)" : "transparent",
                border: isActive ? "1px solid var(--color-accent)" : "1px solid transparent",
                borderRadius: "var(--radius)",
                color: isActive ? "var(--color-accent)" : "var(--color-text-primary)",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>
                {tool.icon}
              </span>
              <span style={{ fontSize: 10, lineHeight: 1.1, whiteSpace: "nowrap" }}>{tool.label}</span>
            </button>
          );
        })}
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

      <button disabled={activeToolId === null} onClick={() => activeToolId !== null && addToQuickMenu(activeToolId)} style={{ fontSize: 12 }}>
        Add to quick menu
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginLeft: isHorizontal ? "auto" : undefined,
          padding: "4px 10px",
          background: "var(--color-bg-hover)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Snap</span>
        {(
          [
            ["Grid", snapSettings.gridSnapEnabled, "gridSnapEnabled"],
            ["Ortho", snapSettings.orthoModeEnabled, "orthoModeEnabled"],
            ["Object", snapSettings.objectSnapEnabled, "objectSnapEnabled"],
          ] as const
        ).map(([label, isEnabled, field]) => (
          <label
            key={field}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              padding: "3px 8px",
              borderRadius: "var(--radius)",
              border: isEnabled ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
              background: isEnabled ? "var(--color-accent)" : "transparent",
              color: isEnabled ? "var(--color-text-on-accent)" : "var(--color-text-secondary)",
            }}
          >
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(event) => onChangeSnapSettings({ ...snapSettings, [field]: event.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
