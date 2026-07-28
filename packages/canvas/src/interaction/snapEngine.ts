/**
 * Given a cursor position and nearby geometry, returns the best snap
 * point — shared by every tool that needs grid/ortho/object snap (Spec
 * §6.3.1a). Single shared implementation so grid snap, ortho mode, and
 * object snap can never drift into inconsistent behavior between tools
 * (Engineering File Plan §5.2).
 *
 * Priority: Object Snap (endpoint/midpoint/center/edge/intersection,
 * nearest candidate within snapRadiusIn) beats Grid Snap beats the raw
 * cursor position. Ortho Mode is a separate constraint applied afterward —
 * it locks the resolved point to horizontal/vertical relative to a drag
 * origin, rather than competing as its own snap candidate.
 */

import { fromInches, toInches, type Length } from "@rack-app/rules-engine";
import type { ZoneBoundaryPoint } from "@rack-app/state";

export type SnapPointType = "none" | "grid" | "endpoint" | "midpoint" | "center" | "edge" | "intersection";
export type ObjectSnapType = Exclude<SnapPointType, "grid" | "none">;

export interface SnapPoint {
  readonly xIn: Length;
  readonly yIn: Length;
  readonly type: SnapPointType;
}

export interface SnapEdge {
  readonly a: ZoneBoundaryPoint;
  readonly b: ZoneBoundaryPoint;
}

export interface SnapCandidateGeometry {
  readonly endpoints: readonly ZoneBoundaryPoint[];
  readonly midpoints: readonly ZoneBoundaryPoint[];
  readonly centers: readonly ZoneBoundaryPoint[];
  readonly edges: readonly SnapEdge[];
}

export interface SnapEngineOptions {
  readonly gridSnapEnabled: boolean;
  readonly gridIntervalIn: Length;
  readonly objectSnapEnabled: boolean;
  /** Which individual object-snap point types are toggled on (Spec §6.3.1a: "individual snap-point types toggleable"). */
  readonly objectSnapTypes: ReadonlySet<ObjectSnapType>;
  /** Maximum distance to consider an object-snap point a candidate at all. */
  readonly snapRadiusIn: Length;
  readonly orthoModeEnabled: boolean;
  /** The reference point ortho mode locks relative to (e.g. a drag's start point). */
  readonly orthoOriginIn?: ZoneBoundaryPoint;
}

function toPoint(point: ZoneBoundaryPoint): { x: number; y: number } {
  return { x: toInches(point.xIn), y: toInches(point.yIn) };
}

function fromPoint(point: { x: number; y: number }, type: SnapPointType): SnapPoint {
  return { xIn: fromInches(point.x), yIn: fromInches(point.y), type };
}

function distanceIn(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Closest point on segment ab to the cursor, clamped to the segment (not the infinite line). */
function nearestPointOnSegment(cursor: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return a;
  const t = Math.max(0, Math.min(1, ((cursor.x - a.x) * abx + (cursor.y - a.y) * aby) / lengthSquared));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

/** Intersection point of two line segments, or null if they don't cross. */
function segmentIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): { x: number; y: number } | null {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (denominator === 0) return null; // parallel or collinear

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  const u = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

function collectObjectSnapCandidates(
  cursor: { x: number; y: number },
  geometry: SnapCandidateGeometry,
  types: ReadonlySet<ObjectSnapType>,
  radiusIn: number,
): SnapPoint[] {
  const candidates: SnapPoint[] = [];

  function consider(point: { x: number; y: number }, type: ObjectSnapType): void {
    if (!types.has(type)) return;
    if (distanceIn(cursor, point) <= radiusIn) {
      candidates.push(fromPoint(point, type));
    }
  }

  for (const endpoint of geometry.endpoints) consider(toPoint(endpoint), "endpoint");
  for (const center of geometry.centers) consider(toPoint(center), "center");
  for (const explicitMidpoint of geometry.midpoints) consider(toPoint(explicitMidpoint), "midpoint");

  for (const edge of geometry.edges) {
    const a = toPoint(edge.a);
    const b = toPoint(edge.b);
    consider(midpoint(a, b), "midpoint");
    consider(nearestPointOnSegment(cursor, a, b), "edge");
  }

  if (types.has("intersection")) {
    for (let i = 0; i < geometry.edges.length; i++) {
      for (let j = i + 1; j < geometry.edges.length; j++) {
        const edgeA = geometry.edges[i]!;
        const edgeB = geometry.edges[j]!;
        const intersection = segmentIntersection(toPoint(edgeA.a), toPoint(edgeA.b), toPoint(edgeB.a), toPoint(edgeB.b));
        if (intersection !== null) consider(intersection, "intersection");
      }
    }
  }

  return candidates;
}

function nearestCandidate(cursor: { x: number; y: number }, candidates: readonly SnapPoint[]): SnapPoint | null {
  let best: SnapPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = distanceIn(cursor, toPoint(candidate));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

function computeGridSnapPoint(cursor: { x: number; y: number }, gridIntervalIn: number): SnapPoint {
  return fromPoint(
    { x: Math.round(cursor.x / gridIntervalIn) * gridIntervalIn, y: Math.round(cursor.y / gridIntervalIn) * gridIntervalIn },
    "grid",
  );
}

/** Locks the resolved point to horizontal or vertical relative to origin, whichever axis the cursor moved further along. */
function applyOrthoConstraint(point: SnapPoint, origin: ZoneBoundaryPoint): SnapPoint {
  const originPoint = toPoint(origin);
  const resolvedPoint = toPoint(point);
  const dx = Math.abs(resolvedPoint.x - originPoint.x);
  const dy = Math.abs(resolvedPoint.y - originPoint.y);

  if (dx >= dy) {
    return { ...point, yIn: origin.yIn };
  }
  return { ...point, xIn: origin.xIn };
}

export function computeSnapPoint(
  cursor: ZoneBoundaryPoint,
  geometry: SnapCandidateGeometry,
  options: SnapEngineOptions,
): SnapPoint {
  const cursorPoint = toPoint(cursor);

  let resolved: SnapPoint | null = null;

  if (options.objectSnapEnabled) {
    const candidates = collectObjectSnapCandidates(cursorPoint, geometry, options.objectSnapTypes, toInches(options.snapRadiusIn));
    resolved = nearestCandidate(cursorPoint, candidates);
  }

  if (resolved === null && options.gridSnapEnabled) {
    resolved = computeGridSnapPoint(cursorPoint, toInches(options.gridIntervalIn));
  }

  resolved ??= { xIn: cursor.xIn, yIn: cursor.yIn, type: "none" };

  if (options.orthoModeEnabled && options.orthoOriginIn !== undefined) {
    resolved = applyOrthoConstraint(resolved, options.orthoOriginIn);
  }

  return resolved;
}
