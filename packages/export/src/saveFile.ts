/**
 * Writes a Blob to disk via the File System Access API when available,
 * falling back to a Blob-URL anchor-click download otherwise. Both paths
 * surface failure as a Result rather than letting a save error vanish
 * silently (Spec §6.3c/§6.6, carried over from the Phase 4 review).
 */

import { error, ok, type Result } from "@rack-app/rules-engine";

export interface SaveFileRequest {
  readonly suggestedName: string;
  readonly mimeType: string;
  readonly content: Blob | string;
}

interface FileSystemWritableFileStreamLike {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

type ShowSaveFilePicker = (options: { suggestedName: string }) => Promise<FileSystemFileHandleLike>;

function toBlob(content: Blob | string, mimeType: string): Blob {
  return content instanceof Blob ? content : new Blob([content], { type: mimeType });
}

async function saveViaFileSystemAccess(request: SaveFileRequest, picker: ShowSaveFilePicker): Promise<Result<void>> {
  try {
    const handle = await picker({ suggestedName: request.suggestedName });
    const writable = await handle.createWritable();
    await writable.write(toBlob(request.content, request.mimeType));
    await writable.close();
    return ok(undefined);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      return error("SAVE_FILE_CANCELLED", "Save was cancelled.");
    }
    return error("SAVE_FILE_FAILED", cause instanceof Error ? cause.message : "Failed to save file.");
  }
}

function saveViaDownloadFallback(request: SaveFileRequest): Result<void> {
  try {
    const blob = toBlob(request.content, request.mimeType);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = request.suggestedName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return ok(undefined);
  } catch (cause) {
    return error("SAVE_FILE_FAILED", cause instanceof Error ? cause.message : "Failed to save file.");
  }
}

export async function saveFile(request: SaveFileRequest): Promise<Result<void>> {
  const picker = (globalThis as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
  if (typeof picker === "function") {
    return saveViaFileSystemAccess(request, picker);
  }
  return saveViaDownloadFallback(request);
}
