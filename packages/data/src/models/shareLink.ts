/**
 * Share Link entity type: token, shared Layout IDs, expiry, revoked flag,
 * view timestamps (Spec §6.3a). Expiry check must be evaluated at access
 * time, not just at creation — isShareLinkAccessible() is the live check;
 * nothing should ever branch on a stored "isExpired" boolean instead.
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export interface ShareLink extends Versioned {
  readonly id: EntityId;
  readonly projectId: EntityId;
  readonly token: string;
  readonly sharedLayoutIds: readonly EntityId[];
  readonly expiresAt: IsoTimestamp;
  readonly revoked: boolean;
  readonly viewTimestamps: readonly IsoTimestamp[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/** Default share duration per Spec §6.3a: one week. */
export const DEFAULT_SHARE_LINK_DURATION_DAYS = 7;

export type CreateShareLinkInput = Omit<
  ShareLink,
  "id" | "token" | "revoked" | "viewTimestamps" | "createdAt" | "updatedAt" | "schemaVersion"
>;

export function createShareLink(input: CreateShareLinkInput): Result<ShareLink> {
  const now = nowIsoTimestamp();
  return validateShareLink({
    ...input,
    id: generateId(),
    token: generateId(),
    revoked: false,
    viewTimestamps: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateShareLink(candidate: ShareLink): Result<ShareLink> {
  if (!isEntityId(candidate.id)) {
    return error("SHARE_LINK_INVALID_ID", "Share Link id must be a non-empty string.");
  }
  if (!isEntityId(candidate.projectId)) {
    return error("SHARE_LINK_INVALID_PROJECT_ID", "Share Link must reference a valid project id.");
  }
  if (candidate.token.trim().length === 0) {
    return error("SHARE_LINK_INVALID_TOKEN", "Share Link token cannot be empty.");
  }
  if (candidate.sharedLayoutIds.length === 0) {
    return error("SHARE_LINK_NO_LAYOUTS", "Share Link must share at least one layout.");
  }
  if (Number.isNaN(Date.parse(candidate.expiresAt))) {
    return error("SHARE_LINK_INVALID_EXPIRY", "Share Link expiry must be a valid timestamp.");
  }
  return ok(candidate);
}

/** The live accessibility check — evaluated at access time, not derived from a stored flag. */
export function isShareLinkAccessible(link: ShareLink, now: Date = new Date()): boolean {
  return !link.revoked && Date.parse(link.expiresAt) > now.getTime();
}

export function recordShareLinkView(link: ShareLink, viewedAt: Date = new Date()): ShareLink {
  return { ...link, viewTimestamps: [...link.viewTimestamps, viewedAt.toISOString()], updatedAt: nowIsoTimestamp() };
}

export function revokeShareLink(link: ShareLink): ShareLink {
  return { ...link, revoked: true, updatedAt: nowIsoTimestamp() };
}
