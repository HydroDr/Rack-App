/**
 * Defines the Command interface (execute/invert) and constructs a Command
 * object for each mutating tool action. Every tool routes its mutations
 * through here rather than touching layoutStore directly; constructed
 * Commands are pushed to state/historyStore.ts, which owns the actual
 * past/future stacks (Engineering File Plan §5.2).
 *
 * A tool that mutates layoutStore directly, bypassing this file, must be
 * treated as a bug — it silently breaks undo/redo for that action.
 *
 * The generic upsert/remove command factories below cover every
 * layout-scoped entity type (Rack Instance, Warehouse Element, Path Lane,
 * Group/Layer, Zone, Block Stack Zone) uniformly, rather than one
 * hand-written factory per entity type.
 */

import type { StoreApi } from "zustand/vanilla";
import type { Command, EntityId, HistoryStore } from "@rack-app/state";

export type { Command } from "@rack-app/state";

function generateCommandId(): string {
  return crypto.randomUUID();
}

/** The minimal read/write surface a Command factory needs for one entity type in layoutStore. */
export interface EntityCommandOps<T> {
  upsert(entity: T): void;
  remove(id: EntityId): void;
}

/**
 * Adds a new entity, or updates an existing one. `previous` is the value to
 * restore on undo — pass undefined when this is a brand-new entity (undo
 * then removes it instead of restoring a prior version).
 */
export function createUpsertCommand<T extends { readonly id: EntityId }>(
  ops: EntityCommandOps<T>,
  next: T,
  previous?: T,
): Command {
  return {
    id: generateCommandId(),
    execute: () => ops.upsert(next),
    invert: () => (previous === undefined ? ops.remove(next.id) : ops.upsert(previous)),
  };
}

export function createRemoveCommand<T extends { readonly id: EntityId }>(ops: EntityCommandOps<T>, entity: T): Command {
  return {
    id: generateCommandId(),
    execute: () => ops.remove(entity.id),
    invert: () => ops.upsert(entity),
  };
}

/** Combines several Commands into one atomic undo/redo step (e.g. Array/Repeat creating many instances at once). */
export function createBatchCommand(commands: readonly Command[]): Command {
  return {
    id: generateCommandId(),
    execute: () => {
      for (const command of commands) command.execute();
    },
    invert: () => {
      for (const command of [...commands].reverse()) command.invert();
    },
  };
}

/** Executes the command exactly once, then records it on historyStore — the one sanctioned way a tool commits a mutation. */
export function commitCommand(historyStore: StoreApi<HistoryStore>, command: Command): void {
  command.execute();
  historyStore.getState().push(command);
}
