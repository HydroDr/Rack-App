/**
 * Group/Layer list with visibility/lock controls (Spec §6.3.3). Must
 * read from groupLayer models only — must never read or write Zone
 * data, enforcing the Layers/Zones separation in the UI layer too. This
 * is enforced structurally: the props type below has no Zone field at
 * all, so there is nothing to accidentally read.
 */

import type { EntityId, GroupLayer } from "@rack-app/state";

export interface LayersGroupsPanelProps {
  readonly groups: readonly GroupLayer[];
  readonly selectedGroupId: EntityId | null;
  readonly onSelectGroup: (groupId: EntityId) => void;
  readonly onToggleVisibility: (groupId: EntityId) => void;
  readonly onToggleLock: (groupId: EntityId) => void;
}

export function LayersGroupsPanel({ groups, selectedGroupId, onSelectGroup, onToggleVisibility, onToggleLock }: LayersGroupsPanelProps) {
  return (
    <aside style={{ width: 220, padding: 12, borderRight: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <h3 style={{ marginTop: 0 }}>Layers / Groups</h3>
      {groups.length === 0 && <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No groups yet.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {groups.map((group) => (
          <li
            key={group.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
              background: group.id === selectedGroupId ? "var(--color-warning-bg)" : undefined,
            }}
          >
            <button onClick={() => onSelectGroup(group.id)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer" }}>
              {group.name}
            </button>
            <label title="Visible">
              <input type="checkbox" checked={group.visible} onChange={() => onToggleVisibility(group.id)} />
            </label>
            <label title="Locked">
              <input type="checkbox" checked={group.locked} onChange={() => onToggleLock(group.id)} />
            </label>
          </li>
        ))}
      </ul>
    </aside>
  );
}
