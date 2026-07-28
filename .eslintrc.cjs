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
  },
  plugins: ["@typescript-eslint", "boundaries"],
  settings: {
    "boundaries/elements": [
      { type: "rules-engine", pattern: "packages/rules-engine/src/*" },
      { type: "data", pattern: "packages/data/src/*" },
      { type: "state", pattern: "packages/state/src/*" },
      { type: "canvas", pattern: "packages/canvas/src/*" },
      { type: "ui", pattern: "packages/ui/src/*" },
      { type: "export", pattern: "packages/export/src/*" },
      { type: "import", pattern: "packages/import/src/*" },
    ],
  },
  rules: {
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "rules-engine", allow: [] },
          { from: "data", allow: ["rules-engine"] },
          { from: "state", allow: ["data", "rules-engine"] },
          { from: "canvas", allow: ["state", "rules-engine"] },
          { from: "ui", allow: ["state", "canvas", "rules-engine"] },
          { from: "export", allow: ["data", "rules-engine"] },
          { from: "import", allow: ["data", "rules-engine"] },
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
