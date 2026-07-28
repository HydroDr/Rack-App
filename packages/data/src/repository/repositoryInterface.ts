/**
 * Defines the storage-agnostic interface (get/save/delete/list) every
 * entity repository implements. This is the single seam that makes
 * local-first -> hosted-backend a swap, not a rewrite — no other file may
 * bypass it to talk to storage directly (Engineering File Plan §3.2, §9.6).
 */

import type { Result } from "@rack-app/rules-engine";
import type { EntityId } from "../integrity.js";

export interface Repository<T extends { readonly id: EntityId }> {
  get(id: EntityId): Promise<Result<T | undefined>>;
  save(entity: T): Promise<Result<T>>;
  delete(id: EntityId): Promise<Result<void>>;
  list(): Promise<Result<readonly T[]>>;
}
