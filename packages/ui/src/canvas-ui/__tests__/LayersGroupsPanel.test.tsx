import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LayersGroupsPanel } from "../LayersGroupsPanel.js";

describe("canvas-ui/LayersGroupsPanel.tsx — Spec §6.3.3: must never read or write Zone data", () => {
  it("never imports the Zone type/model at all", () => {
    const source = readFileSync(join(process.cwd(), "src", "canvas-ui", "LayersGroupsPanel.tsx"), "utf-8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\*.*$/gm, "");
    expect(codeOnly).not.toMatch(/\bZone\b/);
  });

  it("renders group names and toggles visibility/lock via callbacks only", () => {
    const onToggleVisibility = vi.fn();
    const onToggleLock = vi.fn();
    const group = {
      id: "group-1" as never,
      layoutId: "layout-1" as never,
      name: "Aisle A Racks",
      memberIds: [],
      visible: true,
      locked: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      schemaVersion: 1,
    };

    render(
      <LayersGroupsPanel
        groups={[group]}
        selectedGroupId={null}
        onSelectGroup={vi.fn()}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={onToggleLock}
      />,
    );

    expect(screen.getByText("Aisle A Racks")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes[0]!.click();
    expect(onToggleVisibility).toHaveBeenCalledWith("group-1");
  });
});
