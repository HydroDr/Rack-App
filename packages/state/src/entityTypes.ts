/**
 * Re-exports the @rack-app/data entity types that downstream packages
 * (canvas, later ui) legitimately need to reference for rendering and
 * interaction, without those packages importing @rack-app/data's
 * repository/persistence machinery directly. This is state's data-type
 * facade: canvas may depend on state for types (Engineering File Plan
 * §1.2 — canvas depends on state, rules-engine only), never on data's
 * storage layer directly.
 */
export type {
  BlockStackZone,
  ComponentColorMap,
  ComponentType,
  EntityId,
  GroupLayer,
  PathLane,
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
