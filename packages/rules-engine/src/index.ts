/**
 * The only file other packages may import from — re-exports the public API
 * of every module in this package. Internal files must not be imported
 * directly from outside the package; this is the decoupling boundary the
 * ESLint boundaries rule (§8) enforces at build time (Engineering File Plan
 * §2.11).
 */

export * from "./core/result.js";
export * from "./core/safeMath.js";

export * from "./units/canonicalUnit.js";
export * from "./units/types.js";

export * from "./catalog/catalogTypes.js";
export * from "./catalog/catalogLoader.js";
export * from "./catalog/beamSelection.js";
export * from "./catalog/data/interlake.default.js";

export * from "./sizing/verticalSizing.js";

export * from "./clearance/clearanceRules.js";

export * from "./configuration/overrideResolver.js";
export * from "./configuration/levelDefinitions.js";
export * from "./configuration/configResolver.js";

export * from "./structural/toppling.js";
export * from "./structural/crossAisleTies.js";
export * from "./structural/levelCapacityCheck.js";

export * from "./bom/bomFormulas.js";
export * from "./bom/rowSpacers.js";
export * from "./bom/protectorsAndAnchors.js";
export * from "./bom/bomAggregator.js";

export * from "./diff/diffEngine.js";

export * from "./roi/roiShared.js";
export * from "./roi/roiModeA.js";
export * from "./roi/roiModeB.js";

export * from "./warnings/warningCollector.js";
