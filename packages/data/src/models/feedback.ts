/**
 * Feedback entity type: thumbs-up, pinned comments, general notes (Spec
 * §6.3b). Anonymous submissions need a generated session identifier so
 * concurrent viewers on one share link don't overwrite each other's
 * comments — last-write-wins is not acceptable here, since there's no
 * account to attribute conflicts to.
 */

import { error, ok, type Length, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export type FeedbackType = "thumbsUp" | "comment" | "generalNote";

/** Generated once per anonymous Client View visit, distinct from any entity id — identifies a viewer, not a stored record. */
export type SessionId = string;

export function generateFeedbackSessionId(): SessionId {
  return generateId() as string;
}

export interface Feedback extends Versioned {
  readonly id: EntityId;
  readonly layoutId: EntityId;
  readonly shareLinkId: EntityId;
  readonly sessionId: SessionId;
  readonly feedbackType: FeedbackType;
  /** Present only for a pinned "comment" — the clicked point on the layout. */
  readonly positionXIn?: Length;
  readonly positionYIn?: Length;
  /** Present for "comment" and "generalNote"; absent for "thumbsUp". */
  readonly text?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateFeedbackInput = Omit<Feedback, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createFeedback(input: CreateFeedbackInput): Result<Feedback> {
  const now = nowIsoTimestamp();
  return validateFeedback({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateFeedback(candidate: Feedback): Result<Feedback> {
  if (!isEntityId(candidate.id)) {
    return error("FEEDBACK_INVALID_ID", "Feedback id must be a non-empty string.");
  }
  if (!isEntityId(candidate.layoutId)) {
    return error("FEEDBACK_INVALID_LAYOUT_ID", "Feedback must reference a valid layout id.");
  }
  if (!isEntityId(candidate.shareLinkId)) {
    return error("FEEDBACK_INVALID_SHARE_LINK_ID", "Feedback must reference a valid share link id.");
  }
  if (candidate.sessionId.trim().length === 0) {
    return error("FEEDBACK_INVALID_SESSION_ID", "Feedback must carry a non-empty anonymous session id.");
  }
  if (candidate.feedbackType === "comment" && (candidate.positionXIn === undefined || candidate.positionYIn === undefined)) {
    return error("FEEDBACK_COMMENT_MISSING_POSITION", "A pinned comment must include a position.");
  }
  if ((candidate.feedbackType === "comment" || candidate.feedbackType === "generalNote") && !candidate.text?.trim()) {
    return error("FEEDBACK_MISSING_TEXT", `A "${candidate.feedbackType}" entry must include non-empty text.`);
  }
  return ok(candidate);
}
