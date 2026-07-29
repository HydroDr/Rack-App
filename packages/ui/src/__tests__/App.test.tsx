import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * App.tsx's Client-View-must-never-require-auth guarantee is a structural
 * property of the JSX tree (a Route not nested inside RequireAuth) — not
 * something you can query for in rendered output (you can't assert the
 * *absence* of a wrapper via DOM queries once it's already not there).
 * A source-structure check is the direct, honest way to guard it; a full
 * render+navigate test additionally can't cover the other main routes
 * here since they mount a real PixiJS canvas, which jsdom can't provide a
 * WebGL/2D context for (verified separately in a real browser).
 */
const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf-8");

describe("App.tsx — Spec §6.3a / Engineering File Plan §6.0", () => {
  it("wraps every route except Client View in RequireAuth", () => {
    const routeBlocks = appSource.split(/<Route\s/).slice(1);
    expect(routeBlocks.length).toBeGreaterThanOrEqual(5);

    for (const block of routeBlocks) {
      const isClientView = block.includes("ROUTE_PATHS.clientView");
      const wrapsInRequireAuth = block.includes("<RequireAuth>");
      if (isClientView) {
        expect(wrapsInRequireAuth).toBe(false);
      } else {
        expect(wrapsInRequireAuth).toBe(true);
      }
    }
  });

  it("never imports commandStack or any interaction tool directly into the app shell", () => {
    expect(appSource).not.toMatch(/commandStack|selectionTool|placementTool|arrayRepeatTool|mirrorTool|pathLaneTool/);
  });
});
