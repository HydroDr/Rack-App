import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Formalizes the "genuinely separate render path" guarantee (Spec §6.3a,
 * Engineering File Plan §6.5): every file under client-view/ must never
 * import commandStack.ts or any interaction tool. A real-code import scan
 * is the direct, honest verification — the same check performed manually
 * during development, made permanent here so it can't silently regress.
 */
const clientViewDir = join(process.cwd(), "src", "client-view");
const FORBIDDEN_PATTERN = /commandStack|selectionTool|placementTool|arrayRepeatTool|mirrorTool|pathLaneTool/;

function sourceFiles(): readonly string[] {
  return readdirSync(clientViewDir).filter((name: string) => (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.includes(".test."));
}

describe("client-view/ — no file may import commandStack or any interaction tool", () => {
  for (const fileName of sourceFiles()) {
    it(`${fileName} has no mutating-tool import`, () => {
      const source = readFileSync(join(clientViewDir, fileName), "utf-8");
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\*.*$/gm, "");
      expect(codeOnly).not.toMatch(FORBIDDEN_PATTERN);
    });
  }
});
