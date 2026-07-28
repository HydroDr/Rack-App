/**
 * Draws foot/forklift lanes and their repeating icon markers (Spec
 * §6.3.1d; Engineering File Plan §5.1).
 */

import { Container, Graphics } from "pixi.js";
import { toInches } from "@rack-app/rules-engine";
import type { PathLane } from "@rack-app/state";

const LANE_COLORS: Record<PathLane["laneType"], number> = {
  foot: 0xffaa00,
  forklift: 0xaa00ff,
};

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Walks the polyline, dropping a marker every intervalIn of travelled distance (always including the start point). */
function placeMarkersAlongPath(points: readonly Point[], intervalIn: number): Point[] {
  if (points.length < 2) return points.length === 1 ? [points[0]!] : [];

  const markers: Point[] = [points[0]!];
  let distanceSinceLastMarker = 0;

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]!;
    const end = points[i]!;
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    let travelledInSegment = 0;

    while (distanceSinceLastMarker + (segmentLength - travelledInSegment) >= intervalIn) {
      travelledInSegment += intervalIn - distanceSinceLastMarker;
      const t = segmentLength === 0 ? 0 : travelledInSegment / segmentLength;
      markers.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
      distanceSinceLastMarker = 0;
    }

    distanceSinceLastMarker += segmentLength - travelledInSegment;
  }

  return markers;
}

export function renderPathLane(lane: PathLane): Container {
  const container = new Container();
  const graphics = new Graphics();
  const color = LANE_COLORS[lane.laneType];
  const widthIn = toInches(lane.widthIn);

  const points: Point[] = lane.segments.map((point) => ({ x: toInches(point.xIn), y: toInches(point.yIn) }));

  if (points.length >= 2) {
    graphics.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) {
      graphics.lineTo(point.x, point.y);
    }
    graphics.stroke({ width: widthIn, color, cap: "round", join: "round" });
  }
  container.addChild(graphics);

  const markerIntervalIn = toInches(lane.markerIntervalIn);
  if (markerIntervalIn > 0) {
    const markerGraphics = new Graphics();
    const markerRadiusIn = Math.max(2, widthIn / 4);
    for (const marker of placeMarkersAlongPath(points, markerIntervalIn)) {
      markerGraphics.circle(marker.x, marker.y, markerRadiusIn).fill({ color });
    }
    container.addChild(markerGraphics);
  }

  return container;
}

export function renderPathLanes(lanes: readonly PathLane[]): Container {
  const container = new Container();
  for (const lane of lanes) {
    container.addChild(renderPathLane(lane));
  }
  return container;
}
