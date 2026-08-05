import { afterEach, describe, expect, it, vi } from "vitest";
import { saveFile } from "../saveFile.js";

describe("saveFile.ts — surfaces save failures instead of failing silently", () => {
  afterEach(() => {
    delete (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    vi.restoreAllMocks();
  });

  it("uses the File System Access API when window.showSaveFilePicker is available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable });
    (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker = showSaveFilePicker;

    const result = await saveFile({ suggestedName: "materials.csv", mimeType: "text/csv", content: "a,b\n1,2" });

    expect(result.kind).toBe("ok");
    expect(showSaveFilePicker).toHaveBeenCalledWith({ suggestedName: "materials.csv" });
    expect(write).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("surfaces a user-cancelled save (AbortError) as a distinct, non-throwing Result", async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker = showSaveFilePicker;

    const result = await saveFile({ suggestedName: "materials.csv", mimeType: "text/csv", content: "a,b" });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("SAVE_FILE_CANCELLED");
  });

  it("surfaces a real write failure (e.g. disk full) as an error Result, never throwing", async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValue(new Error("disk full"));
    (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker = showSaveFilePicker;

    const result = await saveFile({ suggestedName: "materials.csv", mimeType: "text/csv", content: "a,b" });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("SAVE_FILE_FAILED");
    expect(result.message).toContain("disk full");
  });

  it("falls back to a Blob-URL download when showSaveFilePicker is unavailable", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue("blob:mock-url"), revokeObjectURL: vi.fn() });

    const result = await saveFile({ suggestedName: "materials.csv", mimeType: "text/csv", content: "a,b" });

    expect(result.kind).toBe("ok");
    expect(clickSpy).toHaveBeenCalled();
  });
});
