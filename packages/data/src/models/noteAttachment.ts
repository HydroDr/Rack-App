/**
 * Note/Attachment entity type (file or freeform; project-wide or
 * layout-scoped) — Spec §6.3 (Notes tab).
 */

import { error, ok, type Result } from "@rack-app/rules-engine";
import { generateId, isEntityId, type EntityId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp, type IsoTimestamp, type Versioned } from "../migrations/schemaVersion.js";

export type NoteScope = "project" | "layout";
export type NoteType = "file" | "freeform";

export interface NoteAttachment extends Versioned {
  readonly id: EntityId;
  readonly scope: NoteScope;
  readonly projectId: EntityId;
  /** Required when scope is "layout"; must be absent when scope is "project". */
  readonly layoutId?: EntityId;
  readonly noteType: NoteType;
  /** Present for "freeform" notes. */
  readonly text?: string;
  /** Present for "file" notes — the display name and a storage-layer reference key to the actual blob. */
  readonly fileName?: string;
  readonly fileStorageKey?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type CreateNoteAttachmentInput = Omit<NoteAttachment, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export function createNoteAttachment(input: CreateNoteAttachmentInput): Result<NoteAttachment> {
  const now = nowIsoTimestamp();
  return validateNoteAttachment({
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export function validateNoteAttachment(candidate: NoteAttachment): Result<NoteAttachment> {
  if (!isEntityId(candidate.id)) {
    return error("NOTE_ATTACHMENT_INVALID_ID", "Note/Attachment id must be a non-empty string.");
  }
  if (!isEntityId(candidate.projectId)) {
    return error("NOTE_ATTACHMENT_INVALID_PROJECT_ID", "Note/Attachment must reference a valid project id.");
  }
  if (candidate.scope === "layout" && !isEntityId(candidate.layoutId)) {
    return error("NOTE_ATTACHMENT_MISSING_LAYOUT_ID", "A layout-scoped note must reference a valid layout id.");
  }
  if (candidate.scope === "project" && candidate.layoutId !== undefined) {
    return error("NOTE_ATTACHMENT_UNEXPECTED_LAYOUT_ID", "A project-wide note must not reference a layout id.");
  }
  if (candidate.noteType === "freeform" && !candidate.text?.trim()) {
    return error("NOTE_ATTACHMENT_MISSING_TEXT", "A freeform note must include non-empty text.");
  }
  if (candidate.noteType === "file" && (!candidate.fileName?.trim() || !candidate.fileStorageKey?.trim())) {
    return error("NOTE_ATTACHMENT_MISSING_FILE_REF", "A file note must include a file name and storage key.");
  }
  return ok(candidate);
}
