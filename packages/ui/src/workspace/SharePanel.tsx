/**
 * Designer-side share link creation/management, plus a feedback viewer
 * per link (Spec §6.3a, §6.6b — view timestamps, thumbs-up, pinned
 * comments, general notes). Reads/writes the exact same ShareLink/
 * Feedback entities ClientViewPage.tsx and ThumbsUpButton.tsx/
 * FeedbackWidget.tsx/CommentPin.tsx write from the anonymous viewer
 * side — this is the mirror-image read/manage view for the designer.
 */

import { useEffect, useState } from "react";
import { toInches } from "@rack-app/rules-engine";
import { createShareLink, DEFAULT_SHARE_LINK_DURATION_DAYS, type EntityId, type Feedback, type Layout, type ShareLink } from "@rack-app/state";
import { useAppStores } from "../app/stores.js";

export interface SharePanelProps {
  readonly projectId: EntityId;
  readonly layouts: readonly Layout[];
  readonly onClose: () => void;
}

function shareUrlFor(link: ShareLink): string {
  return `${window.location.origin}/share/${link.token}`;
}

export function SharePanel({ projectId, layouts, onClose }: SharePanelProps) {
  const { repositories } = useAppStores();
  const [links, setLinks] = useState<readonly ShareLink[]>([]);
  const [feedback, setFeedback] = useState<readonly Feedback[]>([]);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<ReadonlySet<EntityId>>(new Set());
  const [expiryDays, setExpiryDays] = useState(DEFAULT_SHARE_LINK_DURATION_DAYS);
  const [error, setError] = useState<string | null>(null);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);

  useEffect(() => {
    async function reload(): Promise<void> {
      const [linksResult, feedbackResult] = await Promise.all([repositories.shareLinks.list(), repositories.feedback.list()]);
      if (linksResult.kind !== "error") setLinks(linksResult.value.filter((link) => link.projectId === projectId));
      if (feedbackResult.kind !== "error") setFeedback(feedbackResult.value);
    }
    void reload();
  }, [repositories, projectId]);

  function toggleLayout(id: EntityId): void {
    setSelectedLayoutIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function layoutNameFor(id: EntityId): string {
    return layouts.find((layout) => layout.id === id)?.name ?? "(deleted layout)";
  }

  async function handleCreateLink(): Promise<void> {
    setError(null);
    if (selectedLayoutIds.size === 0) {
      setError("Pick at least one layout to share.");
      return;
    }

    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
    const result = createShareLink({ projectId, sharedLayoutIds: Array.from(selectedLayoutIds), expiresAt });
    if (result.kind === "error") {
      setError(result.message);
      return;
    }

    const saveResult = await repositories.shareLinks.save(result.value);
    if (saveResult.kind === "error") {
      setError(saveResult.message);
      return;
    }

    setLinks((current) => [...current, result.value]);
    setLastCreatedUrl(shareUrlFor(result.value));
    setSelectedLayoutIds(new Set());
  }

  async function handleRevoke(link: ShareLink): Promise<void> {
    setError(null);
    const result = await repositories.shareLinks.revoke(link.id);
    if (result.kind === "error") {
      setError(result.message);
      return;
    }
    setLinks((current) => current.map((candidate) => (candidate.id === result.value.id ? result.value : candidate)));
  }

  return (
    <div
      role="dialog"
      aria-label="Share project"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border)",
        padding: 16,
        overflowY: "auto",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Share</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <fieldset style={{ marginTop: 16 }}>
        <legend>New share link</legend>
        {layouts.length === 0 && <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No layouts in this project yet.</p>}
        {layouts.map((layout) => (
          <label key={layout.id} style={{ display: "block" }}>
            <input type="checkbox" checked={selectedLayoutIds.has(layout.id)} onChange={() => toggleLayout(layout.id)} /> {layout.name}
          </label>
        ))}
        <label style={{ display: "block", marginTop: 8 }}>
          Expires in (days):{" "}
          <input type="number" min={1} value={expiryDays} onChange={(event) => setExpiryDays(Number(event.target.value))} />
        </label>

        {error !== null && <p style={{ color: "crimson" }}>{error}</p>}

        <button type="button" onClick={() => void handleCreateLink()} style={{ marginTop: 8 }}>
          Create Link
        </button>

        {lastCreatedUrl !== null && (
          <div style={{ marginTop: 8 }}>
            <label>
              Link created:{" "}
              <input
                readOnly
                value={lastCreatedUrl}
                onFocus={(event) => event.target.select()}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        )}
      </fieldset>

      <div style={{ marginTop: 16 }}>
        <h3>Links &amp; feedback</h3>
        {links.length === 0 && <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No share links yet.</p>}
        {links.map((link) => {
          const linkFeedback = feedback.filter((item) => item.shareLinkId === link.id);
          const thumbsUp = linkFeedback.filter((item) => item.feedbackType === "thumbsUp");
          const comments = linkFeedback.filter((item) => item.feedbackType === "comment");
          const notes = linkFeedback.filter((item) => item.feedbackType === "generalNote");
          const isExpired = Date.parse(link.expiresAt) <= Date.now();
          const lastViewedAt = link.viewTimestamps[link.viewTimestamps.length - 1];

          return (
            <div key={link.id} style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 13, wordBreak: "break-all" }}>{shareUrlFor(link)}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Layouts: {link.sharedLayoutIds.map((id) => layoutNameFor(id)).join(", ")}
                {" — "}
                {link.revoked ? "Revoked" : isExpired ? "Expired" : "Active"}
                {" — expires "}
                {new Date(link.expiresAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Views: {link.viewTimestamps.length}
                {lastViewedAt !== undefined && ` (last: ${new Date(lastViewedAt).toLocaleString()})`}
              </div>

              {!link.revoked && (
                <button type="button" onClick={() => void handleRevoke(link)} style={{ marginTop: 6 }}>
                  Revoke
                </button>
              )}

              <div style={{ marginTop: 8, fontSize: 12 }}>
                <div>
                  Thumbs-up: {thumbsUp.length}
                  {thumbsUp.length > 0 && ` (${thumbsUp.map((item) => layoutNameFor(item.layoutId)).join(", ")})`}
                </div>
                {comments.length > 0 && (
                  <div>
                    Comments:
                    <ul style={{ margin: "4px 0" }}>
                      {comments.map((comment) => (
                        <li key={comment.id}>
                          {comment.text}
                          {comment.positionXIn !== undefined && comment.positionYIn !== undefined
                            ? ` (at ${toInches(comment.positionXIn).toFixed(0)}in, ${toInches(comment.positionYIn).toFixed(0)}in)`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {notes.length > 0 && (
                  <div>
                    Notes:
                    <ul style={{ margin: "4px 0" }}>
                      {notes.map((note) => (
                        <li key={note.id}>{note.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
