/**
 * Renders one project's thumbnail, name, last-edited date, and layout
 * count (Spec §6.2).
 */

import { Link } from "react-router-dom";
import type { Project } from "@rack-app/state";

export interface ProjectCardProps {
  readonly project: Project;
  readonly layoutCount: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ProjectCard({ project, layoutCount }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.id}`}
      style={{
        display: "block",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        background: "var(--color-bg-card)",
      }}
    >
      <div style={{ aspectRatio: "4 / 3", background: "var(--color-bg-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {project.thumbnailDataUrl !== undefined ? (
          <img src={project.thumbnailDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>No preview yet</span>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 500 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span>{formatDate(project.updatedAt)}</span>
          <span>
            {layoutCount} {layoutCount === 1 ? "layout" : "layouts"}
          </span>
        </div>
      </div>
    </Link>
  );
}
