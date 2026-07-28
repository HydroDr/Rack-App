/**
 * Repeats a placed bay along a line at a given spacing/count, generating
 * one logical repeated object (Spec §6.3.1b). Per Spec §3.3, extending
 * bays within a line means incrementing the SAME Rack Instance's `bays`
 * field — not creating N separate instances — so "one logical repeated
 * object" falls out naturally: there is exactly one RackInstance either
 * way, just with a different bay count.
 *
 * Guards against a pathological repeat count (e.g. a typo entering
 * 100,000) that would hang the browser — clamps to a sane maximum and
 * surfaces a warning instead (Engineering File Plan §5.2, §9.5).
 */

import type { StoreApi } from "zustand/vanilla";
import { nowIsoTimestamp, type HistoryStore, type LayoutStore, type RackInstance } from "@rack-app/state";
import { commitCommand, createUpsertCommand, type EntityCommandOps } from "./commandStack.js";

/** Sane clamp — a typo of 100,000 bays becomes 500, with a warning, rather than hanging the browser. */
export const MAX_REPEAT_COUNT = 500;
const MIN_REPEAT_COUNT = 1;

export interface ArrayRepeatInput {
  readonly baseInstance: RackInstance;
  /** Total desired bays for the line (not an increment). */
  readonly requestedBayCount: number;
}

export interface ArrayRepeatResult {
  readonly instance: RackInstance;
  readonly clamped: boolean;
  readonly warning?: string;
}

function rackInstanceOps(layoutStore: StoreApi<LayoutStore>): EntityCommandOps<RackInstance> {
  return {
    upsert: (instance) => layoutStore.getState().upsertRackInstance(instance),
    remove: (id) => layoutStore.getState().removeRackInstance(id),
  };
}

export function applyArrayRepeat(
  layoutStore: StoreApi<LayoutStore>,
  historyStore: StoreApi<HistoryStore>,
  input: ArrayRepeatInput,
): ArrayRepeatResult {
  const requested = Math.round(input.requestedBayCount);
  const clampedCount = Math.min(Math.max(MIN_REPEAT_COUNT, requested), MAX_REPEAT_COUNT);
  const clamped = clampedCount !== requested;

  const nextInstance: RackInstance = { ...input.baseInstance, bays: clampedCount, updatedAt: nowIsoTimestamp() };

  commitCommand(historyStore, createUpsertCommand(rackInstanceOps(layoutStore), nextInstance, input.baseInstance));

  return {
    instance: nextInstance,
    clamped,
    ...(clamped
      ? { warning: `Repeat count ${requested} exceeds the maximum of ${MAX_REPEAT_COUNT} and was clamped.` }
      : {}),
  };
}
