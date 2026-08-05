/**
 * Front-view (elevation) drawing surface for defining a template's
 * geometry: levels, beams, uprights, vertical clearances, using the
 * sizing logic in Spec §2.3 — this is a direct visualization of
 * rules-engine's computeVerticalSizing() output, not a re-implementation
 * of its stacking math.
 */

import { useEffect, useMemo, useRef } from "react";
import { Application, Graphics } from "pixi.js";
import { computeVerticalSizing, toInches, type Length } from "@rack-app/rules-engine";

export interface FrontViewCanvasProps {
  readonly palletHeightIn: Length;
  readonly clearanceIn: Length;
  readonly palletLevels: number;
  readonly beamLengthIn: Length;
  readonly ceilingObstructionHeightIn: Length;
  readonly ceilingClearanceIn: Length;
}

const PIXELS_PER_INCH = 0.6;
const CANVAS_WIDTH = 260;
const CANVAS_HEIGHT = 420;

export function FrontViewCanvas({
  palletHeightIn,
  clearanceIn,
  palletLevels,
  beamLengthIn,
  ceilingObstructionHeightIn,
  ceilingClearanceIn,
}: FrontViewCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);

  const sizingResult = useMemo(
    () => computeVerticalSizing(palletHeightIn, clearanceIn, palletLevels, ceilingObstructionHeightIn, ceilingClearanceIn),
    [palletHeightIn, clearanceIn, palletLevels, ceilingObstructionHeightIn, ceilingClearanceIn],
  );

  useEffect(() => {
    let disposed = false;
    let initialized = false;
    const app = new Application();
    void app.init({ background: "#ffffff", width: CANVAS_WIDTH, height: CANVAS_HEIGHT }).then(() => {
      initialized = true;
      // init() is async, so React StrictMode's mount->cleanup->remount cycle can call the
      // cleanup below before this resolves — destroying a not-yet-initialized Application
      // throws inside PixiJS (its resize teardown isn't set up yet), so if disposal already
      // happened, destroy here instead, once it's actually safe to.
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      if (containerRef.current === null) return;
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;
    });
    return () => {
      disposed = true;
      appRef.current = null;
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (app === null || sizingResult.kind === "error") return;

    const graphics = new Graphics();
    const widthPx = toInches(beamLengthIn) * PIXELS_PER_INCH;
    const uprightWidthPx = 4;

    for (const level of sizingResult.value.levels) {
      const topOfPalletPx = toInches(level.topOfPalletHeightIn) * PIXELS_PER_INCH;
      const bottomOfPalletPx = topOfPalletPx - toInches(palletHeightIn) * PIXELS_PER_INCH;
      const y = CANVAS_HEIGHT - topOfPalletPx;
      const height = topOfPalletPx - bottomOfPalletPx;

      // Pallet load box.
      graphics.rect(uprightWidthPx, y, widthPx - uprightWidthPx * 2, height).fill({ color: 0xffcc80 });
      // Beam line at the bottom of this level's pallet.
      graphics.rect(0, CANVAS_HEIGHT - bottomOfPalletPx - 2, widthPx, 3).fill({ color: 0xff6600 });
    }

    // Uprights spanning the full stack height.
    const totalHeightPx = toInches(sizingResult.value.totalHeightIn) * PIXELS_PER_INCH;
    graphics.rect(0, CANVAS_HEIGHT - totalHeightPx, uprightWidthPx, totalHeightPx).fill({ color: 0x2255aa });
    graphics.rect(widthPx - uprightWidthPx, CANVAS_HEIGHT - totalHeightPx, uprightWidthPx, totalHeightPx).fill({ color: 0x2255aa });

    app.stage.removeChildren();
    app.stage.addChild(graphics);
  });

  return (
    <div style={{ padding: 12 }}>
      <div ref={containerRef} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: "1px solid var(--color-border)" }} />
      {sizingResult.kind === "warning" && (
        <p style={{ color: "var(--color-warning)", background: "var(--color-warning-bg)", padding: 6, fontSize: 12, marginTop: 6 }}>
          {sizingResult.warnings[0]?.message}
        </p>
      )}
      {sizingResult.kind === "error" && <p style={{ color: "crimson", fontSize: 12 }}>{sizingResult.message}</p>}
    </div>
  );
}
