/**
 * Shape of injected catalog data — beam ratings by length/gauge, spacer-count
 * by upright height, and cross-aisle tie bands. This is the single point
 * where "manufacturer spec sheet" becomes swappable data, not code
 * (Engineering File Plan §2.2).
 */

/** One beam family's rated capacity at a given span. */
export interface BeamRating {
  /** Manufacturer beam family code, e.g. "27E", "65Q". */
  readonly family: string;
  /** Nominal span (beam length) in inches. */
  readonly lengthIn: number;
  /** Rated capacity of one beam PAIR (both beams at a level), in lbs. */
  readonly capacityLbPerPair: number;
}

/** Row-spacer count for a frame-height bracket (Spec §3.1, "spacers-per-height"). */
export interface RowSpacerHeightBand {
  /** Inclusive lower bound, inches. */
  readonly minHeightIn: number;
  /** Inclusive upper bound, inches. */
  readonly maxHeightIn: number;
  readonly spacerCount: number;
}

export type CrossAisleTieRule = "everyThirdBay" | "everySecondBay" | "everyBay";

/**
 * A height-to-depth-ratio / beam-length band from the cross-aisle-tie table
 * (Spec §2.5). Boundary convention: maxBeamLengthIn is always inclusive;
 * minBeamLengthIn/minRatio inclusivity is explicit per band, since the
 * resolved convention makes lower bounds exclusive of the previous band's
 * upper bound (e.g. a 72" beam falls in the 48-72" band, not the 72-108" one).
 */
export interface CrossAisleTieBand {
  readonly minBeamLengthIn: number;
  readonly minBeamLengthInclusive: boolean;
  /** null = unbounded ("more than 108"). */
  readonly maxBeamLengthIn: number | null;
  readonly minRatio: number;
  readonly minRatioInclusive: boolean;
  /** null = unbounded ("more than 10"). */
  readonly maxRatio: number | null;
  readonly tieRule: CrossAisleTieRule;
}

export interface CatalogData {
  readonly manufacturer: string;
  readonly beamRatings: readonly BeamRating[];
  readonly rowSpacerHeightBands: readonly RowSpacerHeightBand[];
  readonly crossAisleTieBands: readonly CrossAisleTieBand[];
}
