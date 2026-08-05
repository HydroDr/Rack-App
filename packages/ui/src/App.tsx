/**
 * Top-level app shell: routing between Dashboard, Project Workspace,
 * Template Editor, Client View, and Settings (Engineering File Plan
 * §6.0).
 */

import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppStoresProvider } from "./app/stores.js";
import { ROUTE_PATHS } from "./router.js";
import { DashboardPage } from "./dashboard/DashboardPage.js";
import { ProjectWorkspace } from "./workspace/ProjectWorkspace.js";
import { TemplateEditorPage } from "./template-editor/TemplateEditorPage.js";
import { ClientViewPage } from "./client-view/ClientViewPage.js";
import { SettingsPage } from "./settings/SettingsPage.js";

/**
 * Placeholder auth guard: this is a personal-first, local-only app with
 * no auth backend yet (Spec §1.1). The guard exists so Client View's
 * exemption from it (router.ts's isPublicRoute) is structural, not
 * incidental — every other route below is wrapped in this; Client View's
 * route deliberately is not.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = true;
  if (!isAuthenticated) return <Navigate to={ROUTE_PATHS.dashboard} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AppStoresProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path={ROUTE_PATHS.dashboard}
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTE_PATHS.projectWorkspace}
            element={
              <RequireAuth>
                <ProjectWorkspace />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTE_PATHS.newTemplate}
            element={
              <RequireAuth>
                <TemplateEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTE_PATHS.editTemplate}
            element={
              <RequireAuth>
                <TemplateEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTE_PATHS.settings}
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          {/* No RequireAuth wrapper — Client View is a public, no-login link (Spec §6.3a). */}
          <Route path={ROUTE_PATHS.clientView} element={<ClientViewPage />} />
        </Routes>
      </BrowserRouter>
    </AppStoresProvider>
  );
}
