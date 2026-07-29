/**
 * Per-layout thumbs-up control (Spec §6.3b).
 */

import { useState } from "react";
import { createFeedback, type EntityId, type SessionId } from "@rack-app/state";
import { useAppStores } from "../app/stores.js";

export interface ThumbsUpButtonProps {
  readonly layoutId: EntityId;
  readonly shareLinkId: EntityId;
  readonly sessionId: SessionId;
}

export function ThumbsUpButton({ layoutId, shareLinkId, sessionId }: ThumbsUpButtonProps) {
  const { repositories } = useAppStores();
  const [submitted, setSubmitted] = useState(false);

  async function handleClick(): Promise<void> {
    const result = createFeedback({ layoutId, shareLinkId, sessionId, feedbackType: "thumbsUp" });
    if (result.kind === "error") return;
    const saveResult = await repositories.feedback.save(result.value);
    if (saveResult.kind !== "error") setSubmitted(true);
  }

  return (
    <button onClick={() => void handleClick()} disabled={submitted} style={{ padding: "8px 14px", borderRadius: 6 }}>
      {submitted ? "👍 Thanks for the feedback!" : "👍 I like this option"}
    </button>
  );
}
