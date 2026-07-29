import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppStoresProvider } from "../../app/stores.js";
import { Toolbar, type SnapSettings } from "../Toolbar.js";

const baseSnapSettings: SnapSettings = { gridSnapEnabled: true, orthoModeEnabled: false, objectSnapEnabled: false };

describe("canvas-ui/Toolbar.tsx — Engineering File Plan §5.2, §6.3: must never mutate layoutStore directly", () => {
  it("never imports layoutStore/useLayoutStore at all — a structural guarantee, not just a behavioral one", () => {
    const source = readFileSync(join(process.cwd(), "src", "canvas-ui", "Toolbar.tsx"), "utf-8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\*.*$/gm, "");
    expect(codeOnly).not.toMatch(/useLayoutStore|layoutStore/);
  });

  it("clicking a tool only calls onSelectTool — never reaches into any store to mutate rack instances", () => {
    const onSelectTool = vi.fn();
    const onChangeSnapSettings = vi.fn();

    render(
      <AppStoresProvider databaseName={`test-toolbar-${Math.random()}`}>
        <Toolbar activeToolId={null} onSelectTool={onSelectTool} snapSettings={baseSnapSettings} onChangeSnapSettings={onChangeSnapSettings} />
      </AppStoresProvider>,
    );

    screen.getByText("Place Template").click();
    expect(onSelectTool).toHaveBeenCalledWith("place");
  });

  it("toggling a snap setting only calls onChangeSnapSettings, with the updated flag", () => {
    const onSelectTool = vi.fn();
    const onChangeSnapSettings = vi.fn();

    render(
      <AppStoresProvider databaseName={`test-toolbar-${Math.random()}`}>
        <Toolbar activeToolId={null} onSelectTool={onSelectTool} snapSettings={baseSnapSettings} onChangeSnapSettings={onChangeSnapSettings} />
      </AppStoresProvider>,
    );

    screen.getByLabelText("Ortho").click();
    expect(onChangeSnapSettings).toHaveBeenCalledWith({ ...baseSnapSettings, orthoModeEnabled: true });
  });
});
