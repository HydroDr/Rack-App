/**
 * Account-level preferences: units, toolbar layout, drawing/display
 * settings, default anchors-per-upright (Spec §6.5). Follows the user
 * across every project — project-level overrides (e.g. a units override
 * for one job) live on the Project entity itself, not here.
 *
 * Note: the 6:1 toppling ratio threshold is deliberately NOT modeled as a
 * preference here — it is a fixed code constant
 * (rules-engine's TOPPLING_RATIO_THRESHOLD), displayed read-only on the
 * settings page, never a value this store holds or lets the UI set
 * (Spec §6.5, §2.5).
 */

import { createStore, type StoreApi } from "zustand/vanilla";

export type UnitsPreference = "inches" | "feetInches" | "metric";
export type ToolbarPosition = "top" | "bottom" | "left" | "right";
export type ThemePreference = "light" | "dark";

export interface UiPreferencesState {
  /** Dark is the default (Design_System.docx §6.1); persisted to localStorage by the ui package. */
  readonly theme: ThemePreference;
  readonly units: UnitsPreference;
  readonly toolbarPosition: ToolbarPosition;
  readonly toolbarVisibleCategories: ReadonlySet<string>;
  readonly quickMenuTools: readonly string[];
  readonly textAnnotationSize: number;
  readonly gridColor: string;
  readonly annotationColor: string;
  readonly selectionHighlightColor: string;
  /** Pre-fills new templates (Spec §3.1, §6.5); still overridable per template. */
  readonly defaultAnchorsPerUpright: number;
  /** Account-default beam-capacity safety margin, lb (Spec §3.1c); overridable per template via RackTemplate.capacityMarginLb. */
  readonly defaultCapacityMarginLb: number;
  readonly variantAutoPromotion: boolean;
}

export interface UiPreferencesActions {
  setTheme(theme: ThemePreference): void;
  setUnits(units: UnitsPreference): void;
  setToolbarPosition(position: ToolbarPosition): void;
  setToolbarVisibleCategories(categories: ReadonlySet<string>): void;
  toggleToolbarCategory(category: string): void;
  setQuickMenuTools(tools: readonly string[]): void;
  addToQuickMenu(tool: string): void;
  removeFromQuickMenu(tool: string): void;
  setTextAnnotationSize(size: number): void;
  setGridColor(color: string): void;
  setAnnotationColor(color: string): void;
  setSelectionHighlightColor(color: string): void;
  setDefaultAnchorsPerUpright(count: number): void;
  setDefaultCapacityMarginLb(marginLb: number): void;
  setVariantAutoPromotion(enabled: boolean): void;
}

export type UiPreferencesStore = UiPreferencesState & UiPreferencesActions;

const DEFAULT_STATE: UiPreferencesState = {
  theme: "dark",
  units: "feetInches",
  toolbarPosition: "top",
  toolbarVisibleCategories: new Set(["selectionNavigation", "drawingStructure", "measurement", "annotation"]),
  quickMenuTools: [],
  textAnnotationSize: 12,
  gridColor: "#cccccc",
  annotationColor: "#000000",
  selectionHighlightColor: "#2684ff",
  defaultAnchorsPerUpright: 3,
  defaultCapacityMarginLb: 300,
  variantAutoPromotion: false,
};

export function createUiPreferencesStore(overrides: Partial<UiPreferencesState> = {}): StoreApi<UiPreferencesStore> {
  const initialState: UiPreferencesState = { ...DEFAULT_STATE, ...overrides };

  return createStore<UiPreferencesStore>((set) => ({
    ...initialState,

    setTheme: (theme) => set({ theme }),

    setUnits: (units) => set({ units }),

    setToolbarPosition: (toolbarPosition) => set({ toolbarPosition }),

    setToolbarVisibleCategories: (toolbarVisibleCategories) => set({ toolbarVisibleCategories }),

    toggleToolbarCategory: (category) =>
      set((state) => {
        const next = new Set(state.toolbarVisibleCategories);
        if (next.has(category)) {
          next.delete(category);
        } else {
          next.add(category);
        }
        return { toolbarVisibleCategories: next };
      }),

    setQuickMenuTools: (quickMenuTools) => set({ quickMenuTools }),

    addToQuickMenu: (tool) =>
      set((state) => (state.quickMenuTools.includes(tool) ? state : { quickMenuTools: [...state.quickMenuTools, tool] })),

    removeFromQuickMenu: (tool) =>
      set((state) => ({ quickMenuTools: state.quickMenuTools.filter((existing) => existing !== tool) })),

    setTextAnnotationSize: (textAnnotationSize) => set({ textAnnotationSize }),

    setGridColor: (gridColor) => set({ gridColor }),

    setAnnotationColor: (annotationColor) => set({ annotationColor }),

    setSelectionHighlightColor: (selectionHighlightColor) => set({ selectionHighlightColor }),

    setDefaultAnchorsPerUpright: (defaultAnchorsPerUpright) => set({ defaultAnchorsPerUpright }),

    setDefaultCapacityMarginLb: (defaultCapacityMarginLb) => set({ defaultCapacityMarginLb }),

    setVariantAutoPromotion: (variantAutoPromotion) => set({ variantAutoPromotion }),
  }));
}
