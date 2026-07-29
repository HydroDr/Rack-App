/**
 * Click-to-pin comment marker and input (Spec §6.3b).
 */

import { useState } from "react";

export interface CommentPinProps {
  readonly xPx: number;
  readonly yPx: number;
  /** Present for an already-posted pin; absent for a pending pin still awaiting its text. */
  readonly text?: string;
  readonly onSubmit?: (text: string) => void;
  readonly onCancel?: () => void;
}

export function CommentPin({ xPx, yPx, text, onSubmit, onCancel }: CommentPinProps) {
  const [draft, setDraft] = useState("");
  const isPending = text === undefined;

  return (
    <div style={{ position: "absolute", left: xPx, top: yPx, transform: "translate(-50%, -100%)" }}>
      <div
        title={text}
        style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--color-accent)", border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      />
      {isPending && onSubmit !== undefined && (
        <div style={{ position: "absolute", top: 18, left: 0, background: "white", border: "1px solid var(--color-border)", borderRadius: 4, padding: 6, width: 180 }}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} style={{ width: "100%", minHeight: 50 }} autoFocus />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <button onClick={() => draft.trim() !== "" && onSubmit(draft)}>Post</button>
            <button onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
