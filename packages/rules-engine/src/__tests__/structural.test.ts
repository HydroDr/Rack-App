import { describe, expect, it } from "vitest";
import { evaluateToppling, TOPPLING_RATIO_THRESHOLD } from "../structural/toppling.js";
import { evaluateCrossAisleTies } from "../structural/crossAisleTies.js";
import { fromInches } from "../units/canonicalUnit.js";
import { catalog, crossAisleTieExample } from "./fixtures/specWorkedExamples.js";

describe("toppling.ts — Spec §2.5 6:1 threshold (ANSI MH16.1 §12.1.3)", () => {
  it("does not warn exactly at the 6:1 threshold (the code says 'shall not exceed 6 to 1')", () => {
    const result = evaluateToppling({ heightIn: fromInches(120), depthIn: fromInches(20), anchoredOrBracedException: false });
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.ratio).toBe(TOPPLING_RATIO_THRESHOLD);
    expect(result.value.exceedsThreshold).toBe(false);
  });

  it("warns just above the 6:1 threshold", () => {
    const result = evaluateToppling({ heightIn: fromInches(601), depthIn: fromInches(100), anchoredOrBracedException: false });
    expect(result.kind).toBe("warning");
    if (result.kind !== "warning") throw new Error("unreachable");
    expect(result.value.exceedsThreshold).toBe(true);
    expect(result.warnings[0]?.code).toBe("TOPPLING_RATIO_EXCEEDS_THRESHOLD");
  });

  it("suppresses the warning when the documented anchored/braced exception is recorded on the instance", () => {
    const result = evaluateToppling({ heightIn: fromInches(601), depthIn: fromInches(100), anchoredOrBracedException: true });
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.exceedsThreshold).toBe(true);
    expect(result.value.exceptionApplied).toBe(true);
  });

  it("rejects a zero or negative depth rather than dividing by it directly", () => {
    const result = evaluateToppling({ heightIn: fromInches(120), depthIn: fromInches(0), anchoredOrBracedException: false });
    expect(result.kind).toBe("error");
  });

  it("evaluates the Spec §2.5 single-frame worked example (360\" high x 42\" deep) as exceeding the threshold", () => {
    const { singleFrame } = crossAisleTieExample;
    const result = evaluateToppling({ heightIn: singleFrame.heightIn, depthIn: singleFrame.depthIn, anchoredOrBracedException: false });
    expect(result.kind).toBe("warning");
    if (result.kind !== "warning") throw new Error("unreachable");
    expect(result.value.exceedsThreshold).toBe(true);
  });

  it("evaluates the Spec §2.5 back-to-back combined-depth example as well below the threshold", () => {
    const { backToBackFrame } = crossAisleTieExample;
    const result = evaluateToppling({ heightIn: backToBackFrame.heightIn, depthIn: backToBackFrame.depthIn, anchoredOrBracedException: false });
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.exceedsThreshold).toBe(false);
    expect(result.value.ratio).toBeCloseTo(3.75, 5);
  });
});

describe("crossAisleTies.ts — Spec §2.5 8:1 threshold and beam-length/ratio bands", () => {
  it("requires no ties below the 8:1 ratio", () => {
    const result = evaluateCrossAisleTies({ heightIn: fromInches(700), depthIn: fromInches(100), beamLengthIn: 96, catalog });
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.required).toBe(false);
    expect(result.value.tieRule).toBeNull();
  });

  it("requires ties exactly at ratio 8 (inclusive lower bound)", () => {
    const result = evaluateCrossAisleTies({ heightIn: fromInches(800), depthIn: fromInches(100), beamLengthIn: 96, catalog });
    expect(result.kind).toBe("warning");
    if (result.kind !== "warning") throw new Error("unreachable");
    expect(result.value.required).toBe(true);
  });

  it("requires ties exactly at ratio 10 (inclusive upper bound of the length-banded region)", () => {
    const result = evaluateCrossAisleTies({ heightIn: fromInches(1000), depthIn: fromInches(100), beamLengthIn: 96, catalog });
    expect(result.kind).toBe("warning");
    if (result.kind !== "warning") throw new Error("unreachable");
    expect(result.value.required).toBe(true);
    expect(result.value.tieRule).toBe("everySecondBay");
  });

  it("requires one tie per bay regardless of beam length once ratio exceeds 10", () => {
    const shortBeam = evaluateCrossAisleTies({ heightIn: fromInches(1001), depthIn: fromInches(100), beamLengthIn: 48, catalog });
    const longBeam = evaluateCrossAisleTies({ heightIn: fromInches(1001), depthIn: fromInches(100), beamLengthIn: 144, catalog });
    for (const result of [shortBeam, longBeam]) {
      expect(result.kind).toBe("warning");
      if (result.kind !== "warning") throw new Error("unreachable");
      expect(result.value.tieRule).toBe("everyBay");
    }
  });

  it("resolves the 72\" beam-length boundary as inclusive to the first band, and 73\" to the second", () => {
    const at72 = evaluateCrossAisleTies({ heightIn: fromInches(800), depthIn: fromInches(100), beamLengthIn: 72, catalog });
    const at73 = evaluateCrossAisleTies({ heightIn: fromInches(800), depthIn: fromInches(100), beamLengthIn: 73, catalog });
    if (at72.kind !== "warning" || at73.kind !== "warning") throw new Error("unreachable");
    expect(at72.value.tieRule).toBe("everyThirdBay");
    expect(at73.value.tieRule).toBe("everySecondBay");
  });

  it("resolves the 108\" beam-length boundary as inclusive to the second band, and 109\" to the third", () => {
    const at108 = evaluateCrossAisleTies({ heightIn: fromInches(800), depthIn: fromInches(100), beamLengthIn: 108, catalog });
    const at109 = evaluateCrossAisleTies({ heightIn: fromInches(800), depthIn: fromInches(100), beamLengthIn: 109, catalog });
    if (at108.kind !== "warning" || at109.kind !== "warning") throw new Error("unreachable");
    expect(at108.value.tieRule).toBe("everySecondBay");
    expect(at109.value.tieRule).toBe("everyBay");
  });

  it("evaluates the Spec §2.5 single-frame worked example as requiring ties", () => {
    const { singleFrame } = crossAisleTieExample;
    const result = evaluateCrossAisleTies({
      heightIn: singleFrame.heightIn,
      depthIn: singleFrame.depthIn,
      beamLengthIn: singleFrame.beamLengthIn,
      catalog,
    });
    expect(result.kind).toBe("warning");
    if (result.kind !== "warning") throw new Error("unreachable");
    expect(result.value.required).toBe(true);
  });

  it("evaluates the Spec §2.5 back-to-back combined-depth example as not requiring ties", () => {
    const { backToBackFrame } = crossAisleTieExample;
    const result = evaluateCrossAisleTies({
      heightIn: backToBackFrame.heightIn,
      depthIn: backToBackFrame.depthIn,
      beamLengthIn: backToBackFrame.beamLengthIn,
      catalog,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "error") throw new Error("unreachable");
    expect(result.value.required).toBe(false);
  });
});
