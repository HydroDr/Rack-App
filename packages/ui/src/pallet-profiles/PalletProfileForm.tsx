/**
 * Pallet Profile creation form (Spec §2.2, §6.5) — name, depth, width,
 * height, weight. Without this, no Template can be created (every Rack
 * Template requires a palletProfileId), so this is deliberately its own
 * small, reusable component rather than folded into Dashboard or the
 * Template Editor: both need a way to create one on the spot.
 *
 * Renders as a collapsed "+ New Pallet Profile" trigger by default and
 * expands into the form inline — no dedicated route/modal machinery
 * needed for five fields.
 */

import { useState } from "react";
import { fromInches, weightLb } from "@rack-app/rules-engine";
import { createPalletProfile, type PalletProfile } from "@rack-app/state";
import { useAppStores } from "../app/stores.js";

export interface PalletProfileFormProps {
  readonly onCreated: (profile: PalletProfile) => void;
}

export function PalletProfileForm({ onCreated }: PalletProfileFormProps) {
  const { repositories } = useAppStores();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [depthIn, setDepthIn] = useState(48);
  const [widthIn, setWidthIn] = useState(40);
  const [heightIn, setHeightIn] = useState(6);
  const [weightLbValue, setWeightLbValue] = useState(2000);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function resetForm(): void {
    setName("");
    setDepthIn(48);
    setWidthIn(40);
    setHeightIn(6);
    setWeightLbValue(2000);
    setError(null);
  }

  async function handleCreate(): Promise<void> {
    setError(null);
    const result = createPalletProfile({
      name,
      depthIn: fromInches(depthIn),
      widthIn: fromInches(widthIn),
      heightIn: fromInches(heightIn),
      weightLb: weightLb(weightLbValue),
    });
    if (result.kind === "error") {
      setError(result.message);
      return;
    }

    setIsSaving(true);
    const saveResult = await repositories.palletProfiles.save(result.value);
    setIsSaving(false);
    if (saveResult.kind === "error") {
      setError(saveResult.message);
      return;
    }

    onCreated(result.value);
    resetForm();
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)}>
        + New Pallet Profile
      </button>
    );
  }

  return (
    <fieldset style={{ maxWidth: 320 }}>
      <legend>New Pallet Profile</legend>

      <label style={{ display: "block", marginBottom: 6 }}>
        Name: <input value={name} onChange={(event) => setName(event.target.value)} style={{ width: "100%" }} />
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        Depth (in): <input type="number" value={depthIn} onChange={(event) => setDepthIn(Number(event.target.value))} />
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        Width (in): <input type="number" value={widthIn} onChange={(event) => setWidthIn(Number(event.target.value))} />
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        Height (in): <input type="number" value={heightIn} onChange={(event) => setHeightIn(Number(event.target.value))} />
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        Weight (lb): <input type="number" value={weightLbValue} onChange={(event) => setWeightLbValue(Number(event.target.value))} />
      </label>

      {error !== null && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" disabled={isSaving} onClick={() => void handleCreate()}>
          Create
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </fieldset>
  );
}
