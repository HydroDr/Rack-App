/**
 * Top-level Template Editor screen (Spec §6.4.1): defines front-view
 * geometry (levels, beams, uprights, vertical clearances), per-component
 * color, and "Save as Template" locks the definition in, making it
 * available in the Template Panel.
 *
 * Phase 7: also loads an existing Rack Template for editing when reached
 * via /templates/:templateId/edit — `existingTemplate` (the record as
 * loaded) is kept around purely to preserve its id/createdAt/schemaVersion
 * on save; every other field is free-form local form state exactly like
 * the create path. Saving an edit calls the same `saveTemplate()` upsert
 * repositories.templates already uses for creation (it's keyed by id), so
 * this never risks creating a duplicate record.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fromInches, toInches, weightLb } from "@rack-app/rules-engine";
import {
  createRackTemplate,
  nowIsoTimestamp,
  validateTemplate,
  type ComponentColorMap,
  type EntityId,
  type PalletProfile,
  type RackTemplate,
} from "@rack-app/state";
import { useAppStores } from "../app/stores.js";
import { PalletProfileForm } from "../pallet-profiles/PalletProfileForm.js";
import { FrontViewCanvas } from "./FrontViewCanvas.js";
import { ComponentColorPicker } from "./ComponentColorPicker.js";

const DEFAULT_CEILING_CLEARANCE_IN = 24;
/** Spec §3.1c default beam-capacity safety margin. */
const DEFAULT_CAPACITY_MARGIN_LB = 300;

export function TemplateEditorPage() {
  const { repositories } = useAppStores();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();

  const [existingTemplate, setExistingTemplate] = useState<RackTemplate | null>(null);
  const [palletProfiles, setPalletProfiles] = useState<readonly PalletProfile[]>([]);
  const [name, setName] = useState("New Selective Rack Template");
  const [palletProfileId, setPalletProfileId] = useState<EntityId | "">("");
  const [palletLevels, setPalletLevels] = useState(4);
  const [palletHeightIn, setPalletHeightIn] = useState(52);
  const [clearanceIn, setClearanceIn] = useState(4);
  const [frameDepthIn, setFrameDepthIn] = useState(42);
  const [beamLengthIn, setBeamLengthIn] = useState(96);
  const [levelCapacityLb, setLevelCapacityLb] = useState(2500);
  const [capacityMarginLb, setCapacityMarginLb] = useState(DEFAULT_CAPACITY_MARGIN_LB);
  const [ceilingHeightIn, setCeilingHeightIn] = useState(300);
  const [componentColors, setComponentColors] = useState<ComponentColorMap>({});

  useEffect(() => {
    void repositories.palletProfiles.list().then((result) => {
      if (result.kind !== "error") setPalletProfiles(result.value);
    });
  }, [repositories]);

  useEffect(() => {
    if (templateId === undefined) return;
    void repositories.templates.getTemplate(templateId as EntityId).then((result) => {
      if (result.kind === "error") {
        window.alert(result.message);
        return;
      }
      const template = result.value;
      if (template === undefined || template.templateType !== "rack") {
        window.alert("That template couldn't be found.");
        return;
      }
      setExistingTemplate(template);
      setName(template.name);
      setPalletProfileId(template.palletProfileId);
      setPalletLevels(template.palletLevels);
      setPalletHeightIn(toInches(template.palletHeightIn));
      setClearanceIn(toInches(template.clearanceIn));
      setFrameDepthIn(toInches(template.frameDepthIn));
      setBeamLengthIn(toInches(template.beamLengthIn));
      setLevelCapacityLb(template.levelCapacitiesLb[0] ?? 2500);
      setCapacityMarginLb(template.capacityMarginLb ?? DEFAULT_CAPACITY_MARGIN_LB);
      setComponentColors(template.componentColors);
    });
  }, [repositories, templateId]);

  async function handleSave(): Promise<void> {
    if (palletProfileId === "") {
      window.alert("Pick a pallet profile first.");
      return;
    }

    const sharedFields = {
      templateType: "rack" as const,
      name,
      componentColors,
      palletProfileId,
      palletLevels,
      palletHeightIn: fromInches(palletHeightIn),
      clearanceIn: fromInches(clearanceIn),
      frameDepthIn: fromInches(frameDepthIn),
      beamLengthIn: fromInches(beamLengthIn),
      levelCapacitiesLb: Array.from({ length: palletLevels }, () => levelCapacityLb) as never,
      capacityMarginLb: weightLb(capacityMarginLb),
    };

    const result =
      existingTemplate === null
        ? createRackTemplate(sharedFields)
        : validateTemplate({ ...existingTemplate, ...sharedFields, updatedAt: nowIsoTimestamp() });
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
        <h1>{existingTemplate === null ? "Template Editor" : `Edit Template — ${existingTemplate.name}`}</h1>

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

        <div style={{ marginBottom: 8 }}>
          <PalletProfileForm
            onCreated={(profile) => {
              setPalletProfiles((current) => [...current, profile]);
              setPalletProfileId(profile.id);
            }}
          />
        </div>

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
            Beam-capacity margin (lb):{" "}
            <input type="number" min={0} value={capacityMarginLb} onChange={(event) => setCapacityMarginLb(Number(event.target.value))} />
          </label>
          <br />
          <label>
            Ceiling obstruction height (in): <input type="number" value={ceilingHeightIn} onChange={(event) => setCeilingHeightIn(Number(event.target.value))} />
          </label>
        </fieldset>

        <ComponentColorPicker colors={componentColors} onChange={(component, color) => setComponentColors({ ...componentColors, [component]: color })} />

        <button className="btn btn-primary" onClick={() => void handleSave()} style={{ marginTop: "var(--space-md)" }}>
          {existingTemplate === null ? "Save as Template" : "Save Changes"}
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
