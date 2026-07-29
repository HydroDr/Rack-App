/**
 * Read-only renderer for a shared Layout (Spec §6.3a) — no edit
 * affordances rendered at all. This is a genuinely separate render path
 * from CanvasTab.tsx, not the same component with edit controls hidden by
 * CSS: this file never imports commandStack.ts or any interaction tool
 * (selectionTool, placementTool, arrayRepeatTool, mirrorTool,
 * pathLaneTool), so there is no click/drag handler anywhere in this tree
 * that could mutate layoutStore — that code simply does not exist in this
 * component, not just hidden. The only PixiJS pieces used are the pure
 * scene-graph renderer functions (renderScene et al.), which just draw;
 * they carry no interaction wiring of their own.
 *
 * Access is public and account-auth-free by construction: this page reads
 * a ShareLink by token and checks isShareLinkAccessible() at render/view
 * time (Spec §6.3a — expiry checked at access time, not creation time),
 * never anything requiring the account to be logged in.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Application } from "pixi.js";
import { fromInches, resolveConfiguration, toInches } from "@rack-app/rules-engine";
import {
  createFeedback,
  generateFeedbackSessionId,
  isShareLinkAccessible,
  type Feedback,
  type Layout,
  type PathLane,
  type RackInstance,
  type RackTemplate,
  type ShareLink,
  type WarehouseElement,
} from "@rack-app/state";
import { renderScene, type RackRenderInput } from "@rack-app/canvas";
import { useAppStores } from "../app/stores.js";
import { ThumbsUpButton } from "./ThumbsUpButton.js";
import { FeedbackWidget } from "./FeedbackWidget.js";
import { CommentPin } from "./CommentPin.js";

const PIXELS_PER_INCH = 0.12;

interface PendingPin {
  readonly xPx: number;
  readonly yPx: number;
}

/** Pure read-only rendering — no click handlers routed to any mutating tool. Pan/zoom-only per Spec §6.3a; Phase 4 ships static viewing, pan/zoom is a follow-up. */
function ReadOnlyCanvas({
  rackInstances,
  templates,
  warehouseElements,
  pathLanes,
  onCanvasClick,
}: {
  readonly rackInstances: readonly RackInstance[];
  readonly templates: readonly RackTemplate[];
  readonly warehouseElements: readonly WarehouseElement[];
  readonly pathLanes: readonly PathLane[];
  readonly onCanvasClick: (xPx: number, yPx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    let disposed = false;
    const app = new Application();
    const initOptions = containerRef.current === null ? { background: "#f4f5f7" } : { background: "#f4f5f7", resizeTo: containerRef.current };
    void app.init(initOptions).then(() => {
      if (disposed || containerRef.current === null) return;
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;
    });
    return () => {
      disposed = true;
      appRef.current = null;
      app.destroy(true, { children: true });
    };
  }, []);

  const renderInputs = useMemo((): readonly RackRenderInput[] => {
    const inputs: RackRenderInput[] = [];
    for (const instance of rackInstances) {
      const template = templates.find((candidate) => candidate.id === instance.templateId);
      if (template === undefined) continue;
      const configResult = resolveConfiguration({
        configurationType: instance.configurationType,
        frameDepthIn: template.frameDepthIn,
        resolvedRowSpacerLengthIn: fromInches(12),
      });
      const ratioDepthIn = configResult.kind === "error" ? template.frameDepthIn : configResult.value.ratioDepthIn;
      inputs.push({ instance, template, ratioDepthIn });
    }
    return inputs;
  }, [rackInstances, templates]);

  useEffect(() => {
    const app = appRef.current;
    if (app === null) return;
    const scene = renderScene({
      grid: { widthIn: fromInches(6000), heightIn: fromInches(3000), intervalIn: fromInches(120), color: "#dddddd" },
      warehouseElements,
      rackInstances: renderInputs,
      pathLanes,
    });
    scene.root.scale.set(PIXELS_PER_INCH);
    app.stage.removeChildren();
    app.stage.addChild(scene.root);
  });

  return (
    <div
      ref={containerRef}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onCanvasClick(event.clientX - rect.left, event.clientY - rect.top);
      }}
      style={{ flex: 1, position: "relative", overflow: "hidden" }}
    />
  );
}

