/**
 * Top-level Settings screen with Account/Project sections (Spec §6.5).
 */

import { useState } from "react";
import type { EntityId } from "@rack-app/state";
import { useProjectStore } from "../app/stores.js";
import { AccountSettingsSection } from "./AccountSettingsSection.js";
import { ProjectSettingsSection } from "./ProjectSettingsSection.js";

type SettingsSection = "account" | "project";

export function SettingsPage() {
  const projects = useProjectStore((state) => state.projects);
  const [section, setSection] = useState<SettingsSection>("account");
  const [selectedProjectId, setSelectedProjectId] = useState<EntityId | "">("");

  return (
    <div style={{ padding: 24 }}>
      <h1>Settings</h1>
      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button aria-pressed={section === "account"} onClick={() => setSection("account")}>
          Account
        </button>
        <button aria-pressed={section === "project"} onClick={() => setSection("project")}>
          Project
        </button>
      </nav>

      {section === "account" && <AccountSettingsSection />}

      {section === "project" && (
        <div>
          <label style={{ display: "block", marginBottom: 12 }}>
            Project:{" "}
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value as EntityId)}>
              <option value="">Select a project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          {selectedProjectId !== "" && <ProjectSettingsSection projectId={selectedProjectId} />}
        </div>
      )}
    </div>
  );
}
