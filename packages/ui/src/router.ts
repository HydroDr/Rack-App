/**
 * Route definitions and navigation guards (Engineering File Plan §6.0).
 * Client View routes must never require the account auth that every
 * other route needs (Spec §6.3a — no account or login required, click
 * and view immediately) — expressed here as data (requiresAuth: false),
 * not left to App.tsx to remember case-by-case. isPublicRoute() is the
 * single source of truth App.tsx's RequireAuth wrapper consults.
 */

export const ROUTE_PATHS = {
  dashboard: "/",
  projectWorkspace: "/projects/:projectId",
  newTemplate: "/templates/new",
  settings: "/settings",
  clientView: "/share/:token",
} as const;

export interface RouteDefinition {
  readonly path: string;
  readonly requiresAuth: boolean;
}

export const ROUTE_DEFINITIONS: readonly RouteDefinition[] = [
  { path: ROUTE_PATHS.dashboard, requiresAuth: true },
  { path: ROUTE_PATHS.projectWorkspace, requiresAuth: true },
  { path: ROUTE_PATHS.newTemplate, requiresAuth: true },
  { path: ROUTE_PATHS.settings, requiresAuth: true },
  { path: ROUTE_PATHS.clientView, requiresAuth: false },
];

export function isPublicRoute(path: string): boolean {
  const definition = ROUTE_DEFINITIONS.find((route) => route.path === path);
  return definition !== undefined && !definition.requiresAuth;
}
