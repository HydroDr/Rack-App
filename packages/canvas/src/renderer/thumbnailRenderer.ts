/**
 * Renders a snapshot image of the current Layout for Dashboard project
 * cards and the Properties Panel's mini front-view thumbnail (Spec §6.2,
 * §6.3.2). Debounces/throttles regeneration — don't re-render on every
 * single keystroke of an edit (Engineering File Plan §5.1).
 *
 * The actual "extract a PNG from the PixiJS renderer" step needs a live
 * Renderer bound to a real canvas, which only exists once the ui package
 * wires one up — that step is injected as `generate`, keeping the
 * debounce logic here fully testable without a GPU context.
 */

export type ThumbnailGenerator = () => Promise<string>;

export interface ThumbnailRendererOptions {
  readonly debounceMs?: number;
}

export interface ThumbnailRenderer {
  requestRegeneration(): void;
  getLastThumbnail(): string | undefined;
  dispose(): void;
}

const DEFAULT_DEBOUNCE_MS = 1000;

export function createThumbnailRenderer(generate: ThumbnailGenerator, options: ThumbnailRendererOptions = {}): ThumbnailRenderer {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let lastThumbnail: string | undefined;

  function flush(): void {
    void generate().then((dataUrl) => {
      lastThumbnail = dataUrl;
    });
  }

  return {
    requestRegeneration: () => {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      timeoutHandle = setTimeout(flush, debounceMs);
    },
    getLastThumbnail: () => lastThumbnail,
    dispose: () => {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    },
  };
}
