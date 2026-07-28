/**
 * CRUD operations for Layout, including the multiple-Layouts-per-Project
 * relationship (Spec §6.1; Engineering File Plan §3.2).
 */

import { ok, type Result } from "@rack-app/rules-engine";
import type { EntityId } from "../integrity.js";
import { validateLayout, type Layout } from "../models/layout.js";
import type { Repository } from "./repositoryInterface.js";

export class LayoutRepository {
  constructor(private readonly storage: Repository<Layout>) {}

  get(id: EntityId): Promise<Result<Layout | undefined>> {
    return this.storage.get(id);
  }

  save(layout: Layout): Promise<Result<Layout>> {
    const validation = validateLayout(layout);
    if (validation.kind === "error") return Promise.resolve(validation);
    return this.storage.save(layout);
  }

  delete(id: EntityId): Promise<Result<void>> {
    return this.storage.delete(id);
  }

  list(): Promise<Result<readonly Layout[]>> {
    return this.storage.list();
  }

  async listByProject(projectId: EntityId): Promise<Result<readonly Layout[]>> {
    const result = await this.storage.list();
    if (result.kind === "error") return result;
    return ok(result.value.filter((layout) => layout.projectId === projectId));
  }
}
