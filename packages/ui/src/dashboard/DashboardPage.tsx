/**
 * Top-level Dashboard screen layout (Spec §6.2): search, "+ New Project",
 * "New Template" shortcut, Recent row, and the main project grid/list
 * with sort and grid/list-toggle controls.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createProject, type EntityId } from "@rack-app/state";
import { useAppStores, useProjectStore } from "../app/stores.js";
import { PalletProfileForm } from "../pallet-profiles/PalletProfileForm.js";
import { ProjectCard } from "./ProjectCard.js";
import { RecentProjectsRow } from "./RecentProjectsRow.js";

type SortMode = "recentlyEdited" | "name" | "dateCreated";
type ViewMode = "grid" | "list";

export function DashboardPage() {
  const projects = useProjectStore((state) => state.projects);
  const layouts = useProjectStore((state) => state.layouts);
  const upsertProject = useProjectStore((state) => state.upsertProject);
  const { repositories } = useAppStores();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recentlyEdited");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching =
      query === ""
        ? projects
        : projects.filter((project) => project.name.toLowerCase().includes(query) || project.clientName.toLowerCase().includes(query));

    return [...matching].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "dateCreated") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  }, [projects, search, sortMode]);

  function layoutCountFor(projectId: EntityId): number {
    return layouts.filter((layout) => layout.projectId === projectId).length;
  }

  async function handleNewProject(): Promise<void> {
    const name = window.prompt("Project name?");
    if (name === null || name.trim() === "") return;
    const clientName = window.prompt("Client name?") ?? "";

    const result = createProject({ name, clientName });
    if (result.kind === "error") {
      window.alert(result.message);
      return;
    }

    const saveResult = await repositories.projects.save(result.value);
    if (saveResult.kind === "error") {
      window.alert(`Could not save the new project: ${saveResult.message}`);
      return;
    }

    upsertProject(result.value);
    navigate(`/projects/${result.value.id}`);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <input
          type="search"
          placeholder="Search projects or clients..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1, maxWidth: 360, padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 6 }}
        />
        <button onClick={() => void handleNewProject()} style={{ padding: "8px 14px", borderRadius: 6, background: "var(--color-accent)", color: "white", border: "none" }}>
          + New Project
        </button>
      </header>

      <RecentProjectsRow projects={projects} layouts={layouts} />
      <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 16 }}>
        <Link to="/templates/new">+ New Template</Link>
        <PalletProfileForm onCreated={() => {}} />
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label>
          Sort by:{" "}
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="recentlyEdited">Recently edited</option>
            <option value="name">Name</option>
            <option value="dateCreated">Date created</option>
          </select>
        </label>
        <div role="group" aria-label="View mode">
          <button aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>
            Grid
          </button>
          <button aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>
            List
          </button>
        </div>
      </div>

      <div
        style={
          viewMode === "grid"
            ? { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }
            : { marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }
        }
      >
        {visibleProjects.length === 0 && <p style={{ color: "var(--color-text-muted)" }}>No projects yet — create one to get started.</p>}
        {visibleProjects.map((project) => (
          <ProjectCard key={project.id} project={project} layoutCount={layoutCountFor(project.id)} />
        ))}
      </div>
    </div>
  );
}
