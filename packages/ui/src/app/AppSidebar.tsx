/**
 * Persistent icon+label navigation rail (Design_System.docx §5.4, §5.7,
 * §5.8) — deliberately always dark regardless of the app's light/dark
 * theme, the same fixed-palette treatment as the login screen.
 *
 * Scoped to the Dashboard and Settings routes only (via AppShell.tsx),
 * not the Canvas workspace or Template Editor — those already have their
 * own dense CAD-style chrome (Toolbar, Properties Panel, Template Panel);
 * stacking a second nav rail alongside them would crowd exactly the
 * screen space a design/drawing surface needs most, and Infurnia's own
 * canvas-screen reference (§5.1) doesn't show one either.
 */

import { NavLink } from "react-router-dom";
import { ROUTE_PATHS } from "../router.js";

interface SidebarNavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: string;
  readonly end: boolean;
}

const NAV_ITEMS: readonly SidebarNavItem[] = [
  { to: ROUTE_PATHS.dashboard, label: "Dashboard", icon: "▦", end: true },
  { to: ROUTE_PATHS.settings, label: "Settings", icon: "⚙", end: false },
];

export function AppSidebar() {
  return (
    <nav
      aria-label="Primary"
      style={{
        width: 76,
        flexShrink: 0,
        minHeight: "100vh",
        background: "var(--color-bg-sidebar-fixed)",
        borderRight: "1px solid var(--color-border-sidebar-fixed)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--space-lg) 0",
        gap: "var(--space-xs)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius)",
          background: "var(--color-accent)",
          color: "var(--color-text-on-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 500,
          fontSize: 15,
          marginBottom: "var(--space-xl)",
        }}
      >
        R
      </div>

      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            width: 60,
            padding: "8px 0",
            borderRadius: "var(--radius)",
            textDecoration: "none",
            background: isActive ? "var(--color-accent-subtle-fixed)" : "transparent",
            color: isActive ? "var(--color-accent)" : "var(--color-text-sidebar-fixed)",
          })}
        >
          <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>
            {item.icon}
          </span>
          <span style={{ fontSize: 10 }}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
