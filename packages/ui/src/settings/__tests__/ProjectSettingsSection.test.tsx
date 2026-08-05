import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Project } from "@rack-app/state";
import { AppStoresProvider, useAppStores, type AppStores } from "../../app/stores.js";
import { ProjectSettingsSection } from "../ProjectSettingsSection.js";

const now = "2024-01-01T00:00:00.000Z";

const project: Project = {
  id: "project-1" as never,
  name: "Aisle A Retrofit",
  clientName: "Acme Foods",
  createdAt: now,
  updatedAt: now,
  schemaVersion: 1,
};

const SAMPLE_DXF = `0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
RACK-OUTLINE
0
ENDTAB
0
ENDSEC
0
EOF
`;

function StoresCapture({ onReady }: { onReady: (stores: AppStores) => void }) {
  const stores = useAppStores();
  useEffect(() => {
    onReady(stores);
  }, [stores, onReady]);
  return null;
}

function makeDxfFile(): File {
  return new File([SAMPLE_DXF], "styles.dxf", { type: "application/dxf" });
}

describe("ProjectSettingsSection — Spec §6.6: DXF style import is a read-only TABLES-only preview", () => {
  it("shows a placeholder until a project is selected", () => {
    render(
      <AppStoresProvider databaseName={`test-project-settings-${Math.random()}`}>
        <ProjectSettingsSection projectId={"missing-project" as never} />
      </AppStoresProvider>,
    );
    expect(screen.getByText(/select a project/i)).toBeInTheDocument();
  });

  it("parses an uploaded DXF's TABLES section and displays the layer names, without any geometry-shaped output", async () => {
    let stores: AppStores | undefined;

    render(
      <AppStoresProvider databaseName={`test-project-settings-${Math.random()}`}>
        <StoresCapture
          onReady={(s) => {
            stores = s;
          }}
        />
        <ProjectSettingsSection projectId={project.id} />
      </AppStoresProvider>,
    );

    await waitFor(() => expect(stores).toBeDefined());
    act(() => {
      stores!.projectStore.getState().upsertProject(project);
    });

    await waitFor(() => expect(screen.getByText(/aisle a retrofit/i)).toBeInTheDocument());

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [makeDxfFile()] } });

    await waitFor(() => expect(screen.getByText(/RACK-OUTLINE/)).toBeInTheDocument());
  });

  it("surfaces a malformed DXF as an error message rather than failing silently", async () => {
    let stores: AppStores | undefined;

    render(
      <AppStoresProvider databaseName={`test-project-settings-${Math.random()}`}>
        <StoresCapture
          onReady={(s) => {
            stores = s;
          }}
        />
        <ProjectSettingsSection projectId={project.id} />
      </AppStoresProvider>,
    );

    await waitFor(() => expect(stores).toBeDefined());
    act(() => {
      stores!.projectStore.getState().upsertProject(project);
    });
    await waitFor(() => expect(screen.getByText(/aisle a retrofit/i)).toBeInTheDocument());

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["not a dxf file"], "broken.dxf", { type: "application/dxf" });
    fireEvent.change(input, { target: { files: [badFile] } });

    await waitFor(() => expect(screen.getByText(/no readable DXF tag pairs/i)).toBeInTheDocument());
  });
});
