/**
 * The single internal unit for all rules-engine geometry/length math: an
 * integer number of thousandths-of-an-inch (a "Milliinch"). All math outside
 * this file must consume Milliinch values only — never convert to/from
 * inches mid-calculation — to guard against float drift on fractional
 * values like 5.333" spacing (Engineering File Plan §2.1, §9.1).
 *
 * Conversions to inches, feet-inches, and metric exist here for display only.
 */

export type Milliinch = number & { readonly __brand: "Milliinch" };

const MILLIINCHES_PER_INCH = 1000;
const MILLIMETERS_PER_INCH = 25.4;
const SIXTEENTHS_PER_INCH = 16;
const INCHES_PER_FOOT = 12;

export function fromInches(inches: number): Milliinch {
  return Math.round(inches * MILLIINCHES_PER_INCH) as Milliinch;
}

export function toInches(value: Milliinch): number {
  return value / MILLIINCHES_PER_INCH;
}

export function fromFeet(feet: number): Milliinch {
  return fromInches(feet * INCHES_PER_FOOT);
}

export function toFeet(value: Milliinch): number {
  return toInches(value) / INCHES_PER_FOOT;
}

export function fromMillimeters(millimeters: number): Milliinch {
  return fromInches(millimeters / MILLIMETERS_PER_INCH);
}

export function toMillimeters(value: Milliinch): number {
  return toInches(value) * MILLIMETERS_PER_INCH;
}

export function addMilliinches(a: Milliinch, b: Milliinch): Milliinch {
  return (a + b) as Milliinch;
}

export function subtractMilliinches(a: Milliinch, b: Milliinch): Milliinch {
  return (a - b) as Milliinch;
}

export function scaleMilliinches(value: Milliinch, factor: number): Milliinch {
  return Math.round(value * factor) as Milliinch;
}

/** Negative when a < b, positive when a > b, zero when equal. */
export function compareMilliinches(a: Milliinch, b: Milliinch): number {
  return a - b;
}

export interface FeetInchesDisplay {
  readonly feet: number;
  readonly wholeInches: number;
  /** Fractional inch remainder, in sixteenths (denominator is always 16). */
  readonly numerator: number;
  readonly denominator: 16;
}

/** Feet + whole-inches + nearest-1/16" fraction, for display purposes only. */
export function toFeetInchesDisplay(value: Milliinch): FeetInchesDisplay {
  const totalSixteenths = Math.round(toInches(value) * SIXTEENTHS_PER_INCH);
  const sixteenthsPerFoot = INCHES_PER_FOOT * SIXTEENTHS_PER_INCH;
  const feet = Math.floor(totalSixteenths / sixteenthsPerFoot);
  const remainderSixteenths = totalSixteenths - feet * sixteenthsPerFoot;
  const wholeInches = Math.floor(remainderSixteenths / SIXTEENTHS_PER_INCH);
  const numerator = remainderSixteenths - wholeInches * SIXTEENTHS_PER_INCH;
  return { feet, wholeInches, numerator, denominator: SIXTEENTHS_PER_INCH };
}
