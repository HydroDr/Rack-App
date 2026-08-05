import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppStoresProvider } from "../../app/stores.js";
import { AccountSettingsSection } from "../AccountSettingsSection.js";

function renderSection() {
  return render(
    <AppStoresProvider databaseName={`test-account-settings-${Math.random()}`}>
      <AccountSettingsSection />
    </AppStoresProvider>,
  );
}

const SAMPLE_DXF_WITH_COLORS = `0
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
62
1
0
LAYER
2
DIMENSIONS
62
5
0
ENDTAB
0
ENDSEC
0
EOF
`;

function makeDxfFile(text: string = SAMPLE_DXF_WITH_COLORS): File {
  return new File([text], "styles.dxf", { type: "application/dxf" });
}

describe("AccountSettingsSection — Spec §2.5, §6.5: toppling threshold is read-only, not a free-text edit field", () => {
  it("renders the 6:1 threshold as plain text", () => {
    renderSection();
    expect(screen.getByText("6:1")).toBeInTheDocument();
  });

  it("has no form control (input/select/textarea) anywhere inside the read-only status readout", () => {
    renderSection();
    const readout = screen.getByRole("status");
    expect(readout.querySelector("input, select, textarea, [contenteditable]")).toBeNull();
  });

  it("the readout is marked aria-readonly", () => {
    renderSection();
    expect(screen.getByRole("status")).toHaveAttribute("aria-readonly", "true");
  });

  it("still renders other account settings as real editable controls (default anchors per upright)", () => {
    renderSection();
    expect(screen.getByLabelText(/default anchors per upright/i)).toBeInTheDocument();
  });
});

describe("AccountSettingsSection — Spec §6.6: DXF import applies layer colors to uiPreferencesStore, unlike ProjectSettingsSection's read-only preview", () => {
  it("applies the first two layers' ACI colors to Grid color and Annotation color", async () => {
    renderSection();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeDxfFile()] } });

    await waitFor(() => expect(screen.getByText(/applied 2 layer colors/i)).toBeInTheDocument());

    const gridColorInput = screen.getByLabelText(/grid color/i) as HTMLInputElement;
    const annotationColorInput = screen.getByLabelText(/annotation color/i) as HTMLInputElement;
    expect(gridColorInput.value).toBe("#ff0000"); // ACI 1 = red
    expect(annotationColorInput.value).toBe("#0000ff"); // ACI 5 = blue
  });

  it("lists the parsed layers/styles/linetypes for visibility even though only colors get applied", async () => {
    renderSection();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeDxfFile()] } });

    await waitFor(() => expect(screen.getByText(/RACK-OUTLINE/)).toBeInTheDocument());
    expect(screen.getByText(/DIMENSIONS/)).toBeInTheDocument();
  });

  it("surfaces a malformed DXF as a visible error instead of applying anything", async () => {
    renderSection();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeDxfFile("not a dxf file at all")] } });

    await waitFor(() => expect(screen.getByText(/no readable DXF tag pairs/i)).toBeInTheDocument());
  });
});
