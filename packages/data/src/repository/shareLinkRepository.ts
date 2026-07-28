/**
 * CRUD + expiry/revocation logic for Share Links (Spec §6.3a; Engineering
 * File Plan §3.2). Accessibility is always re-derived through
 * isShareLinkAccessible() at the moment of use — this file never branches
 * on a cached "expired" flag.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import type { EntityId } from "../integrity.js";
import {
  isShareLinkAccessible,
  recordShareLinkView,
  revokeShareLink,
  validateShareLink,
  type ShareLink,
} from "../models/shareLink.js";
import type { Repository } from "./repositoryInterface.js";

export class ShareLinkRepository {
  constructor(private readonly storage: Repository<ShareLink>) {}

  get(id: EntityId): Promise<Result<ShareLink | undefined>> {
    return this.storage.get(id);
  }

  save(link: ShareLink): Promise<Result<ShareLink>> {
    const validation = validateShareLink(link);
    if (validation.kind === "error") return Promise.resolve(validation);
    return this.storage.save(link);
  }

  delete(id: EntityId): Promise<Result<void>> {
    return this.storage.delete(id);
  }

  list(): Promise<Result<readonly ShareLink[]>> {
    return this.storage.list();
  }

  async listAccessibleForProject(projectId: EntityId, now: Date = new Date()): Promise<Result<readonly ShareLink[]>> {
    const result = await this.storage.list();
    if (result.kind === "error") return result;
    return ok(result.value.filter((link) => link.projectId === projectId && isShareLinkAccessible(link, now)));
  }

  /** Records a Client View open, but only if the link is still accessible right now — expiry is checked at access time, not creation time. */
  async recordView(id: EntityId, viewedAt: Date = new Date()): Promise<Result<ShareLink>> {
    const existing = await this.storage.get(id);
    if (existing.kind === "error") return existing;
    if (existing.value === undefined) {
      return error("SHARE_LINK_NOT_FOUND", `Share link "${id}" does not exist.`);
    }
    if (!isShareLinkAccessible(existing.value, viewedAt)) {
      return error("SHARE_LINK_NOT_ACCESSIBLE", "This share link has expired or been revoked.");
    }
    return this.storage.save(recordShareLinkView(existing.value, viewedAt));
  }

  async revoke(id: EntityId): Promise<Result<ShareLink>> {
    const existing = await this.storage.get(id);
    if (existing.kind === "error") return existing;
    if (existing.value === undefined) {
      return error("SHARE_LINK_NOT_FOUND", `Share link "${id}" does not exist.`);
    }
    return this.storage.save(revokeShareLink(existing.value));
  }
}
