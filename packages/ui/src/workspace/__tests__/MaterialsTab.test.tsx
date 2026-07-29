import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { fromInches } from "@rack-app/rules-engine";
import type { PalletProfile, RackInstance, RackTemplate } from "@rack-app/state";
import { AppStoresProvider, useAppStores, type AppStores } from "../../app/stores.js";
import { MaterialsTab } from "../MaterialsTab.js";

const now = "2024-01-01T00:00:00.000Z";

const template: RackTemplate = {
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
};

const palletProfile: PalletProfile = {
  id: "pallet-1" as never,
  name: "Standard GMA",
  depthIn: fromInches(48),
  widthIn: fromInches(40),
  heightIn: fromInches(52),
  weightLb: 2000 as never,
  createdAt: now,
  updatedAt: now,
  schemaVersion: 1,
};

function makeInstance(bays: number): RackInstance {
  return {
    id: "instance-1" as never,
    layoutId: "layout-1" as never,
    templateId: template.id,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays,
    configurationType: "single",
    rackColumns: 1,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

function StoresCapture({ onReady }: { onReady: (stores: AppStores) => void }) {
  const stores = useAppStores();
  useEffect(() => {
    onReady(stores);
  }, [stores, onReady]);
  return null;
}

describe("MaterialsTab — Engineering File Plan §6.2: must re-render from live layoutStore, never a cached count", () => {
  it("shows no materials before any instance exists, populates after one is added, and updates again after it's removed — all without remounting", async () => {
    let stores: AppStores | undefined;

    render(
      <AppStoresProvider databaseName={`test-materials-${Math.random()}`}>
        <StoresCapture
          onReady={(s) => {
            stores = s;
          }}
        />
        <MaterialsTab templates={[template]} palletProfiles={[palletProfile]} />
      </AppStoresProvider>,
    );

    await waitFor(() => expect(stores).toBeDefined());
    expect(screen.getByText(/no materials in this area yet/i)).toBeInTheDocument();

    act(() => {
      stores!.layoutStore.getState().loadLayout("layout-1" as never, {});
      stores!.layoutStore.getState().upsertRackInstance(makeInstance(5));
    });

    await waitFor(() => expect(screen.getByText("Uprights")).toBeInTheDocument());
    // Uprights = bays + 1 = 6, for a single-line config with 1 physical line.
    const uprightsRow = screen.getByText("Uprights").closest("tr");
    expect(uprightsRow).not.toBeNull();
    expect(uprightsRow!.textContent).toContain("6");

    act(() => {
      stores!.layoutStore.getState().upsertRackInstance(makeInstance(9));
    });

    await waitFor(() => {
      const row = screen.getByText("Uprights").closest("tr");
      expect(row!.textContent).toContain("10");
    });

    act(() => {
      stores!.layoutStore.getState().removeRackInstance("instance-1" as never);
    });

    await waitFor(() => expect(screen.getByText(/no materials in this area yet/i)).toBeInTheDocument());
  });
});
