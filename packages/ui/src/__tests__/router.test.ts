import { describe, expect, it } from "vitest";
import { isPublicRoute, ROUTE_PATHS } from "../router.js";

describe("router.ts — Spec §6.3a: Client View must never require the account auth every other route needs", () => {
  it("marks the Client View route as public", () => {
    expect(isPublicRoute(ROUTE_PATHS.clientView)).toBe(true);
  });

  it("marks every other route as requiring auth", () => {
    expect(isPublicRoute(ROUTE_PATHS.dashboard)).toBe(false);
    expect(isPublicRoute(ROUTE_PATHS.projectWorkspace)).toBe(false);
    expect(isPublicRoute(ROUTE_PATHS.newTemplate)).toBe(false);
    expect(isPublicRoute(ROUTE_PATHS.editTemplate)).toBe(false);
    expect(isPublicRoute(ROUTE_PATHS.settings)).toBe(false);
  });

  it("defaults an unrecognized path to requiring auth, not public", () => {
    expect(isPublicRoute("/some/unknown/path")).toBe(false);
  });
});
