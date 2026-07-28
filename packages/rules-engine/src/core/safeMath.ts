/**
 * Guarded arithmetic used everywhere a division could hit zero: ROI payback
 * denominators, floor density, Toray grid averages, Mode A shift-hours/
 * operating-days, Mode B forklift available-hours (Engineering File Plan §2.0,
 * §9.1). No other file should perform a raw `/` on a value that could be zero —
 * route it through here instead.
 */

import { error, map, ok, type Result } from "./result.js";

export function safeDivide(numerator: number, denominator: number): Result<number> {
  if (denominator === 0) {
    return error("DIVISION_BY_ZERO", `Cannot divide ${numerator} by a zero denominator.`);
  }
  return ok(numerator / denominator);
}

/** Divides then rounds up — e.g. Mode A's operators-needed = CEILING(operator-hours / shift hours). */
export function safeCeilDivide(numerator: number, denominator: number): Result<number> {
  return map(safeDivide(numerator, denominator), Math.ceil);
}

/** Averages a list of numbers via safeDivide, guarding the empty-list case (Toray grid with 0 positions). */
export function safeAverage(values: readonly number[]): Result<number> {
  const sum = values.reduce((total, value) => total + value, 0);
  return safeDivide(sum, values.length);
}
