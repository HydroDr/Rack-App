import { describe, expect, it } from "vitest";
import { createHistoryStore, type EntityId } from "@rack-app/state";
import { commitCommand, createBatchCommand, createRemoveCommand, createUpsertCommand, type EntityCommandOps } from "../interaction/commandStack.js";

interface FakeEntity {
  readonly id: EntityId;
  readonly value: number;
}

function id(value: string): EntityId {
  return value as unknown as EntityId;
}

function makeFakeStore() {
  const map = new Map<EntityId, FakeEntity>();
  const ops: EntityCommandOps<FakeEntity> = {
    upsert: (entity) => map.set(entity.id, entity),
    remove: (entityId) => map.delete(entityId),
  };
  return { map, ops };
}

describe("interaction/commandStack.ts — Engineering File Plan §5.2", () => {
  it("createUpsertCommand's execute adds the entity, and invert removes it when there was no previous value", () => {
    const { map, ops } = makeFakeStore();
    const entity: FakeEntity = { id: id("a"), value: 1 };
    const command = createUpsertCommand(ops, entity);

    command.execute();
    expect(map.get(id("a"))).toEqual(entity);

    command.invert();
    expect(map.has(id("a"))).toBe(false);
  });

  it("createUpsertCommand's invert restores the previous value when one was supplied (an edit, not a creation)", () => {
    const { map, ops } = makeFakeStore();
    const previous: FakeEntity = { id: id("a"), value: 1 };
    const next: FakeEntity = { id: id("a"), value: 2 };
    map.set(id("a"), previous);

    const command = createUpsertCommand(ops, next, previous);
    command.execute();
    expect(map.get(id("a"))).toEqual(next);

    command.invert();
    expect(map.get(id("a"))).toEqual(previous);
  });

  it("createRemoveCommand's execute removes the entity, and invert restores it", () => {
    const { map, ops } = makeFakeStore();
    const entity: FakeEntity = { id: id("a"), value: 1 };
    map.set(id("a"), entity);

    const command = createRemoveCommand(ops, entity);
    command.execute();
    expect(map.has(id("a"))).toBe(false);

    command.invert();
    expect(map.get(id("a"))).toEqual(entity);
  });

  it("createBatchCommand executes all commands in order and inverts them in reverse order, as one atomic step", () => {
    const { map, ops } = makeFakeStore();
    const batch = createBatchCommand([
      createUpsertCommand(ops, { id: id("a"), value: 1 }),
      createUpsertCommand(ops, { id: id("b"), value: 2 }),
      createUpsertCommand(ops, { id: id("c"), value: 3 }),
    ]);

    batch.execute();
    expect(map.size).toBe(3);

    batch.invert();
    expect(map.size).toBe(0);
  });

  it("commitCommand executes the command exactly once and pushes it onto historyStore as a single undo step", () => {
    const { map, ops } = makeFakeStore();
    const historyStore = createHistoryStore();
    const command = createUpsertCommand(ops, { id: id("a"), value: 1 });

    commitCommand(historyStore, command);
    expect(map.get(id("a"))).toEqual({ id: id("a"), value: 1 });
    expect(historyStore.getState().past).toHaveLength(1);

    historyStore.getState().undo();
    expect(map.has(id("a"))).toBe(false);
  });
});
