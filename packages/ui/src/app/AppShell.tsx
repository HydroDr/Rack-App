/**
 * Wraps a page with the persistent sidebar (Design_System.docx §5.4,
 * §5.7, §5.8). See AppSidebar.tsx for which routes use this and why.
 */

import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar.js";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AppSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
