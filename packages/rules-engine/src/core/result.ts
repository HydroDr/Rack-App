/**
 * The single shared Result convention for the rules-engine package.
 * Every formula/rule check returns one of these variants instead of throwing
 * or returning a bare value — see Spec §2.7 (soft-warning policy) and
 * Engineering File Plan §9.2 (only warningCollector.ts represents a rule
 * violation as user-facing state; nothing else throws or halts).
 */

export type WarningCategory =
  | "structural"
  | "clearance"
  | "catalog"
  | "configuration"
  | "bom"
  | "roi";

export interface RuleWarning {
  readonly code: string;
  readonly category: WarningCategory;
  readonly message: string;
}

export interface Ok<T> {
  readonly kind: "ok";
  readonly value: T;
}

export interface OkWithWarnings<T> {
  readonly kind: "warning";
  readonly value: T;
  readonly warnings: readonly RuleWarning[];
}

export interface Err {
  readonly kind: "error";
  readonly code: string;
  readonly message: string;
}

export type Result<T> = Ok<T> | OkWithWarnings<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { kind: "ok", value };
}

/** Returns a plain Ok when there are no warnings, otherwise a Warning result. */
export function withWarnings<T>(value: T, warnings: readonly RuleWarning[]): Result<T> {
  return warnings.length === 0 ? ok(value) : { kind: "warning", value, warnings };
}

export function error<T = never>(code: string, message: string): Result<T> {
  return { kind: "error", code, message };
}

export function isOk<T>(result: Result<T>): result is Ok<T> | OkWithWarnings<T> {
  return result.kind === "ok" || result.kind === "warning";
}

export function isError<T>(result: Result<T>): result is Err {
  return result.kind === "error";
}

/** Warnings attached to a result, or an empty array for ok/error results. */
export function warningsOf<T>(result: Result<T>): readonly RuleWarning[] {
  return result.kind === "warning" ? result.warnings : [];
}

/** Safe accessor that never throws — returns undefined for an error result. */
export function valueOf<T>(result: Result<T>): T | undefined {
  return result.kind === "error" ? undefined : result.value;
}

export function map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
  if (result.kind === "error") return result;
  if (result.kind === "warning") return { kind: "warning", value: fn(result.value), warnings: result.warnings };
  return ok(fn(result.value));
}

/**
 * Combines a list of Results into a single Result of the collected values.
 * Merges warnings across every entry; short-circuits to the first error
 * encountered. Used by aggregators (e.g. bomAggregator) that assemble one
 * output from several independently-validated sub-formulas.
 */
export function combine<T>(results: readonly Result<T>[]): Result<T[]> {
  const values: T[] = [];
  const warnings: RuleWarning[] = [];
  for (const result of results) {
    if (result.kind === "error") return result;
    values.push(result.value);
    if (result.kind === "warning") warnings.push(...result.warnings);
  }
  return withWarnings(values, warnings);
}
