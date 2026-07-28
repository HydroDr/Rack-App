/**
 * Smart-snapping path drawing for foot/forklift lanes; angle-constrained
 * to straight or common-angle segments (Spec §6.3.1d). Object-anchor
 * snapping is interaction/snapEngine.ts's job — callers are expected to
 * run the raw cursor position through computeSnapPoint() before calling
 * addPoint() here; this file owns only the angle constraint, the
 * in-progress polyline, and committing the finished lane through
 * commandStack (Engineering File Plan §5.2).
 */

import type { StoreApi } from "zustand/vanilla";
import { fromInches, toInches, type Length } from "@rack-app/rules-engine";
import {
  CURRENT_SCHEMA_VERSION,
  generateId,
  nowIsoTimestamp,
  type HistoryStore,
  type LayoutStore,
  type PathLane,
  type PathLaneType,
  type ZoneBoundaryPoint,
} from "@rack-app/state";
import { commitCommand, createUpsertCommand, type EntityCommandOps } from "./commandStack.js";

const DEFAULT_ANGLE_SNAP_DEGREES = 45;

export interface PathLaneToolOptions {
  readonly laneType: PathLaneType;
  readonly widthIn: Length;
  readonly markerIntervalIn: Length;
  /** Common-angle increment segments lock to (Spec §6.3.1d default: 45°). */
  readonly angleSnapDegrees?: number;
}

export interface PathLaneBuilder {
  /** Adds a point, constrained to a straight/common-angle segment from the previous point. A deliberate click starts a new segment at a new angle, like a polyline tool. */
  addPoint(point: ZoneBoundaryPoint): void;
  getCurrentSegments(): readonly ZoneBoundaryPoint[];
  /** Commits the drawn lane as a new PathLane, routed through commandStack. Returns null (and leaves nothing committed) if fewer than 2 points were drawn. */
  finish(): PathLane | null;
  cancel(): void;
}

function pathLaneOps(layoutStore: StoreApi<LayoutStore>): EntityCommandOps<PathLane> {
  return {
    upsert: (lane) => layoutStore.getState().upsertPathLane(lane),
    remove: (id) => layoutStore.getState().removePathLane(id),
  };
}

function constrainToAngle(from: ZoneBoundaryPoint, to: ZoneBoundaryPoint, snapDegrees: number): ZoneBoundaryPoint {
  const dx = toInches(to.xIn) - toInches(from.xIn);
  const dy = toInches(to.yIn) - toInches(from.yIn);
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return from;

  const angle = Math.atan2(dy, dx);
  const snapRadians = (snapDegrees * Math.PI) / 180;
  const snappedAngle = Math.round(angle / snapRadians) * snapRadians;

  return {
    xIn: fromInches(toInches(from.xIn) + distance * Math.cos(snappedAngle)),
    yIn: fromInches(toInches(from.yIn) + distance * Math.sin(snappedAngle)),
  };
}

export function createPathLaneTool(
  layoutStore: StoreApi<LayoutStore>,
  historyStore: StoreApi<HistoryStore>,
  options: PathLaneToolOptions,
): PathLaneBuilder {
  const angleSnapDegrees = options.angleSnapDegrees ?? DEFAULT_ANGLE_SNAP_DEGREES;
  const points: ZoneBoundaryPoint[] = [];

  return {
    addPoint: (point) => {
      const previous = points[points.length - 1];
      points.push(previous === undefined ? point : constrainToAngle(previous, point, angleSnapDegrees));
    },

    getCurrentSegments: () => [...points],

    finish: () => {
      if (points.length < 2) return null;

      const layoutId = layoutStore.getState().layoutId;
      if (layoutId === null) {
        throw new Error("Cannot finish a path lane: no Layout is currently loaded.");
      }

      const now = nowIsoTimestamp();
      const lane: PathLane = {
        id: generateId(),
        layoutId,
        laneType: options.laneType,
        widthIn: options.widthIn,
        segments: [...points],
        markerIntervalIn: options.markerIntervalIn,
        createdAt: now,
        updatedAt: now,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };

      commitCommand(historyStore, createUpsertCommand(pathLaneOps(layoutStore), lane));
      points.length = 0;
      return lane;
    },

    cancel: () => {
      points.length = 0;
    },
  };
}
