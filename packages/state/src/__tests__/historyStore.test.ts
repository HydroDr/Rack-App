import { describe, expect, it } from "vitest";
import { createHistoryStore, type Command } from "../historyStore.js";

function makeCommand(id: string, log: string[]): Command {
  return {
    id,
    execute: () => log.push(`execute:${id}`),
    invert: () => log.push(`invert:${id}`),
  };
}

describe("historyStore.ts — Spec §6.3.5, Engineering File Plan §4", () => {
  it("push() records an already-executed command without re-invoking execute()", () => {
    const log: string[] = [];
    const store = createHistoryStore();
    store.getState().push(makeCommand("a", log));
    expect(log).toEqual([]);
    expect(store.getState().past).toHaveLength(1);
  });

  it("undo() calls invert() and moves the command to the future stack; redo() calls execute() and moves it back", () => {
    const log: string[] = [];
    const store = createHistoryStore();
    store.getState().push(makeCommand("a", log));

    store.getState().undo();
    expect(log).toEqual(["invert:a"]);
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().future).toHaveLength(1);

    store.getState().redo();
    expect(log).toEqual(["invert:a", "execute:a"]);
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().future).toHaveLength(0);
  });

  it("a new push after an undo clears the redo stack", () => {
    const log: string[] = [];
    const store = createHistoryStore();
    store.getState().push(makeCommand("a", log));
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);

    store.getState().push(makeCommand("b", log));
    expect(store.getState().future).toHaveLength(0);
    expect(store.getState().past.map((c) => c.id)).toEqual(["b"]);
  });

  it("undo()/redo() on an empty stack is a no-op, not a throw", () => {
    const store = createHistoryStore();
    expect(() => store.getState().undo()).not.toThrow();
    expect(() => store.getState().redo()).not.toThrow();
  });

  it("canUndo()/canRedo() reflect stack state", () => {
    const log: string[] = [];
    const store = createHistoryStore();
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(false);

    store.getState().push(makeCommand("a", log));
    expect(store.getState().canUndo()).toBe(true);

    store.getState().undo();
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(true);
  });

  it("caps the past stack at maxHistorySize, evicting the oldest entry — guards unbounded memory growth", () => {
    const log: string[] = [];
    const store = createHistoryStore(3);
    store.getState().push(makeCommand("a", log));
    store.getState().push(makeCommand("b", log));
    store.getState().push(makeCommand("c", log));
    store.getState().push(makeCommand("d", log));

    const past = store.getState().past;
    expect(past).toHaveLength(3);
    expect(past.map((c) => c.id)).toEqual(["b", "c", "d"]);
  });

  it("clear() resets both stacks — used for loading a new Layout, session-only history", () => {
    const log: string[] = [];
    const store = createHistoryStore();
    store.getState().push(makeCommand("a", log));
    store.getState().undo();
    store.getState().clear();
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().future).toHaveLength(0);
  });
});
