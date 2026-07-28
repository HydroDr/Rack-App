/**
 * Implements repositoryInterface against local IndexedDB (via Dexie) for
 * the local-first stage. Must handle IndexedDB quota/storage errors
 * gracefully — surface a save failure to the user rather than losing data
 * silently (Engineering File Plan §3.3, §9.6).
 */

import Dexie, { type Table } from "dexie";
import { error, ok, type Result } from "@rack-app/rules-engine";
import type { EntityId } from "../integrity.js";
import type { Repository } from "../repository/repositoryInterface.js";

export class RackAppDatabase extends Dexie {
  projects!: Table<unknown, EntityId>;
  layouts!: Table<unknown, EntityId>;
  templates!: Table<unknown, EntityId>;
  variants!: Table<unknown, EntityId>;
  rackInstances!: Table<unknown, EntityId>;
  warehouseElements!: Table<unknown, EntityId>;
  pathLanes!: Table<unknown, EntityId>;
  groupLayers!: Table<unknown, EntityId>;
  zones!: Table<unknown, EntityId>;
  blockStackZones!: Table<unknown, EntityId>;
  palletProfiles!: Table<unknown, EntityId>;
  roiScenarios!: Table<unknown, EntityId>;
  shareLinks!: Table<unknown, EntityId>;
  feedback!: Table<unknown, EntityId>;
  noteAttachments!: Table<unknown, EntityId>;

  constructor(name = "rack-app") {
    super(name);
    this.version(1).stores({
      projects: "id",
      layouts: "id, projectId",
      templates: "id",
      variants: "id, parentTemplateId",
      rackInstances: "id, layoutId, templateId",
      warehouseElements: "id, layoutId",
      pathLanes: "id, layoutId",
      groupLayers: "id, layoutId",
      zones: "id, layoutId",
      blockStackZones: "id, layoutId",
      palletProfiles: "id",
      roiScenarios: "id, layoutId, zoneId",
      shareLinks: "id, projectId",
      feedback: "id, layoutId, shareLinkId",
      noteAttachments: "id, projectId, layoutId",
    });
  }
}

function describeStorageError(cause: unknown): string {
  if (cause instanceof Error) {
    if (cause.name === "QuotaExceededError") {
      return "Browser storage quota exceeded — free up space or export your work, then try saving again.";
    }
    return cause.message;
  }
  return "An unknown storage error occurred.";
}

/** Wraps a single Dexie table as a storage-agnostic Repository<T>, converting every failure into an explicit Result instead of an uncaught rejection. */
export function createIndexedDbRepository<T extends { readonly id: EntityId }>(table: Table<T, EntityId>): Repository<T> {
  return {
    async get(id) {
      try {
        return ok(await table.get(id));
      } catch (cause) {
        return error("STORAGE_READ_FAILED", describeStorageError(cause));
      }
    },
    async save(entity) {
      try {
        await table.put(entity);
        return ok(entity);
      } catch (cause) {
        return error("STORAGE_WRITE_FAILED", describeStorageError(cause));
      }
    },
    async delete(id) {
      try {
        await table.delete(id);
        return ok(undefined);
      } catch (cause) {
        return error("STORAGE_DELETE_FAILED", describeStorageError(cause));
      }
    },
    async list() {
      try {
        return ok(await table.toArray());
      } catch (cause) {
        return error("STORAGE_LIST_FAILED", describeStorageError(cause));
      }
    },
  };
}
