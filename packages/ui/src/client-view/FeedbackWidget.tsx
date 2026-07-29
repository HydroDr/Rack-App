/**
 * General notes input at the bottom of the Client View (Spec §6.3b).
 */

import { useState } from "react";
import { createFeedback, type EntityId, type SessionId } from "@rack-app/state";
import { useAppStores } from "../app/stores.js";

export interface FeedbackWidgetProps {
  readonly layoutId: EntityId;
  readonly shareLinkId: EntityId;
  readonly sessionId: SessionId;
}

export function FeedbackWidget({ layoutId, shareLinkId, sessionId }: FeedbackWidgetProps) {
  const { repositories } = useAppStores();
  const [text, setText] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (text.trim() === "") return;
    const result = createFeedback({ layoutId, shareLinkId, sessionId, feedbackType: "generalNote", text });
    if (result.kind === "error") {
      window.alert(result.message);
      return;
    }
    const saveResult = await repositories.feedback.save(result.value);
    if (saveResult.kind === "error") {
      window.alert(saveResult.message);
      return;
    }
    setText("");
    setJustSubmitted(true);
  }

  return (
    <div style={{ padding: 12, borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setJustSubmitted(false);
        }}
        placeholder="General feedback about this layout…"
        style={{ width: "100%", minHeight: 60 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <button onClick={() => void handleSubmit()}>Send</button>
        {justSubmitted && <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Thanks for your feedback!</span>}
      </div>
    </div>
  );
}
