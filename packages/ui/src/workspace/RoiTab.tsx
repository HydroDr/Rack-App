/**
 * Mode A/B toggle, assumption inputs, payback period output (Spec §5).
 * Square footage footprint / position count / configuration type for the
 * denser (Mode A) or racked (Mode B) side are derived automatically from
 * the selected Zone via zoneMembership.ts + bomUtils.ts; every other
 * field is a client-editable assumption the designer types in, per Spec
 * §5.2/§5.3's Input Source tables.
 */

import { useMemo, useState } from "react";
import { computeZoneMembership } from "@rack-app/canvas";
import {
  computeRoiModeA,
  computeRoiModeB,
  type RoiModeAResult,
  type RoiModeBResult,
} from "@rack-app/rules-engine";
import type {
  PalletProfile,
  ProtectorPlacement,
  RackInstance,
  RackTemplate,
  RoiModeAAssumptions,
  RoiModeBAssumptions,
  Zone,
} from "@rack-app/state";
import { useLayoutStore, useUiPreferencesStore } from "../app/stores.js";
import { computeInstanceBounds } from "../app/instanceGeometry.js";
import { computeInstanceBom } from "./bomUtils.js";

export interface RoiTabProps {
  readonly templates: readonly RackTemplate[];
  readonly palletProfiles: readonly PalletProfile[];
}

type RoiMode = "A" | "B";

const DEFAULT_MODE_A: RoiModeAAssumptions = {
  rentRatePerSqftPerMonth: 0.5,
  wagePerHour: 20,
  shiftHoursPerDay: 8,
  operatingDaysPerWeek: 5,
  operatingWeeksPerYear: 50,
  baseCrewSize: 2,
  rackCostPerPosition: 150,
  trailersPerDay: 20,
  palletsPerTrailer: 24,
  handlingTimeMinMinutesPerTrailer: 10,
  handlingTimeMaxMinutesPerTrailer: 20,
};

const DEFAULT_MODE_B: RoiModeBAssumptions = {
  monthlyForkliftRent: 2000,
  availableHoursPerMonth: 170,
  laborRatePerHour: 22,
  minutesPerSingleMove: 1.5,
  rentRatePerSqftPerMonth: 0.5,
  rackCostPerPosition: 150,
  palletsPerTrailer: 24,
  operatingDaysPerYear: 250,
};

function computeZonePositionCount(
  zone: Zone,
  rackInstances: ReadonlyMap<string & { readonly __brand: "EntityId" }, RackInstance>,
  templates: readonly RackTemplate[],
  palletProfiles: readonly PalletProfile[],
  defaultAnchorsPerUpright: number,
  protectorPlacements: readonly ProtectorPlacement[],
): { positionCount: number; footprintAreaSqFt: number } {
  const boundsOf = (instance: RackInstance) => {
    const template = templates.find((candidate) => candidate.id === instance.templateId);
    return template === undefined
      ? { minXIn: instance.positionXIn, minYIn: instance.positionYIn, maxXIn: instance.positionXIn, maxYIn: instance.positionYIn }
      : computeInstanceBounds(instance, template);
  };
  const getPositionCount = (instance: RackInstance): number => {
    const template = templates.find((candidate) => candidate.id === instance.templateId);
    if (template === undefined) return 0;
    const palletProfile = palletProfiles.find((candidate) => candidate.id === template.palletProfileId);
    if (palletProfile === undefined) return 0;
    const protectorPlacement = protectorPlacements.find((candidate) => candidate.rackInstanceId === instance.id);
    const result = computeInstanceBom(instance, template, palletProfile, defaultAnchorsPerUpright, protectorPlacement);
    return result.kind === "error" ? 0 : result.value.ppo;
  };

  const membership = computeZoneMembership(zone, rackInstances, boundsOf, getPositionCount);
  return { positionCount: membership.positionCount, footprintAreaSqFt: membership.footprintAreaSqFt };
}

