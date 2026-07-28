/**
 * Holds the active Project/Layout list and selection state (Spec §6.1,
 * §6.2 Dashboard). Pure reactive state container — fetching from the
 * repository layer and pushing results in here is the caller's job, not
 * this file's (Engineering File Plan §4).
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { EntityId, Layout, Project } from "@rack-app/data";

export interface ProjectStoreState {
  readonly projects: readonly Project[];
  readonly layouts: readonly Layout[];
  readonly activeProjectId: EntityId | null;
  readonly activeLayoutId: EntityId | null;
}

export interface ProjectStoreActions {
  setProjects(projects: readonly Project[]): void;
  upsertProject(project: Project): void;
  removeProject(projectId: EntityId): void;
  setLayouts(layouts: readonly Layout[]): void;
  upsertLayout(layout: Layout): void;
  removeLayout(layoutId: EntityId): void;
  setActiveProject(projectId: EntityId | null): void;
  setActiveLayout(layoutId: EntityId | null): void;
}

export type ProjectStore = ProjectStoreState & ProjectStoreActions;

const initialState: ProjectStoreState = {
  projects: [],
  layouts: [],
  activeProjectId: null,
  activeLayoutId: null,
};

export function createProjectStore(): StoreApi<ProjectStore> {
  return createStore<ProjectStore>((set) => ({
    ...initialState,

    setProjects: (projects) => set({ projects }),

    upsertProject: (project) =>
      set((state) => {
        const withoutExisting = state.projects.filter((existing) => existing.id !== project.id);
        return { projects: [...withoutExisting, project] };
      }),

    removeProject: (projectId) =>
      set((state) => ({
        projects: state.projects.filter((project) => project.id !== projectId),
        layouts: state.layouts.filter((layout) => layout.projectId !== projectId),
        activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
        activeLayoutId:
          state.activeProjectId === projectId
            ? null
            : state.activeLayoutId,
      })),

    setLayouts: (layouts) => set({ layouts }),

    upsertLayout: (layout) =>
      set((state) => {
        const withoutExisting = state.layouts.filter((existing) => existing.id !== layout.id);
        return { layouts: [...withoutExisting, layout] };
      }),

    removeLayout: (layoutId) =>
      set((state) => ({
        layouts: state.layouts.filter((layout) => layout.id !== layoutId),
        activeLayoutId: state.activeLayoutId === layoutId ? null : state.activeLayoutId,
      })),

    setActiveProject: (projectId) => set({ activeProjectId: projectId }),

    setActiveLayout: (layoutId) => set({ activeLayoutId: layoutId }),
  }));
}
