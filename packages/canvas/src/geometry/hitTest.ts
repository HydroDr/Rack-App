/**
 * Point-in-shape and shape-overlap tests, shared by selection, marquee
 * selection, and Zone membership (Engineering File Plan §5.0).
 */

import { toInches } from "@rack-app/rules-engine";
import type { ZoneBoundaryPoint } from "@rack-app/state";
import type { Bounds } from "./bounds.js";

export function pointInBounds(point: ZoneBoundaryPoint, bounds: Bounds): boolean {
  return (
    point.xIn >= bounds.minXIn &&
    point.xIn <= bounds.maxXIn &&
    point.yIn >= bounds.minYIn &&
    point.yIn <= bounds.maxYIn
  );
}

export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.minXIn <= b.maxXIn && a.maxXIn >= b.minXIn && a.minYIn <= b.maxYIn && a.maxYIn >= b.minYIn;
}

/** Standard ray-casting point-in-polygon test. */
export function pointInPolygon(point: ZoneBoundaryPoint, polygon: readonly ZoneBoundaryPoint[]): boolean {
  const px = toInches(point.xIn);
  const py = toInches(point.yIn);
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const vertexI = polygon[i]!;
    const vertexJ = polygon[j]!;
    const xi = toInches(vertexI.xIn);
    const yi = toInches(vertexI.yIn);
    const xj = toInches(vertexJ.xIn);
    const yj = toInches(vertexJ.yIn);

    const straddles = yi > py !== yj > py;
    if (straddles) {
      const xAtIntersection = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (px < xAtIntersection) {
        inside = !inside;
      }
    }
  }

  return inside;
}

function boundsOfPolygon(polygon: readonly ZoneBoundaryPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = polygon.map((point) => toInches(point.xIn));
  const ys = polygon.map((point) => toInches(point.yIn));
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function boundsCorners(bounds: Bounds): readonly ZoneBoundaryPoint[] {
  return [
    { xIn: bounds.minXIn, yIn: bounds.minYIn },
    { xIn: bounds.maxXIn, yIn: bounds.minYIn },
    { xIn: bounds.maxXIn, yIn: bounds.maxYIn },
    { xIn: bounds.minXIn, yIn: bounds.maxYIn },
  ];
}

/** Orientation-based segment intersection test (excludes pure collinear overlap, which the corner/vertex containment checks already cover). */
function segmentsIntersect(p1: ZoneBoundaryPoint, p2: ZoneBoundaryPoint, p3: ZoneBoundaryPoint, p4: ZoneBoundaryPoint): boolean {
  function cross(o: ZoneBoundaryPoint, a: ZoneBoundaryPoint, b: ZoneBoundaryPoint): number {
    return (toInches(a.xIn) - toInches(o.xIn)) * (toInches(b.yIn) - toInches(o.yIn)) -
      (toInches(a.yIn) - toInches(o.yIn)) * (toInches(b.xIn) - toInches(o.xIn));
  }

  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);

  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * General bounds-vs-polygon intersection: true if they overlap at all
 * (fully or partially), covering the case where one shape sits entirely
 * inside the other with no edge crossing.
 */
export function boundsIntersectsPolygon(bounds: Bounds, polygon: readonly ZoneBoundaryPoint[]): boolean {
  if (polygon.length < 3) return false;

  const polyBounds = boundsOfPolygon(polygon);
  const quickReject =
    toInches(bounds.maxXIn) < polyBounds.minX ||
    toInches(bounds.minXIn) > polyBounds.maxX ||
    toInches(bounds.maxYIn) < polyBounds.minY ||
    toInches(bounds.minYIn) > polyBounds.maxY;
  if (quickReject) return false;

  if (polygon.some((vertex) => pointInBounds(vertex, bounds))) return true;

  const corners = boundsCorners(bounds);
  if (corners.some((corner) => pointInPolygon(corner, polygon))) return true;

  for (let i = 0; i < corners.length; i++) {
    const edgeStart = corners[i]!;
    const edgeEnd = corners[(i + 1) % corners.length]!;
    for (let j = 0, k = polygon.length - 1; j < polygon.length; k = j++) {
      if (segmentsIntersect(edgeStart, edgeEnd, polygon[j]!, polygon[k]!)) return true;
    }
  }

  return false;
}
