/**
 * Renders the "Recent" quick-access row: last 3 opened projects, each
 * linking directly to its last-edited Layout (Spec §6.2). No dedicated
 * "last opened" timestamp exists on Project yet, so updatedAt is used as
 * the practical stand-in for recency.
 */

import { Link } from "react-router-dom";
import type { EntityId, Layout, Project } from "@rack-app/state";

export interface RecentProjectsRowProps {
  readonly projects: readonly Project[];
  readonly layouts: readonly Layout[];
}

const RECENT_COUNT = 3;

function lastEditedLayoutId(projectId: EntityId, layouts: readonly Layout[]): EntityId | undefined {
  const projectLayouts = layouts.filter((layout) => layout.projectId === projectId);
  if (projectLayouts.length === 0) return undefined;
  return [...projectLayouts].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]!.id;
}

export function RecentProjectsRow({ projects, layouts }: RecentProjectsRowProps) {
  const recent = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, RECENT_COUNT);

  if (recent.length === 0) return null;

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 14, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: 0.5 }}>Recent</h2>
      <div style={{ display: "flex", gap: 12 }}>
        {recent.map((project) => {
          const layoutId = lastEditedLayoutId(project.id, layouts);
          const to = layoutId !== undefined ? `/projects/${project.id}?layout=${layoutId}` : `/projects/${project.id}`;
          return (
            <Link
              key={project.id}
              to={to}
              style={{
                padding: "8px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                background: "var(--color-bg-card)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {project.name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
