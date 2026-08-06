import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { fromInches } from "@rack-app/rules-engine";
import type { ProtectorPlacement, RackInstance, RackTemplate } from "@rack-app/state";
import { PropertiesPanel } from "../PropertiesPanel.js";

const now = "2024-01-01T00:00:00.000Z";

function makeTemplate(overrides: Partial<RackTemplate> = {}): RackTemplate {
  return {
    id: "template-1" as never,
    templateType: "rack",
    name: "Selective Rack",
    componentColors: {},
    palletProfileId: "pallet-1" as never,
    palletLevels: 3,
    palletHeightIn: fromInches(52),
    clearanceIn: fromInches(4),
    frameDepthIn: fromInches(42),
    beamLengthIn: fromInches(96),
    levelCapacitiesLb: [2500, 2500, 2500] as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...overrides,
  };
}

function makeInstance(overrides: Partial<RackInstance> = {}): RackInstance {
  return {
    id: "instance-1" as never,
    layoutId: "layout-1" as never,
    templateId: "template-1" as never,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays: 5,
    configurationType: "backToBack",
    rackColumns: 2,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...overrides,
  };
}

function makeProtectorPlacement(overrides: Partial<ProtectorPlacement> = {}): ProtectorPlacement {
  return {
    id: "placement-1" as never,
    layoutId: "layout-1" as never,
    rackInstanceId: "instance-1" as never,
    lineEndProtectors: [
      { frontEnd: true, backEnd: false },
      { frontEnd: false, backEnd: false },
    ],
    columnProtectorUprightIndices: [0, 1],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...overrides,
  };
}

describe("canvas-ui/PropertiesPanel.tsx — Spec §3.1, §3.1b: protector placement toggles per instance", () => {
  it("renders one Front/Back row per rack column, all unchecked when there's no ProtectorPlacement yet", () => {
    render(
      <PropertiesPanel
        instance={makeInstance()}
        template={makeTemplate()}
        variant={null}
        ppo={40}
        protectorPlacement={undefined}
        onUpdateBays={vi.fn()}
        onRecomputeConfiguration={vi.fn()}
        onComponentColorOverrideChange={vi.fn()}
        onToggleLineEndProtector={vi.fn()}
        onSetColumnProtectorCount={vi.fn()}
      />,
    );

    expect(screen.getByText("Line 1:")).toBeInTheDocument();
    expect(screen.getByText("Line 2:")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox").filter((el) => el.closest("fieldset")?.textContent?.includes("Protectors"));
    expect(checkboxes.every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByLabelText(/column protectors/i)).toHaveValue(0);
  });

  it("reflects an existing ProtectorPlacement's flags and upright count", () => {
    render(
      <PropertiesPanel
        instance={makeInstance()}
        template={makeTemplate()}
        variant={null}
        ppo={40}
        protectorPlacement={makeProtectorPlacement()}
        onUpdateBays={vi.fn()}
        onRecomputeConfiguration={vi.fn()}
        onComponentColorOverrideChange={vi.fn()}
        onToggleLineEndProtector={vi.fn()}
        onSetColumnProtectorCount={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/column protectors/i)).toHaveValue(2);
    const line1Front = screen.getAllByText("Front")[0]!.closest("label")!.querySelector("input")!;
    expect(line1Front.checked).toBe(true);
  });

  it("toggling a Front checkbox calls onToggleLineEndProtector with the line index/side/value", () => {
    const onToggleLineEndProtector = vi.fn();
    render(
      <PropertiesPanel
        instance={makeInstance()}
        template={makeTemplate()}
        variant={null}
        ppo={40}
        protectorPlacement={undefined}
        onUpdateBays={vi.fn()}
        onRecomputeConfiguration={vi.fn()}
        onComponentColorOverrideChange={vi.fn()}
        onToggleLineEndProtector={onToggleLineEndProtector}
        onSetColumnProtectorCount={vi.fn()}
      />,
    );

    const line1Front = screen.getAllByText("Front")[0]!.closest("label")!.querySelector("input")!;
    fireEvent.click(line1Front);
    expect(onToggleLineEndProtector).toHaveBeenCalledWith(0, "frontEnd", true);
  });

  it("changing the column-protector count calls onSetColumnProtectorCount", () => {
    const onSetColumnProtectorCount = vi.fn();
    render(
      <PropertiesPanel
        instance={makeInstance()}
        template={makeTemplate()}
        variant={null}
        ppo={40}
        protectorPlacement={undefined}
        onUpdateBays={vi.fn()}
        onRecomputeConfiguration={vi.fn()}
        onComponentColorOverrideChange={vi.fn()}
        onToggleLineEndProtector={vi.fn()}
        onSetColumnProtectorCount={onSetColumnProtectorCount}
      />,
    );

    fireEvent.change(screen.getByLabelText(/column protectors/i), { target: { value: "3" } });
    expect(onSetColumnProtectorCount).toHaveBeenCalledWith(3);
  });
});
