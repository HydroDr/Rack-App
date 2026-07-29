/**
 * Wall clearance defaults, pallet profile multi-select, units override
 * (Spec §6.5) — scoped to one Project, persisted on the Project entity
 * itself (Engineering File Plan §6.6).
 */

import { useEffect, useState } from "react";
import type { EntityId, PalletProfile, Project, ProjectUnitsOverride, ProjectWallType } from "@rack-app/state";
import { useAppStores, useProjectStore } from "../app/stores.js";

export interface ProjectSettingsSectionProps {
  readonly projectId: EntityId;
}

export function ProjectSettingsSection({ projectId }: ProjectSettingsSectionProps) {
  const { repositories } = useAppStores();
  const project = useProjectStore((state) => state.projects.find((candidate) => candidate.id === projectId));
  const upsertProject = useProjectStore((state) => state.upsertProject);
  const [palletProfiles, setPalletProfiles] = useState<readonly PalletProfile[]>([]);

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
    </section>
  );
}
