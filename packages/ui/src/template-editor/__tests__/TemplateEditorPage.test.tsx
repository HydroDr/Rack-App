import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fromInches } from "@rack-app/rules-engine";
import { CURRENT_SCHEMA_VERSION, generateId, nowIsoTimestamp, type PalletProfile, type RackTemplate } from "@rack-app/state";
import { AppStoresProvider, useAppStores, type AppStores } from "../../app/stores.js";
import { TemplateEditorPage } from "../TemplateEditorPage.js";

// FrontViewCanvas mounts a real PixiJS Application, which fails to fully initialize in
// jsdom (no WebGL/Canvas2D context) — matches the established pattern elsewhere in this
// codebase of not full-mounting PixiJS-touching components in unit tests. This test is
// about the form's load/save behavior, not the front-view drawing, so it's stubbed out.
vi.mock("../FrontViewCanvas.js", () => ({ FrontViewCanvas: () => null }));

function StoresCapture({ onReady }: { onReady: (stores: AppStores) => void }) {
  const stores = useAppStores();
  useEffect(() => {
    onReady(stores);
  }, [stores, onReady]);
  return null;
}

function makePalletProfile(): PalletProfile {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    name: "Standard 48x40",
    depthIn: fromInches(40),
    widthIn: fromInches(48),
    heightIn: fromInches(6),
    weightLb: 1500 as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function makeTemplate(palletProfileId: RackTemplate["palletProfileId"], overrides: Partial<RackTemplate> = {}): RackTemplate {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    templateType: "rack",
    name: "Existing Rack",
    componentColors: {},
    palletProfileId,
    palletLevels: 3,
    palletHeightIn: fromInches(48),
    clearanceIn: fromInches(4),
    frameDepthIn: fromInches(42),
    beamLengthIn: fromInches(96),
    levelCapacitiesLb: [4000, 4000, 4000] as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...overrides,
  };
}

function renderAt(path: string, databaseName: string) {
  let stores: AppStores | undefined;
  const utils = render(
    <AppStoresProvider databaseName={databaseName}>
      <StoresCapture
        onReady={(s) => {
          stores = s;
        }}
      />
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/templates/new" element={<TemplateEditorPage />} />
          <Route path="/templates/:templateId/edit" element={<TemplateEditorPage />} />
        </Routes>
      </MemoryRouter>
    </AppStoresProvider>,
  );
  return { ...utils, getStores: () => stores };
}

describe("TemplateEditorPage — Phase 7: load and edit an existing template", () => {
  it("the create route starts with default fields and a 'Save as Template' button", () => {
    const databaseName = `test-template-editor-${Math.random()}`;
    renderAt("/templates/new", databaseName);
    expect(screen.getByText("Template Editor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save as template/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Selective Rack Template")).toBeInTheDocument();
  });

  it("the edit route loads an existing template's fields and shows 'Save Changes'", async () => {
    const databaseName = `test-template-editor-${Math.random()}`;
    const seed = renderAt("/templates/new", databaseName);
    await waitFor(() => expect(seed.getStores()).toBeDefined());
    const { repositories } = seed.getStores()!;

    const palletProfile = makePalletProfile();
    await repositories.palletProfiles.save(palletProfile);
    const template = makeTemplate(palletProfile.id, { capacityMarginLb: 250 as never });
    await repositories.templates.saveTemplate(template);
    seed.unmount();

    renderAt(`/templates/${template.id}/edit`, databaseName);

    await waitFor(() => expect(screen.getByText(/edit template — existing rack/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing Rack")).toBeInTheDocument();
    expect(screen.getByDisplayValue("250")).toBeInTheDocument();
  });

  it("saving an edit updates the existing record instead of creating a duplicate", async () => {
    const databaseName = `test-template-editor-${Math.random()}`;
    const seed = renderAt("/templates/new", databaseName);
    await waitFor(() => expect(seed.getStores()).toBeDefined());
    const { repositories } = seed.getStores()!;

    const palletProfile = makePalletProfile();
    await repositories.palletProfiles.save(palletProfile);
    const template = makeTemplate(palletProfile.id);
    await repositories.templates.saveTemplate(template);
    seed.unmount();

    renderAt(`/templates/${template.id}/edit`, databaseName);
    await waitFor(() => expect(screen.getByDisplayValue("Existing Rack")).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue("Existing Rack"), { target: { value: "Renamed Rack" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    const listResult = await repositories.templates.listTemplates();
    if (listResult.kind === "error") throw new Error("unreachable");
    expect(listResult.value).toHaveLength(1);
    expect(listResult.value[0]!.name).toBe("Renamed Rack");
    expect(listResult.value[0]!.id).toBe(template.id);
  });
});
