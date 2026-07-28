/**
 * ID generation for every entity, plus shared orphan-reference checks (e.g.
 * a Rack Instance whose Template was deleted, a Group/Zone referencing a
 * deleted instance). Centralizes every orphan-guard described throughout
 * the Engineering File Plan in one place, rather than each repository file
 * inventing its own check (§3.4).
 */

export type EntityId = string & { readonly __brand: "EntityId" };

export function generateId(): EntityId {
  return crypto.randomUUID() as EntityId;
}

export function isEntityId(value: unknown): value is EntityId {
  return typeof value === "string" && value.length > 0;
}

/** Referenced IDs that don't exist in the current set of live IDs — an orphan guard shared by every repository/model that holds a foreign key. */
export function findOrphanedReferences(
  referencedIds: readonly EntityId[],
  existingIds: ReadonlySet<EntityId>,
): readonly EntityId[] {
  return referencedIds.filter((id) => !existingIds.has(id));
}

export function hasOrphanedReferences(referencedIds: readonly EntityId[], existingIds: ReadonlySet<EntityId>): boolean {
  return findOrphanedReferences(referencedIds, existingIds).length > 0;
}
