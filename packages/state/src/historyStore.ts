/**
 * Holds the past/future stacks of executed Commands and exposes undo/redo
 * navigation. Owns no Command logic itself — the real Command
 * implementations (what a "move rack" or "add upright" command actually
 * does) live in canvas/interaction/commandStack.ts later; this file only
 * needs the minimal structural shape below to call execute()/invert() on
 * whatever it's handed (Engineering File Plan §4, §5.2).
 *
 * Must cap stack size or evict old entries — guards against unbounded
 * memory growth on long editing sessions (Engineering File Plan §4, §9.5).
 *
 * Session-only by design (Spec §6.3.5): nothing in this store is ever
 * persisted — a reload always starts with empty past/future stacks, even
 * though the underlying layout data was auto-saved.
 */

import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * The minimal shape this store needs. A caller (canvas's commandStack.ts)
 * is expected to have already executed the command's effect before
 * pushing it here — push() records it for undo/redo, it does not
 * re-invoke execute().
 */
export interface Command {
  readonly id: string;
  execute(): void;
  invert(): void;
}

export const DEFAULT_MAX_HISTORY_SIZE = 200;

export interface HistoryStoreState {
  readonly past: readonly Command[];
  readonly future: readonly Command[];
  readonly maxHistorySize: number;
}

export interface HistoryStoreActions {
  /** Records an already-executed command. Clears the redo stack (a new action invalidates any prior redo path) and evicts the oldest entry once over the cap. */
  push(command: Command): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Resets both stacks — used when loading a new Layout, never called by autosaveManager. */
  clear(): void;
}

export type HistoryStore = HistoryStoreState & HistoryStoreActions;

export function createHistoryStore(maxHistorySize: number = DEFAULT_MAX_HISTORY_SIZE): StoreApi<HistoryStore> {
  return createStore<HistoryStore>((set, get) => ({
    past: [],
    future: [],
    maxHistorySize,

    push: (command) =>
      set((state) => {
        const nextPast = [...state.past, command];
        const overflow = nextPast.length - state.maxHistorySize;
        return {
          past: overflow > 0 ? nextPast.slice(overflow) : nextPast,
          future: [],
        };
      }),

    undo: () => {
      const state = get();
      const last = state.past[state.past.length - 1];
      if (last === undefined) return;
      last.invert();
      set({
        past: state.past.slice(0, -1),
        future: [...state.future, last],
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[state.future.length - 1];
      if (next === undefined) return;
      next.execute();
      set({
        future: state.future.slice(0, -1),
        past: [...state.past, next],
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    clear: () => set({ past: [], future: [] }),
  }));
}
