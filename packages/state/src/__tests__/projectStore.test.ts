import { describe, expect, it } from "vitest";
import { generateId, nowIsoTimestamp, CURRENT_SCHEMA_VERSION, type Layout, type Project } from "@rack-app/data";
import { createProjectStore } from "../projectStore.js";

function makeProject(): Project {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    name: "Acme Distribution Center",
    clientName: "Acme Co.",
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function makeLayout(projectId: string): Layout {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    projectId: projectId as never,
    name: "Current State",
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

describe("projectStore.ts — Spec §6.1-§6.2: active Project/Layout list and selection state", () => {
  it("upsertProject adds a new project and updates an existing one in place", () => {
    const store = createProjectStore();
    const project = makeProject();

    store.getState().upsertProject(project);
    expect(store.getState().projects).toEqual([project]);

    const renamed = { ...project, name: "Acme DC — Renamed" };
    store.getState().upsertProject(renamed);
    expect(store.getState().projects).toEqual([renamed]);
  });

  it("removeProject removes the project and cascades: its layouts are removed and activeProjectId/activeLayoutId are cleared if they pointed at it", () => {
    const store = createProjectStore();
    const project = makeProject();
    const layout = makeLayout(project.id);
    const otherProject = makeProject();
    const otherLayout = makeLayout(otherProject.id);

    store.getState().upsertProject(project);
    store.getState().upsertProject(otherProject);
    store.getState().upsertLayout(layout);
    store.getState().upsertLayout(otherLayout);
    store.getState().setActiveProject(project.id);
    store.getState().setActiveLayout(layout.id);

    store.getState().removeProject(project.id);

    expect(store.getState().projects).toEqual([otherProject]);
    expect(store.getState().layouts).toEqual([otherLayout]);
    expect(store.getState().activeProjectId).toBeNull();
    expect(store.getState().activeLayoutId).toBeNull();
  });

  it("removeProject leaves activeProjectId/activeLayoutId untouched when they point at a different project", () => {
    const store = createProjectStore();
    const project = makeProject();
    const otherProject = makeProject();
    const otherLayout = makeLayout(otherProject.id);

    store.getState().upsertProject(project);
    store.getState().upsertProject(otherProject);
    store.getState().upsertLayout(otherLayout);
    store.getState().setActiveProject(otherProject.id);
    store.getState().setActiveLayout(otherLayout.id);

    store.getState().removeProject(project.id);

    expect(store.getState().activeProjectId).toBe(otherProject.id);
    expect(store.getState().activeLayoutId).toBe(otherLayout.id);
  });

  it("removeLayout removes the layout and clears activeLayoutId only if it was the active one", () => {
    const store = createProjectStore();
    const project = makeProject();
    const layout = makeLayout(project.id);
    const otherLayout = makeLayout(project.id);

    store.getState().upsertLayout(layout);
    store.getState().upsertLayout(otherLayout);
    store.getState().setActiveLayout(layout.id);

    store.getState().removeLayout(layout.id);

    expect(store.getState().layouts).toEqual([otherLayout]);
    expect(store.getState().activeLayoutId).toBeNull();

    store.getState().setActiveLayout(otherLayout.id);
    store.getState().removeLayout("nonexistent-id" as never);
    expect(store.getState().activeLayoutId).toBe(otherLayout.id);
  });
});
