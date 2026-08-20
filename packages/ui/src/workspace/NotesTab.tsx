/**
 * Project-wide/Layout-scoped notes toggle, file uploads, freeform text
 * (Spec §6.3). File content is stored as a data: URL in fileStorageKey —
 * a reasonable simple strategy for local-first IndexedDB storage, since
 * no dedicated blob-storage file exists in the Engineering File Plan.
 */

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { createNoteAttachment, type CreateNoteAttachmentInput, type EntityId, type NoteAttachment, type NoteScope } from "@rack-app/state";
import { useAppStores } from "../app/stores.js";

export interface NotesTabProps {
  readonly projectId: EntityId;
  readonly layoutId: EntityId;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export function NotesTab({ projectId, layoutId }: NotesTabProps) {
  const { repositories } = useAppStores();
  const [scope, setScope] = useState<NoteScope>("layout");
  const [notes, setNotes] = useState<readonly NoteAttachment[]>([]);
  const [text, setText] = useState("");

  const loadNotes = useCallback(async () => {
    const result = await repositories.notes.list();
    if (result.kind === "error") return;
    setNotes(
      result.value.filter((note) => note.projectId === projectId && (scope === "project" ? note.scope === "project" : note.layoutId === layoutId)),
    );
  }, [repositories, projectId, layoutId, scope]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  type ScopeFields = Pick<CreateNoteAttachmentInput, "scope" | "projectId" | "layoutId">;

  function baseFields(): ScopeFields {
    return scope === "project" ? { scope: "project", projectId } : { scope: "layout", projectId, layoutId };
  }

  async function saveNote(input: CreateNoteAttachmentInput): Promise<void> {
    const result = createNoteAttachment(input);
    if (result.kind === "error") {
      window.alert(result.message);
      return;
    }
    const saveResult = await repositories.notes.save(result.value);
    if (saveResult.kind === "error") {
      window.alert(saveResult.message);
      return;
    }
    await loadNotes();
  }

  async function handleAddFreeform(): Promise<void> {
    if (text.trim() === "") return;
    await saveNote({ ...baseFields(), noteType: "freeform", text });
    setText("");
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    const dataUrl = await readFileAsDataUrl(file);
    await saveNote({ ...baseFields(), noteType: "file", fileName: file.name, fileStorageKey: dataUrl });
    event.target.value = "";
  }

  return (
    <div style={{ padding: 16, maxWidth: 480 }}>
      <div role="group" aria-label="Note scope">
        <button aria-pressed={scope === "project"} onClick={() => setScope("project")}>
          Project-wide
        </button>
        <button aria-pressed={scope === "layout"} onClick={() => setScope("layout")}>
          This Layout
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {notes.length === 0 && <li style={{ color: "var(--color-text-secondary)" }}>No notes yet.</li>}
        {notes.map((note) => (
          <li key={note.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
            {note.noteType === "freeform" ? (
              note.text
            ) : (
              <a href={note.fileStorageKey} download={note.fileName}>
                {note.fileName}
              </a>
            )}
          </li>
        ))}
      </ul>

      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a note…" style={{ width: "100%", minHeight: 60 }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <button onClick={() => void handleAddFreeform()}>Add note</button>
        <input type="file" onChange={(event) => void handleFileUpload(event)} />
      </div>
    </div>
  );
}
