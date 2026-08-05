/**
 * Wall clearance defaults, pallet profile multi-select, units override
 * (Spec §6.5) — scoped to one Project, persisted on the Project entity
 * itself (Engineering File Plan §6.6).
 *
 * The DXF style import below is read-only preview only: it parses and
 * displays a DXF's TABLES section (Spec §6.6) but doesn't persist the
 * result — Project has no drawing-preferences field yet, and adding one
 * is outside this phase's scope.
 */

import { useEffect, useState } from "react";
import { importDxfStylePreferences, type ImportedDrawingPreferences } from "@rack-app/import";
import type { EntityId, PalletProfile, Project, ProjectUnitsOverride, ProjectWallType } from "@rack-app/state";
import { useAppStores, useProjectStore } from "../app/stores.js";

/** Uses FileReader rather than File.prototype.text() — broader environment support for the same result. */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read the file."));
    reader.readAsText(file);
  });
}

export interface ProjectSettingsSectionProps {
  readonly projectId: EntityId;
}

export function ProjectSettingsSection({ projectId }: ProjectSettingsSectionProps) {
  const { repositories } = useAppStores();
  const project = useProjectStore((state) => state.projects.find((candidate) => candidate.id === projectId));
  const upsertProject = useProjectStore((state) => state.upsertProject);
  const [palletProfiles, setPalletProfiles] = useState<readonly PalletProfile[]>([]);
  const [dxfPreferences, setDxfPreferences] = useState<ImportedDrawingPreferences | null>(null);
  const [dxfError, setDxfError] = useState<string | null>(null);

  useEffect(() => {
    void repositories.palletProfiles.list().then((result) => {
      if (result.kind !== "error") setPalletProfiles(result.value);
    });
  }, [repositories]);

  async function saveProject(next: Project): Promise<void> {
    const saveResult = await repositories.projects.save(next);
    if (saveResult.kind === "error") {
      window.alert(saveResult.message);
      return;
    }
    upsertProject(next);
  }

  async function updateProject(patch: Partial<Project>): Promise<void> {
    if (project === undefined) return;
    await saveProject({ ...project, ...patch, updatedAt: new Date().toISOString() });
  }

  /** Clears unitsOverride entirely (falls through to the account default) rather than setting it to undefined, since Project's exactOptionalPropertyTypes forbids that. */
  async function clearUnitsOverride(): Promise<void> {
    if (project === undefined) return;
    const { unitsOverride: _unused, ...withoutOverride } = project;
    await saveProject({ ...withoutOverride, updatedAt: new Date().toISOString() });
  }

  async function handleDxfFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    setDxfError(null);
    setDxfPreferences(null);
    try {
      const text = await readFileAsText(file);
      const result = importDxfStylePreferences(text);
      if (result.kind === "error") {
        setDxfError(result.message);
        return;
      }
      setDxfPreferences(result.value);
    } catch (cause) {
      setDxfError(cause instanceof Error ? cause.message : "Failed to read the file.");
    }
  }

  if (project === undefined) {
    return <p style={{ color: "var(--color-text-muted)" }}>Select a project to see its settings.</p>;
  }

  const activeIds = new Set(project.activePalletProfileIds ?? []);

  function toggleProfile(id: EntityId): void {
    const next = new Set(activeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    void updateProject({ activePalletProfileIds: Array.from(next) });
  }

  return (
    <section style={{ maxWidth: 480 }}>
      <h2>Project Settings — {project.name}</h2>

      <label style={{ display: "block", marginBottom: 8 }}>
        Wall clearance:{" "}
        <select value={project.wallType ?? "nonFood"} onChange={(event) => void updateProject({ wallType: event.target.value as ProjectWallType })}>
          <option value="nonFood">Non-food (1 ft minimum)</option>
          <option value="food">Food (3 ft minimum)</option>
        </select>
      </label>

      <label style={{ display: "block", marginBottom: 8 }}>
        Units override:{" "}
        <select
          value={project.unitsOverride ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "") {
              void clearUnitsOverride();
            } else {
              void updateProject({ unitsOverride: value as ProjectUnitsOverride });
            }
          }}
        >
          <option value="">Use account default</option>
          <option value="inches">Inches</option>
          <option value="feetInches">Feet-Inches</option>
          <option value="metric">Metric</option>
        </select>
      </label>

      <fieldset>
        <legend>Pallet profile filter (multi-select)</legend>
        {palletProfiles.length === 0 && <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No pallet profiles yet.</p>}
        {palletProfiles.map((profile) => (
          <label key={profile.id} style={{ display: "block" }}>
            <input type="checkbox" checked={activeIds.has(profile.id)} onChange={() => toggleProfile(profile.id)} /> {profile.name}
          </label>
        ))}
      </fieldset>

      <fieldset style={{ marginTop: 16 }}>
        <legend>Import DXF drawing styles (preview)</legend>
        <input type="file" accept=".dxf" onChange={(event) => void handleDxfFileChange(event)} />
        {dxfError !== null && <p style={{ color: "crimson" }}>{dxfError}</p>}
        {dxfPreferences !== null && (
          <ul style={{ fontSize: 13 }}>
            <li>Layers: {dxfPreferences.layers.map((layer) => layer.name).join(", ") || "none"}</li>
            <li>Text styles: {dxfPreferences.textStyles.map((style) => style.name).join(", ") || "none"}</li>
            <li>Dimension styles: {dxfPreferences.dimStyles.map((style) => style.name).join(", ") || "none"}</li>
            <li>Linetypes: {dxfPreferences.lineTypes.map((lineType) => lineType.name).join(", ") || "none"}</li>
          </ul>
        )}
      </fieldset>
    </section>
  );
}
