/**
 * CRUD operations for Template + Variant. Deleting a Template referenced
 * by existing Rack Instances must be blocked or explicitly cascaded —
 * never silently orphan instances (Engineering File Plan §3.2). Rack
 * Instance has no dedicated repository file of its own (Spec §3.2 lists
 * only Project/Layout/Template/ShareLink), so this file takes a generic
 * Repository<RackInstance> to perform the referential check and cascade.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import type { EntityId } from "../integrity.js";
import { validateTemplate, type Template } from "../models/template.js";
import { validateVariant, type Variant } from "../models/variant.js";
import type { RackInstance } from "../models/rackInstance.js";
import type { Repository } from "./repositoryInterface.js";

export interface DeleteTemplateOptions {
  readonly cascade: boolean;
}

export class TemplateRepository {
  constructor(
    private readonly templates: Repository<Template>,
    private readonly variants: Repository<Variant>,
    private readonly rackInstances: Repository<RackInstance>,
  ) {}

  getTemplate(id: EntityId): Promise<Result<Template | undefined>> {
    return this.templates.get(id);
  }

  saveTemplate(template: Template): Promise<Result<Template>> {
    const validation = validateTemplate(template);
    if (validation.kind === "error") return Promise.resolve(validation);
    return this.templates.save(template);
  }

  listTemplates(): Promise<Result<readonly Template[]>> {
    return this.templates.list();
  }

  getVariant(id: EntityId): Promise<Result<Variant | undefined>> {
    return this.variants.get(id);
  }

  saveVariant(variant: Variant): Promise<Result<Variant>> {
    const validation = validateVariant(variant);
    if (validation.kind === "error") return Promise.resolve(validation);
    return this.variants.save(variant);
  }

  listVariants(): Promise<Result<readonly Variant[]>> {
    return this.variants.list();
  }

  async deleteVariant(id: EntityId): Promise<Result<void>> {
    return this.variants.delete(id);
  }

  /**
   * Blocks deletion when live Rack Instances still reference this template,
   * unless { cascade: true } is passed — in which case those instances are
   * deleted first. Either way, an instance is never left pointing at a
   * template that no longer exists.
   */
  async deleteTemplate(id: EntityId, options: DeleteTemplateOptions = { cascade: false }): Promise<Result<void>> {
    const instancesResult = await this.rackInstances.list();
    if (instancesResult.kind === "error") return instancesResult;
    const referencing = instancesResult.value.filter((instance) => instance.templateId === id);

    if (referencing.length > 0 && !options.cascade) {
      return error(
        "TEMPLATE_DELETE_BLOCKED_BY_INSTANCES",
        `Cannot delete template "${id}": ${referencing.length} Rack Instance(s) still reference it. Pass { cascade: true } to delete them too.`,
      );
    }

    for (const instance of referencing) {
      const deleteResult = await this.rackInstances.delete(instance.id);
      if (deleteResult.kind === "error") return deleteResult;
    }

    const variantsResult = await this.variants.list();
    if (variantsResult.kind === "error") return variantsResult;
    for (const variant of variantsResult.value.filter((v) => v.parentTemplateId === id)) {
      const deleteResult = await this.variants.delete(variant.id);
      if (deleteResult.kind === "error") return deleteResult;
    }

    return this.templates.delete(id);
  }

  async countReferencingInstances(templateId: EntityId): Promise<Result<number>> {
    const instancesResult = await this.rackInstances.list();
    if (instancesResult.kind === "error") return instancesResult;
    return ok(instancesResult.value.filter((instance) => instance.templateId === templateId).length);
  }
}
