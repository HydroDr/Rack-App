import { describe, expect, it, beforeEach } from "vitest";
import { fromInches } from "@rack-app/rules-engine";
import { generateId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp } from "../migrations/schemaVersion.js";
import { RackAppDatabase, createIndexedDbRepository } from "../storage/indexedDbAdapter.js";
import { TemplateRepository } from "../repository/templateRepository.js";
import type { RackTemplate } from "../models/template.js";
import type { Variant } from "../models/variant.js";
import type { RackInstance } from "../models/rackInstance.js";

function makeRackTemplate(): RackTemplate {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    templateType: "rack",
    name: "Selective Rack — Interlake",
    componentColors: {},
    palletProfileId: generateId(),
    palletLevels: 3,
    palletHeightIn: fromInches(52),
    clearanceIn: fromInches(4),
    frameDepthIn: fromInches(42),
    beamLengthIn: fromInches(96),
    levelCapacitiesLb: [2500, 2500, 2500] as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function makeRackInstance(templateId: string, layoutId = generateId()): RackInstance {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    layoutId,
    templateId: templateId as never,
    positionXIn: fromInches(0),
    positionYIn: fromInches(0),
    rotationDeg: 0,
    bays: 5,
    configurationType: "backToBack",
    rackColumns: 2,
    anchoredOrBracedException: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

describe("indexedDbAdapter.ts — basic CRUD round-trip via Dexie/fake-indexeddb", () => {
  it("saves, gets, lists, and deletes a record without throwing", async () => {
    const db = new RackAppDatabase(`test-db-${generateId()}`);
    const repo = createIndexedDbRepository<RackTemplate>(db.templates as never);
    const template = makeRackTemplate();

    const saveResult = await repo.save(template);
    expect(saveResult.kind).toBe("ok");

    const getResult = await repo.get(template.id);
    expect(getResult.kind).toBe("ok");
    if (getResult.kind !== "ok") throw new Error("unreachable");
    expect(getResult.value?.id).toBe(template.id);

    const listResult = await repo.list();
    expect(listResult.kind).toBe("ok");
    if (listResult.kind !== "ok") throw new Error("unreachable");
    expect(listResult.value).toHaveLength(1);

    const deleteResult = await repo.delete(template.id);
    expect(deleteResult.kind).toBe("ok");

    const afterDelete = await repo.get(template.id);
    if (afterDelete.kind !== "ok") throw new Error("unreachable");
    expect(afterDelete.value).toBeUndefined();

    db.close();
  });
});

describe("templateRepository.ts — Spec §3.2: deleting a referenced template must block or cascade, never orphan", () => {
  let db: RackAppDatabase;
  let repo: TemplateRepository;

  beforeEach(() => {
    db = new RackAppDatabase(`test-db-${generateId()}`);
    repo = new TemplateRepository(
      createIndexedDbRepository(db.templates as never),
      createIndexedDbRepository<Variant>(db.variants as never),
      createIndexedDbRepository(db.rackInstances as never),
    );
  });

  it("blocks deletion when a live Rack Instance still references the template", async () => {
    const template = makeRackTemplate();
    await repo.saveTemplate(template);
    const instanceRepo = createIndexedDbRepository<RackInstance>(db.rackInstances as never);
    await instanceRepo.save(makeRackInstance(template.id));

    const result = await repo.deleteTemplate(template.id);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("TEMPLATE_DELETE_BLOCKED_BY_INSTANCES");

    const stillThere = await repo.getTemplate(template.id);
    if (stillThere.kind !== "ok") throw new Error("unreachable");
    expect(stillThere.value).toBeDefined();
  });

  it("cascades deletion to referencing Rack Instances when { cascade: true } is passed — never leaves an orphan", async () => {
    const template = makeRackTemplate();
    await repo.saveTemplate(template);
    const instanceRepo = createIndexedDbRepository<RackInstance>(db.rackInstances as never);
    const instance = makeRackInstance(template.id);
    await instanceRepo.save(instance);

    const result = await repo.deleteTemplate(template.id, { cascade: true });
    expect(result.kind).toBe("ok");

    const templateAfter = await repo.getTemplate(template.id);
    if (templateAfter.kind !== "ok") throw new Error("unreachable");
    expect(templateAfter.value).toBeUndefined();

    const instanceAfter = await instanceRepo.get(instance.id);
    if (instanceAfter.kind !== "ok") throw new Error("unreachable");
    expect(instanceAfter.value).toBeUndefined();
  });

  it("deletes cleanly when nothing references the template", async () => {
    const template = makeRackTemplate();
    await repo.saveTemplate(template);
    const result = await repo.deleteTemplate(template.id);
    expect(result.kind).toBe("ok");
  });
});
