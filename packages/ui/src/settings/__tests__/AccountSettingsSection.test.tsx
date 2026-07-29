import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppStoresProvider } from "../../app/stores.js";
import { AccountSettingsSection } from "../AccountSettingsSection.js";

function renderSection() {
  return render(
    <AppStoresProvider databaseName={`test-account-settings-${Math.random()}`}>
      <AccountSettingsSection />
    </AppStoresProvider>,
  );
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
