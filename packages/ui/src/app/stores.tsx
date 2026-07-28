/**
 * Owns the single instance of every Zustand store and repository for the
 * running app, and provides typed hooks for components to read them.
 * Not one of the Engineering File Plan §6 named files — it is the
 * necessary glue that lets those files actually share state: something
 * has to construct the store instances state/*.ts's factory functions
 * produce and the repository instances state/storageFacade.ts's
 * constructors produce, exactly once, and hand them down the React tree.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import {
  createAutosaveManager,
  createHistoryStore,
  createIndexedDbRepository,
  createLayoutStore,
  createProjectStore,
  createUiPreferencesStore,
  LayoutRepository,
  ProjectRepository,
  RackAppDatabase,
  ShareLinkRepository,
  TemplateRepository,
  type BlockStackZone,
  type GroupLayer,
  type HistoryStore,
  type LayoutStore,
  type PathLane,
  type ProjectStore,
  type RackInstance,
  type Repository,
  type ShareLink,
  type Template,
  type UiPreferencesStore,
  type Variant,
  type WarehouseElement,
  type Zone,
} from "@rack-app/state";

export interface AppRepositories {
  readonly projects: ProjectRepository;
  readonly layouts: LayoutRepository;
  readonly templates: TemplateRepository;
  readonly shareLinks: ShareLinkRepository;
  readonly rackInstances: Repository<RackInstance>;
  readonly warehouseElements: Repository<WarehouseElement>;
  readonly pathLanes: Repository<PathLane>;
  readonly groupLayers: Repository<GroupLayer>;
  readonly zones: Repository<Zone>;
  readonly blockStackZones: Repository<BlockStackZone>;
}

export interface AppStores {
  readonly projectStore: StoreApi<ProjectStore>;
  readonly layoutStore: StoreApi<LayoutStore>;
  readonly uiPreferencesStore: StoreApi<UiPreferencesStore>;
  readonly historyStore: StoreApi<HistoryStore>;
  readonly repositories: AppRepositories;
}

const DEFAULT_DATABASE_NAME = "rack-app";

function createAppStores(databaseName: string): AppStores {
  const db = new RackAppDatabase(databaseName);

  const repositories: AppRepositories = {
    projects: new ProjectRepository(createIndexedDbRepository(db.projects as never)),
    layouts: new LayoutRepository(createIndexedDbRepository(db.layouts as never)),
    templates: new TemplateRepository(
      createIndexedDbRepository<Template>(db.templates as never),
      createIndexedDbRepository<Variant>(db.variants as never),
      createIndexedDbRepository<RackInstance>(db.rackInstances as never),
    ),
    shareLinks: new ShareLinkRepository(createIndexedDbRepository<ShareLink>(db.shareLinks as never)),
    rackInstances: createIndexedDbRepository<RackInstance>(db.rackInstances as never),
    warehouseElements: createIndexedDbRepository<WarehouseElement>(db.warehouseElements as never),
    pathLanes: createIndexedDbRepository<PathLane>(db.pathLanes as never),
    groupLayers: createIndexedDbRepository<GroupLayer>(db.groupLayers as never),
    zones: createIndexedDbRepository<Zone>(db.zones as never),
    blockStackZones: createIndexedDbRepository<BlockStackZone>(db.blockStackZones as never),
  };

  const projectStore = createProjectStore();
  const layoutStore = createLayoutStore();
  const uiPreferencesStore = createUiPreferencesStore();
  const historyStore = createHistoryStore();

  // Fire-and-forget: autosave subscribes for the lifetime of the app: it's never disposed here.
  createAutosaveManager(historyStore, layoutStore, {
    layouts: repositories.layouts,
    rackInstances: repositories.rackInstances,
    warehouseElements: repositories.warehouseElements,
    pathLanes: repositories.pathLanes,
    groupLayers: repositories.groupLayers,
    zones: repositories.zones,
    blockStackZones: repositories.blockStackZones,
  });

  return { projectStore, layoutStore, uiPreferencesStore, historyStore, repositories };
}

const AppStoresContext = createContext<AppStores | null>(null);

export interface AppStoresProviderProps {
  readonly children: ReactNode;
  /** Overridable so tests don't share IndexedDB state with each other or with a real app run. */
  readonly databaseName?: string;
}

export function AppStoresProvider({ children, databaseName = DEFAULT_DATABASE_NAME }: AppStoresProviderProps) {
  const stores = useMemo(() => createAppStores(databaseName), [databaseName]);
  return <AppStoresContext.Provider value={stores}>{children}</AppStoresContext.Provider>;
}

export function useAppStores(): AppStores {
  const stores = useContext(AppStoresContext);
  if (stores === null) {
    throw new Error("useAppStores must be called within an AppStoresProvider.");
  }
  return stores;
}

export function useProjectStore<T>(selector: (state: ProjectStore) => T): T {
  return useStore(useAppStores().projectStore, selector);
}

export function useLayoutStore<T>(selector: (state: LayoutStore) => T): T {
  return useStore(useAppStores().layoutStore, selector);
}

export function useUiPreferencesStore<T>(selector: (state: UiPreferencesStore) => T): T {
  return useStore(useAppStores().uiPreferencesStore, selector);
}

export function useHistoryStore<T>(selector: (state: HistoryStore) => T): T {
  return useStore(useAppStores().historyStore, selector);
}