export function RoiTab({ templates, palletProfiles }: RoiTabProps) {
  const zones = useLayoutStore((state) => state.zones);
  const rackInstances = useLayoutStore((state) => state.rackInstances);
  const protectorPlacements = useLayoutStore((state) => state.protectorPlacements);
  const defaultAnchorsPerUpright = useUiPreferencesStore((state) => state.defaultAnchorsPerUpright);

  const [mode, setMode] = useState<RoiMode>("A");
  const [zoneId, setZoneId] = useState<string>("");

  const [assumptionsA, setAssumptionsA] = useState<RoiModeAAssumptions>(DEFAULT_MODE_A);
  const [floorAreaSqFt, setFloorAreaSqFt] = useState(50_000);
  const [floorPositions, setFloorPositions] = useState(500);
  const [floorHandlingMin, setFloorHandlingMin] = useState(8);
  const [floorHandlingMax, setFloorHandlingMax] = useState(15);

  const [assumptionsB, setAssumptionsB] = useState<RoiModeBAssumptions>(DEFAULT_MODE_B);
  const [columnsDeep, setColumnsDeep] = useState(3);
  const [rowsHigh, setRowsHigh] = useState(2);
  const [annualPickMoveVolume, setAnnualPickMoveVolume] = useState(5000);

  const selectedZone = zoneId === "" ? undefined : zones.get(zoneId as never);

  const derived = useMemo(() => {
    if (selectedZone === undefined) return null;
    return computeZonePositionCount(
      selectedZone,
      rackInstances,
      templates,
      palletProfiles,
      defaultAnchorsPerUpright,
      Array.from(protectorPlacements.values()),
    );
  }, [selectedZone, rackInstances, templates, palletProfiles, defaultAnchorsPerUpright, protectorPlacements]);

  const resultA: RoiModeAResult | null = useMemo(() => {
    if (mode !== "A" || derived === null) return null;
    const result = computeRoiModeA({
      rentRatePerSqftPerMonth: assumptionsA.rentRatePerSqftPerMonth,
      monthsPerYear: 12,
      wagePerHour: assumptionsA.wagePerHour,
      shiftHoursPerDay: assumptionsA.shiftHoursPerDay,
      operatingDaysPerWeek: assumptionsA.operatingDaysPerWeek,
      operatingWeeksPerYear: assumptionsA.operatingWeeksPerYear,
      baseCrewSize: assumptionsA.baseCrewSize,
      rackCostPerPosition: assumptionsA.rackCostPerPosition,
      trailersPerDay: assumptionsA.trailersPerDay,
      floorAreaSqFt,
      floorPositions,
      floorBaseline: {
        positionCount: floorPositions,
        rackAreaFootprintSqFt: 0,
        handlingTimeMinMinutesPerTrailer: floorHandlingMin,
        handlingTimeMaxMinutesPerTrailer: floorHandlingMax,
      },
      denserConfiguration: {
        positionCount: derived.positionCount,
        rackAreaFootprintSqFt: derived.footprintAreaSqFt,
        handlingTimeMinMinutesPerTrailer: assumptionsA.handlingTimeMinMinutesPerTrailer,
        handlingTimeMaxMinutesPerTrailer: assumptionsA.handlingTimeMaxMinutesPerTrailer,
      },
    });
    return result.kind === "error" ? null : result.value;
  }, [mode, derived, assumptionsA, floorAreaSqFt, floorPositions, floorHandlingMin, floorHandlingMax]);

  const resultB: RoiModeBResult | null = useMemo(() => {
    if (mode !== "B" || derived === null) return null;
    const result = computeRoiModeB({
      monthlyForkliftRent: assumptionsB.monthlyForkliftRent,
      availableHoursPerMonth: assumptionsB.availableHoursPerMonth,
      laborRatePerHour: assumptionsB.laborRatePerHour,
      minutesPerSingleMove: assumptionsB.minutesPerSingleMove,
      rackCostPerPosition: assumptionsB.rackCostPerPosition,
      positionCount: derived.positionCount,
      annualPickMoveVolume,
      blockStackGrid: { columnsDeep, rowsHigh },
    });
    return result.kind === "error" ? null : result.value;
  }, [mode, derived, assumptionsB, annualPickMoveVolume, columnsDeep, rowsHigh]);

  const payback = mode === "A" ? resultA?.payback : resultB?.payback;

  return (
    <div style={{ padding: 16, maxWidth: 640 }}>
      <div role="group" aria-label="ROI Mode" style={{ marginBottom: 12 }}>
        <button aria-pressed={mode === "A"} onClick={() => setMode("A")}>
          Mode A — Forwarding
        </button>
        <button aria-pressed={mode === "B"} onClick={() => setMode("B")}>
          Mode B — Distribution
        </button>
      </div>

      <label style={{ display: "block", marginBottom: 12 }}>
        Zone:{" "}
        <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
          <option value="">Select a zone…</option>
          {Array.from(zones.values()).map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </label>

      {derived !== null && (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Derived from layout: <span className="tabular-nums">{derived.positionCount}</span> positions,{" "}
          <span className="tabular-nums">{Math.round(derived.footprintAreaSqFt)}</span> sq ft footprint.
        </p>
      )}

      {mode === "A" ? (
        <fieldset>
          <legend>Mode A assumptions</legend>
          <label>Rent ($/sqft/mo): <input type="number" value={assumptionsA.rentRatePerSqftPerMonth} onChange={(e) => setAssumptionsA({ ...assumptionsA, rentRatePerSqftPerMonth: Number(e.target.value) })} /></label>
          <label>Wage ($/hr): <input type="number" value={assumptionsA.wagePerHour} onChange={(e) => setAssumptionsA({ ...assumptionsA, wagePerHour: Number(e.target.value) })} /></label>
          <label>Shift hours/day: <input type="number" value={assumptionsA.shiftHoursPerDay} onChange={(e) => setAssumptionsA({ ...assumptionsA, shiftHoursPerDay: Number(e.target.value) })} /></label>
          <label>Operating days/week: <input type="number" value={assumptionsA.operatingDaysPerWeek} onChange={(e) => setAssumptionsA({ ...assumptionsA, operatingDaysPerWeek: Number(e.target.value) })} /></label>
          <label>Operating weeks/year: <input type="number" value={assumptionsA.operatingWeeksPerYear} onChange={(e) => setAssumptionsA({ ...assumptionsA, operatingWeeksPerYear: Number(e.target.value) })} /></label>
          <label>Base crew size: <input type="number" value={assumptionsA.baseCrewSize} onChange={(e) => setAssumptionsA({ ...assumptionsA, baseCrewSize: Number(e.target.value) })} /></label>
          <label>Rack cost/position: <input type="number" value={assumptionsA.rackCostPerPosition} onChange={(e) => setAssumptionsA({ ...assumptionsA, rackCostPerPosition: Number(e.target.value) })} /></label>
          <label>Trailers/day: <input type="number" value={assumptionsA.trailersPerDay} onChange={(e) => setAssumptionsA({ ...assumptionsA, trailersPerDay: Number(e.target.value) })} /></label>
          <label>Handling time min (min): <input type="number" value={assumptionsA.handlingTimeMinMinutesPerTrailer} onChange={(e) => setAssumptionsA({ ...assumptionsA, handlingTimeMinMinutesPerTrailer: Number(e.target.value) })} /></label>
          <label>Handling time max (min): <input type="number" value={assumptionsA.handlingTimeMaxMinutesPerTrailer} onChange={(e) => setAssumptionsA({ ...assumptionsA, handlingTimeMaxMinutesPerTrailer: Number(e.target.value) })} /></label>
          <legend>Floor baseline</legend>
          <label>Floor area (sq ft): <input type="number" value={floorAreaSqFt} onChange={(e) => setFloorAreaSqFt(Number(e.target.value))} /></label>
          <label>Floor positions: <input type="number" value={floorPositions} onChange={(e) => setFloorPositions(Number(e.target.value))} /></label>
          <label>Floor handling min (min): <input type="number" value={floorHandlingMin} onChange={(e) => setFloorHandlingMin(Number(e.target.value))} /></label>
          <label>Floor handling max (min): <input type="number" value={floorHandlingMax} onChange={(e) => setFloorHandlingMax(Number(e.target.value))} /></label>
        </fieldset>
      ) : (
        <fieldset>
          <legend>Mode B assumptions</legend>
          <label>Forklift rent ($/mo): <input type="number" value={assumptionsB.monthlyForkliftRent} onChange={(e) => setAssumptionsB({ ...assumptionsB, monthlyForkliftRent: Number(e.target.value) })} /></label>
          <label>Available hours/mo: <input type="number" value={assumptionsB.availableHoursPerMonth} onChange={(e) => setAssumptionsB({ ...assumptionsB, availableHoursPerMonth: Number(e.target.value) })} /></label>
          <label>Labor rate ($/hr): <input type="number" value={assumptionsB.laborRatePerHour} onChange={(e) => setAssumptionsB({ ...assumptionsB, laborRatePerHour: Number(e.target.value) })} /></label>
          <label>Minutes/move: <input type="number" value={assumptionsB.minutesPerSingleMove} onChange={(e) => setAssumptionsB({ ...assumptionsB, minutesPerSingleMove: Number(e.target.value) })} /></label>
          <label>Rack cost/position: <input type="number" value={assumptionsB.rackCostPerPosition} onChange={(e) => setAssumptionsB({ ...assumptionsB, rackCostPerPosition: Number(e.target.value) })} /></label>
          <label>Columns deep: <input type="number" value={columnsDeep} onChange={(e) => setColumnsDeep(Number(e.target.value))} /></label>
          <label>Rows high: <input type="number" value={rowsHigh} onChange={(e) => setRowsHigh(Number(e.target.value))} /></label>
          <label>Annual pick/move volume: <input type="number" value={annualPickMoveVolume} onChange={(e) => setAnnualPickMoveVolume(Number(e.target.value))} /></label>
        </fieldset>
      )}

      <div style={{ marginTop: 16, padding: 12, background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 6 }}>
        <strong>Payback Period: </strong>
        <span className="tabular-nums">
          {payback === undefined
            ? "Select a Zone to compute."
            : payback.kind === "noPayback"
              ? "No payback"
              : `${payback.years.toFixed(2)} years`}
        </span>
      </div>
    </div>
  );
}
