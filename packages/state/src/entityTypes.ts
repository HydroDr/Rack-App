/**
 * Re-exports the @rack-app/data entity types and generic identity/
 * timestamp utilities that downstream packages (canvas, later ui)
 * legitimately need for rendering and interaction, without those packages
 * importing @rack-app/data's repository/persistence machinery directly.
 * This is state's data-layer facade: canvas may depend on state for
 * these (Engineering File Plan §1.2 — canvas depends on state,
 * rules-engine only), never on data's storage layer directly.
 *
 * generateId/nowIsoTimestamp/CURRENT_SCHEMA_VERSION are re-exported as
 * values (not just types) because every canvas mutation tool
 * (placementTool, arrayRepeatTool, mirrorTool, pathLaneTool) needs to
 * stamp a fresh id/timestamp on the entities it creates — these are
 * generic identity utilities, not persistence logic.
 */
export type {
  BlockStackZone,
  ComponentColorMap,
  ComponentType,
  EntityId,
  GroupLayer,
  PathLane,
  PathLaneType,
  PathPoint,
  PalletProfile,
  ProtectorKind,
  ProtectorTemplate,
  RackInstance,
  RackTemplate,
  Template,
  Variant,
  WarehouseElement,
  Zone,
  ZoneBoundaryPoint,
} from "@rack-app/data";

export { CURRENT_SCHEMA_VERSION, generateId, nowIsoTimestamp } from "@rack-app/data";