export function ClientViewPage() {
  const { token } = useParams<{ token: string }>();
  const { repositories } = useAppStores();

  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [accessible, setAccessible] = useState<boolean | null>(null);
  const [layouts, setLayouts] = useState<readonly Layout[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [rackInstances, setRackInstances] = useState<readonly RackInstance[]>([]);
  const [templates, setTemplates] = useState<readonly RackTemplate[]>([]);
  const [warehouseElements, setWarehouseElements] = useState<readonly WarehouseElement[]>([]);
  const [pathLanes, setPathLanes] = useState<readonly PathLane[]>([]);
  const [feedback, setFeedback] = useState<readonly Feedback[]>([]);
  const [commentMode, setCommentMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);

  const [sessionId] = useState(() => generateFeedbackSessionId());

  useEffect(() => {
    async function load(): Promise<void> {
      const linksResult = await repositories.shareLinks.list();
      if (linksResult.kind === "error") {
        setAccessible(false);
        return;
      }
      const link = linksResult.value.find((candidate) => candidate.token === token);
      if (link === undefined) {
        setAccessible(false);
        return;
      }
      setShareLink(link);

      const stillAccessible = isShareLinkAccessible(link);
      setAccessible(stillAccessible);
      if (!stillAccessible) return;

      await repositories.shareLinks.recordView(link.id);

      const [layoutsResult, instancesResult, templatesResult, elementsResult, lanesResult, feedbackResult] = await Promise.all([
        repositories.layouts.list(),
        repositories.rackInstances.list(),
        repositories.templates.listTemplates(),
        repositories.warehouseElements.list(),
        repositories.pathLanes.list(),
        repositories.feedback.list(),
      ]);

      const sharedLayouts = layoutsResult.kind === "error" ? [] : layoutsResult.value.filter((layout) => link.sharedLayoutIds.includes(layout.id));
      setLayouts(sharedLayouts);
      setActiveLayoutId(sharedLayouts[0]?.id ?? null);

      if (instancesResult.kind !== "error") setRackInstances(instancesResult.value.filter((i) => link.sharedLayoutIds.includes(i.layoutId)));
      if (templatesResult.kind !== "error") {
        setTemplates(templatesResult.value.filter((t): t is RackTemplate => t.templateType === "rack"));
      }
      if (elementsResult.kind !== "error") setWarehouseElements(elementsResult.value.filter((e) => link.sharedLayoutIds.includes(e.layoutId)));
      if (lanesResult.kind !== "error") setPathLanes(lanesResult.value.filter((l) => link.sharedLayoutIds.includes(l.layoutId)));
      if (feedbackResult.kind !== "error") setFeedback(feedbackResult.value.filter((f) => f.shareLinkId === link.id));
    }
    void load();
  }, [token, repositories]);

  if (accessible === null) {
    return <p style={{ padding: 24 }}>Loading…</p>;
  }
  if (!accessible) {
    return <p style={{ padding: 24 }}>This share link has expired or is no longer available.</p>;
  }

  const layoutInstances = rackInstances.filter((instance) => instance.layoutId === activeLayoutId);
  const layoutElements = warehouseElements.filter((element) => element.layoutId === activeLayoutId);
  const layoutLanes = pathLanes.filter((lane) => lane.layoutId === activeLayoutId);
  const layoutPins = feedback.filter((entry) => entry.layoutId === activeLayoutId && entry.feedbackType === "comment");

  async function handleCanvasClick(xPx: number, yPx: number): Promise<void> {
    if (!commentMode) return;
    setPendingPin({ xPx, yPx });
  }

  async function handlePostComment(text: string): Promise<void> {
    if (activeLayoutId === null || shareLink === null || pendingPin === null) return;
    const result = createFeedback({
      layoutId: activeLayoutId as never,
      shareLinkId: shareLink.id,
      sessionId,
      feedbackType: "comment",
      positionXIn: fromInches(pendingPin.xPx / PIXELS_PER_INCH),
      positionYIn: fromInches(pendingPin.yPx / PIXELS_PER_INCH),
      text,
    });
    if (result.kind === "error") {
      window.alert(result.message);
      return;
    }
    const saveResult = await repositories.feedback.save(result.value);
    if (saveResult.kind !== "error") {
      setFeedback((previous) => [...previous, result.value]);
    }
    setPendingPin(null);
    setCommentMode(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          {layouts.length > 1 &&
            layouts.map((layout) => (
              <button key={layout.id} aria-pressed={layout.id === activeLayoutId} onClick={() => setActiveLayoutId(layout.id)} style={{ marginRight: 6 }}>
                {layout.name}
              </button>
            ))}
        </div>
        <button aria-pressed={commentMode} onClick={() => setCommentMode((value) => !value)}>
          {commentMode ? "Cancel comment" : "Leave a comment"}
        </button>
      </header>

      <div style={{ flex: 1, position: "relative", display: "flex" }}>
        <ReadOnlyCanvas
          rackInstances={layoutInstances}
          templates={templates}
          warehouseElements={layoutElements}
          pathLanes={layoutLanes}
          onCanvasClick={(xPx, yPx) => void handleCanvasClick(xPx, yPx)}
        />
        {layoutPins.map((pin) => (
          <CommentPin
            key={pin.id}
            xPx={toInches(pin.positionXIn ?? fromInches(0)) * PIXELS_PER_INCH}
            yPx={toInches(pin.positionYIn ?? fromInches(0)) * PIXELS_PER_INCH}
            {...(pin.text !== undefined ? { text: pin.text } : {})}
          />
        ))}
        {pendingPin !== null && (
          <CommentPin xPx={pendingPin.xPx} yPx={pendingPin.yPx} onSubmit={(text) => void handlePostComment(text)} onCancel={() => setPendingPin(null)} />
        )}
      </div>

      {activeLayoutId !== null && shareLink !== null && (
        <>
          <div style={{ padding: 12, borderTop: "1px solid var(--color-border)" }}>
            <ThumbsUpButton layoutId={activeLayoutId as never} shareLinkId={shareLink.id} sessionId={sessionId} />
          </div>
          <FeedbackWidget layoutId={activeLayoutId as never} shareLinkId={shareLink.id} sessionId={sessionId} />
        </>
      )}
    </div>
  );
}
