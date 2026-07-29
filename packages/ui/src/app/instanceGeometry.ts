/**
 * Resolves one Rack Instance's true footprint bounds — combining its
 * Template's beam length/frame depth with the resolved configuration
 * depth (rules-engine's configResolver), the same way bomUtils.ts
 * resolves row spacer length. Shared by CanvasTab (rendering, selection,
 * marquee) and MaterialsTab/CompareTab/RoiTab (Zone membership), since
 * canvas/geometry/bounds.ts and regionQuery.ts deliberately don't resolve
 * Template data themselves (Engineering File Plan §5.0).
 */

import { computeRackInstanceBounds, type Bounds } from "@rack-app/canvas";
import { resolveConfiguration } from "@rack-app/rules-engine";
import type { RackInstance, RackTemplate } from "@rack-app/state";
import { resolveInstanceRowSpacerLengthIn } from "../workspace/bomUtils.js";

export function computeInstanceBounds(instance: RackInstance, template: RackTemplate): Bounds {
  const resolvedRowSpacerLengthIn = resolveInstanceRowSpacerLengthIn(instance, template);

  const configResult = resolveConfiguration({
    configurationType: instance.configurationType,
    frameDepthIn: template.frameDepthIn,
    resolvedRowSpacerLengthIn,
  });
  const ratioDepthIn = configResult.kind === "error" ? template.frameDepthIn : configResult.value.ratioDepthIn;

  return computeRackInstanceBounds({
    positionXIn: instance.positionXIn,
    positionYIn: instance.positionYIn,
    rotationDeg: instance.rotationDeg,
    bays: instance.bays,
    beamLengthIn: template.beamLengthIn,
    ratioDepthIn,
  });
}
