/**
 * CRUD operations for Project, implementing repositoryInterface (Spec
 * §6.1, §6.2; Engineering File Plan §3.2).
 */

import type { Result } from "@rack-app/rules-engine";
import type { EntityId } from "../integrity.js";
import { validateProject, type Project } from "../models/project.js";
import type { Repository } from "./repositoryInterface.js";

export class ProjectRepository {
  constructor(private readonly storage: Repository<Project>) {}

  get(id: EntityId): Promise<Result<Project | undefined>> {
    return this.storage.get(id);
  }

  save(project: Project): Promise<Result<Project>> {
    const validation = validateProject(project);
    if (validation.kind === "error") return Promise.resolve(validation);
    return this.storage.save(project);
  }

  delete(id: EntityId): Promise<Result<void>> {
    return this.storage.delete(id);
  }

  list(): Promise<Result<readonly Project[]>> {
    return this.storage.list();
  }
}
