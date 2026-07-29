/**
 * Top-level Template Editor screen (Spec §6.4.1): defines front-view
 * geometry (levels, beams, uprights, vertical clearances), per-component
 * color, and "Save as Template" locks the definition in, making it
 * available in the Template Panel.
 *
 * Phase 4 scope: creates a new Rack Template. Loading an existing
 * template by id for editing isn't wired yet — a reasonable follow-up,
 * not built now given the size of this phase.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fromInches } from "@rack-app/rules-engine";
import { createRackTemplate, type ComponentColorMap, type EntityId, type PalletProfile } from "@rack-app/state";
import { useAppStores } from "../app/stores.js";
import { FrontViewCanvas } from "./FrontViewCanvas.js";
import { ComponentColorPicker } from "./ComponentColorPicker.js";

const DEFAULT_CEILING_CLEARANCE_IN = 24;

export function TemplateEditorPage() {
  const { repositories } = useAppStores();
  const navigate = useNavigate();

  const [palletProfiles, setPalletProfiles] = useState<readonly PalletProfile[]>([]);
  const [name, setName] = useState("New Selective Rack Template");
  const [palletProfileId, setPalletProfileId] = useState<EntityId | "">("");
  const [palletLevels, setPalletLevels] = useState(4);
  const [palletHeightIn, setPalletHeightIn] = useState(52);
  const [clearanceIn, setClearanceIn] = useState(4);
  const [frameDepthIn, setFrameDepthIn] = useState(42);
  const [beamLengthIn, setBeamLengthIn] = useState(96);
  const [levelCapacityLb, setLevelCapacityLb] = useState(2500);
  const [ceilingHeightIn, setCeilingHeightIn] = useState(300);
  const [componentColors, setComponentColors] = useState<ComponentColorMap>({});

  useEffect(() => {
    void repositories.palletProfiles.list().then((result) => {
      if (result.kind !== "error") setPalletProfiles(result.value);
    });
  }, [repositories]);

  async function handleSave(): Promise<void> {
    if (palletProfileId === "") {
      window.alert("Pick a pallet profile first.");
      return;
    }

    const result = createRackTemplate({
      templateType: "rack",
      name,
      componentColors,
      palletProfileId,
      palletLevels,
      palletHeightIn: fromInches(palletHeightIn),
      clearanceIn: fromInches(clearanceIn),
      frameDepthIn: fromInches(frameDepthIn),
      beamLengthIn: fromInches(beamLengthIn),
      levelCapacitiesLb: Array.from({ length: palletLevels }, () => levelCapacityLb) as never,
    });
    if (result.kind === "error") {
      window.alert(result.message);
      return;
    }

    const saveResult = await repositories.templates.saveTemplate(result.value);
    if (saveResult.kind === "error") {
      window.alert(saveResult.message);
      return;
    }

    navigate(-1);
  }

  return (
    <div style={{ display: "flex", gap: 24, padding: 24 }}>
      <div style={{ flex: 1, maxWidth: 420 }}>
        <h1>Template Editor</h1>

        <label style={{ display: "block", marginBottom: 8 }}>
          Name: <input value={name} onChange={(event) => setName(event.target.value)} style={{ width: "100%" }} />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Pallet Profile:{" "}
          <select value={palletProfileId} onChange={(event) => setPalletProfileId(event.target.value as EntityId)}>
            <option value="">Select…</option>
            {palletProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset style={{ marginBottom: 8 }}>
          <legend>Geometry (Spec §2.3)</legend>
          <label>
            Pallet levels: <input type="number" min={1} value={palletLevels} onChange={(event) => setPalletLevels(Number(event.target.value))} />
          </label>
          <br />
          <label>
            Pallet height (in): <input type="number" value={palletHeightIn} onChange={(event) => setPalletHeightIn(Number(event.target.value))} />
          </label>
          <br />
          <label>
            Overhead clearance (in): <input type="number" value={clearanceIn} onChange={(event) => setClearanceIn(Number(event.target.value))} />
          </label>
          <br />
          <label>
            Frame depth (in): <input type="number" value={frameDepthIn} onChange={(event) => setFrameDepthIn(Number(event.target.value))} />
          </label>
          <br />
          <label>
            Beam length (in): <input type="number" value={beamLengthIn} onChange={(event) => setBeamLengthIn(Number(event.target.value))} />
          </label>
          <br />
          <label>
            Level capacity (lb): <input type="number" value={levelCapacityLb} onChange={(event) => setLevelCapacityLb(Number(event.target.value))} />
          </label>
          <br />
          <label>
            Ceiling obstruction height (in): <input type="number" value={ceilingHeightIn} onChange={(event) => setCeilingHeightIn(Number(event.target.value))} />
          </label>
        </fieldset>

        <ComponentColorPicker colors={componentColors} onChange={(component, color) => setComponentColors({ ...componentColors, [component]: color })} />

        <button onClick={() => void handleSave()} style={{ marginTop: 12, padding: "8px 14px", background: "var(--color-accent)", color: "white", border: "none", borderRadius: 6 }}>
          Save as Template
        </button>
      </div>

      <FrontViewCanvas
        palletHeightIn={fromInches(palletHeightIn)}
        clearanceIn={fromInches(clearanceIn)}
        palletLevels={palletLevels}
        beamLengthIn={fromInches(beamLengthIn)}
        ceilingObstructionHeightIn={fromInches(ceilingHeightIn)}
        ceilingClearanceIn={fromInches(DEFAULT_CEILING_CLEARANCE_IN)}
      />
    </div>
  );
}
