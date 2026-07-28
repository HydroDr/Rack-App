/**
 * Default Interlake Mecalux catalog dataset that catalogLoader validates and
 * loads. Sourced directly from the Interlake Mecalux "Selective Roll Formed
 * Beams and Frames" Product Support Guide (2025 edition):
 *  - Beam ratings: "Beam With Tab End Plate Capacity Chart: 27E-65Q, 48"-168""
 *    (PSG p.88). Values are lbs per beam pair, for the spans the guide lists
 *    with an explicit span label (48" through 168" in 12" increments).
 *  - Row-spacer height bands: "Row Spacer Placement and Quantity Guide"
 *    (PSG p.27).
 *  - Cross-aisle tie bands: Spec §2.5, attributed there to the Interlake
 *    Mecalux support guide, using the resolved inclusive/exclusive boundary
 *    convention documented in that section.
 *
 * Without this file, catalogLoader has nothing to load — this is the
 * concrete data the rest of the engine is meaningless without (Engineering
 * File Plan §2.2).
 */

import type { BeamRating, CatalogData, CrossAisleTieBand, RowSpacerHeightBand } from "../catalogTypes.js";

const BEAM_SPANS_IN = [48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168] as const;

// Capacity in lbs per beam pair, indexed in the same order as BEAM_SPANS_IN.
const BEAM_CAPACITY_LB_PER_PAIR: Readonly<Record<string, readonly number[]>> = {
  "27E": [5610, 5080, 4640, 4290, 3990, 3510, 3080, 2630, 2440, 2200, 1990],
  "36E": [8050, 7230, 6570, 6030, 5590, 5210, 4880, 4510, 4170, 3740, 3370],
  "40E": [9810, 8830, 8040, 7390, 6850, 6390, 6010, 5560, 5370, 4870, 4390],
  "45E": [11090, 9950, 9050, 8300, 7680, 7150, 6700, 6190, 5960, 5650, 5380],
  "50E": [12880, 11530, 10460, 9580, 8850, 8220, 7690, 7090, 6820, 6470, 6150],
  "59E": [16910, 15140, 13720, 12560, 11590, 10780, 10080, 9280, 8940, 8460, 8040],
  "65E": [17115, 17110, 15850, 14480, 13360, 12400, 11580, 10650, 10240, 9690, 9190],
  "65Q": [27940, 24940, 22540, 20570, 18940, 17550, 16370, 15030, 14430, 13640, 12920],
};

function buildBeamRatings(): readonly BeamRating[] {
  const ratings: BeamRating[] = [];
  for (const [family, capacities] of Object.entries(BEAM_CAPACITY_LB_PER_PAIR)) {
    BEAM_SPANS_IN.forEach((lengthIn, index) => {
      ratings.push({ family, lengthIn, capacityLbPerPair: capacities[index] as number });
    });
  }
  return ratings;
}

const ROW_SPACER_HEIGHT_BANDS: readonly RowSpacerHeightBand[] = [
  { minHeightIn: 48, maxHeightIn: 108, spacerCount: 1 },
  { minHeightIn: 120, maxHeightIn: 216, spacerCount: 2 },
  { minHeightIn: 228, maxHeightIn: 288, spacerCount: 3 },
  { minHeightIn: 300, maxHeightIn: 360, spacerCount: 4 },
  { minHeightIn: 372, maxHeightIn: 432, spacerCount: 5 },
  { minHeightIn: 444, maxHeightIn: 480, spacerCount: 6 },
];

const CROSS_AISLE_TIE_BANDS: readonly CrossAisleTieBand[] = [
  {
    minBeamLengthIn: 48,
    minBeamLengthInclusive: true,
    maxBeamLengthIn: 72,
    minRatio: 8,
    minRatioInclusive: true,
    maxRatio: 10,
    tieRule: "everyThirdBay",
  },
  {
    minBeamLengthIn: 72,
    minBeamLengthInclusive: false,
    maxBeamLengthIn: 108,
    minRatio: 8,
    minRatioInclusive: true,
    maxRatio: 10,
    tieRule: "everySecondBay",
  },
  {
    minBeamLengthIn: 108,
    minBeamLengthInclusive: false,
    maxBeamLengthIn: null,
    minRatio: 8,
    minRatioInclusive: true,
    maxRatio: 10,
    tieRule: "everyBay",
  },
  {
    minBeamLengthIn: 0,
    minBeamLengthInclusive: true,
    maxBeamLengthIn: null,
    minRatio: 10,
    minRatioInclusive: false,
    maxRatio: null,
    tieRule: "everyBay",
  },
];

export const interlakeDefaultCatalog: CatalogData = {
  manufacturer: "Interlake Mecalux",
  beamRatings: buildBeamRatings(),
  rowSpacerHeightBands: ROW_SPACER_HEIGHT_BANDS,
  crossAisleTieBands: CROSS_AISLE_TIE_BANDS,
};
