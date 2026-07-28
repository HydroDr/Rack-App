/**
 * Single collection point that gathers every warning object from every other
 * module and tags it by source/category. The "never a hard block" policy
 * (Spec §2.7) lives here in exactly one place — no other module may halt
 * execution on its own (Engineering File Plan §2.10).
 */

import { warningsOf, type Result, type RuleWarning, type WarningCategory } from "../core/result.js";

export interface CollectedWarning extends RuleWarning {
  /** Which module/check produced this warning, for traceability. */
  readonly source: string;
}

export class WarningCollector {
  private readonly warnings: CollectedWarning[] = [];

  collect<T>(source: string, result: Result<T>): void {
    for (const warning of warningsOf(result)) {
      this.warnings.push({ ...warning, source });
    }
  }

  all(): readonly CollectedWarning[] {
    return this.warnings;
  }

  byCategory(category: WarningCategory): readonly CollectedWarning[] {
    return this.warnings.filter((warning) => warning.category === category);
  }

  isEmpty(): boolean {
    return this.warnings.length === 0;
  }
}
