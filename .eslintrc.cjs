/** Enforces package boundaries per Engineering File Plan §1.2 and §8:
 *  - rules-engine has zero dependencies on any other package.
 *  - every package may only import another package's index.ts (its public API),
 *    never reach into another package's internal files.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "boundaries"],
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ["packages/*/tsconfig.json"],
        noWarnOnMultipleProjects: true,
      },
    },
    "boundaries/elements": [
      { type: "rules-engine", pattern: "packages/rules-engine/src/**" },
      { type: "data", pattern: "packages/data/src/**" },
      { type: "state", pattern: "packages/state/src/**" },
      { type: "canvas", pattern: "packages/canvas/src/**" },
      { type: "ui", pattern: "packages/ui/src/**" },
      { type: "export", pattern: "packages/export/src/**" },
      { type: "import", pattern: "packages/import/src/**" },
    ],
  },
  rules: {
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "rules-engine", allow: ["rules-engine"] },
          { from: "data", allow: ["data", "rules-engine"] },
          { from: "state", allow: ["state", "data", "rules-engine"] },
          { from: "canvas", allow: ["canvas", "state", "rules-engine"] },
          { from: "ui", allow: ["ui", "state", "canvas", "rules-engine"] },
          { from: "export", allow: ["export", "data", "rules-engine"] },
          { from: "import", allow: ["import", "data", "rules-engine"] },
        ],
      },
    ],
    "boundaries/entry-point": [
      "error",
      {
        default: "disallow",
        rules: [
          {
            target: ["rules-engine", "data", "state", "canvas", "ui", "export", "import"],
            allow: "index.ts",
          },
        ],
      },
    ],
  },
};
