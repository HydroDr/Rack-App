import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PalletProfile } from "@rack-app/state";
import { AppStoresProvider } from "../../app/stores.js";
import { PalletProfileForm } from "../PalletProfileForm.js";

describe("PalletProfileForm — Spec §2.2, §6.5: creates and saves a PalletProfile via the repository", () => {
  it("starts collapsed as a '+ New Pallet Profile' trigger", () => {
    render(
      <AppStoresProvider databaseName={`test-pallet-profile-${Math.random()}`}>
        <PalletProfileForm onCreated={vi.fn()} />
      </AppStoresProvider>,
    );
    expect(screen.getByRole("button", { name: /new pallet profile/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/name:/i)).toBeNull();
  });

  it("expands into a form, creates+saves a profile, and calls onCreated with the saved entity", async () => {
    const onCreated = vi.fn();
    render(
      <AppStoresProvider databaseName={`test-pallet-profile-${Math.random()}`}>
        <PalletProfileForm onCreated={onCreated} />
      </AppStoresProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /new pallet profile/i }));
    fireEvent.change(screen.getByLabelText(/name:/i), { target: { value: "Standard GMA" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const created = onCreated.mock.calls[0]![0] as PalletProfile;
    expect(created.name).toBe("Standard GMA");
    expect(created.depthIn).toBeGreaterThan(0);

    // Collapses back to the trigger after a successful create.
    await waitFor(() => expect(screen.getByRole("button", { name: /new pallet profile/i })).toBeInTheDocument());
  });

  it("surfaces a validation error (empty name) instead of silently failing, and does not call onCreated", async () => {
    const onCreated = vi.fn();
    render(
      <AppStoresProvider databaseName={`test-pallet-profile-${Math.random()}`}>
        <PalletProfileForm onCreated={onCreated} />
      </AppStoresProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /new pallet profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument());
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("cancel collapses the form without saving anything", () => {
    const onCreated = vi.fn();
    render(
      <AppStoresProvider databaseName={`test-pallet-profile-${Math.random()}`}>
        <PalletProfileForm onCreated={onCreated} />
      </AppStoresProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /new pallet profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByRole("button", { name: /new pallet profile/i })).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
