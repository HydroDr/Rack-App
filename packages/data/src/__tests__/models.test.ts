import { describe, expect, it } from "vitest";
import { fromInches } from "@rack-app/rules-engine";
import { generateId } from "../integrity.js";
import { CURRENT_SCHEMA_VERSION, nowIsoTimestamp } from "../migrations/schemaVersion.js";
import { validateVariant, type Variant } from "../models/variant.js";
import { validateRackInstance, type RackInstance } from "../models/rackInstance.js";
import { validateGroupLayer, type GroupLayer } from "../models/groupLayer.js";
import { validateZone, type Zone } from "../models/zone.js";
import { validateBlockStackZone, type BlockStackZone } from "../models/blockStackZone.js";
import { isShareLinkAccessible, validateShareLink, type ShareLink } from "../models/shareLink.js";
import { generateFeedbackSessionId, validateFeedback, type Feedback } from "../models/feedback.js";

function baseVariant(): Variant {
  const now = nowIsoTimestamp();
  return {
    id: generateId(),
    parentTemplateId: generateId(),
    palletLevels: 3,
    levelCapacitiesLb: [2000, 2000, 2000] as never,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

describe("variant.ts — Spec §6.4.3: must never store configuration type", () => {
  it("accepts a well-formed variant with no configurationType field", () => {
    const result = validateVariant(baseVariant());
    expect(result.kind).toBe("ok");
  });

  it("rejects a variant object caught carrying a configurationType property at runtime, even though the TS type excludes it", () => {
    const contaminated = { ...baseVariant(), configurationType: "single" } as Variant;
    const result = validateVariant(contaminated);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("VARIANT_MUST_NOT_STORE_CONFIGURATION_TYPE");
  });

  it("rejects a level-capacity array whose length doesn't match palletLevels", () => {
    const result = validateVariant({ ...baseVariant(), levelCapacitiesLb: [2000] as never });
    expect(result.kind).toBe("error");
  });
});

describe("rackInstance.ts — Spec §6.4.2: must require a valid Template reference", () => {
  function baseInstance(templateId = generateId()): RackInstance {
    const now = nowIsoTimestamp();
    return {
      id: generateId(),
      layoutId: generateId(),
      templateId,
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

  it("accepts an instance whose template exists", () => {
    const templateId = generateId();
    const result = validateRackInstance(baseInstance(templateId), new Set([templateId]));
    expect(result.kind).toBe("ok");
  });

  it("rejects an instance referencing a template that does not exist — refuses to create an orphan", () => {
    const result = validateRackInstance(baseInstance(generateId()), new Set());
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("RACK_INSTANCE_ORPHANED_TEMPLATE");
  });

  it("rejects an unknown configuration type rather than silently defaulting", () => {
    const templateId = generateId();
    const instance = { ...baseInstance(templateId), configurationType: "quadrupleDeep" } as unknown as RackInstance;
    const result = validateRackInstance(instance, new Set([templateId]));
    expect(result.kind).toBe("error");
  });
});

describe("groupLayer.ts / zone.ts — Spec §6.3.3: structurally isolated from each other", () => {
  function baseGroup(): GroupLayer {
    const now = nowIsoTimestamp();
    return {
      id: generateId(),
      layoutId: generateId(),
      name: "Group A",
      memberIds: [generateId()],
      visible: true,
      locked: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  function baseZone(): Zone {
    const now = nowIsoTimestamp();
    return {
      id: generateId(),
      layoutId: generateId(),
      name: "Forwarding Zone",
      roiMode: "forwarding",
      boundary: [
        { xIn: fromInches(0), yIn: fromInches(0) },
        { xIn: fromInches(100), yIn: fromInches(0) },
        { xIn: fromInches(100), yIn: fromInches(100) },
      ],
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  it("accepts a well-formed group and a well-formed zone independently", () => {
    expect(validateGroupLayer(baseGroup()).kind).toBe("ok");
    expect(validateZone(baseZone()).kind).toBe("ok");
  });

  it("rejects a group caught carrying a zoneId reference", () => {
    const contaminated = { ...baseGroup(), zoneId: generateId() } as GroupLayer;
    const result = validateGroupLayer(contaminated);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("GROUP_LAYER_MUST_NOT_REFERENCE_ZONE");
  });

  it("rejects a zone caught carrying a groupId reference", () => {
    const contaminated = { ...baseZone(), groupId: generateId() } as Zone;
    const result = validateZone(contaminated);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("ZONE_MUST_NOT_REFERENCE_GROUP");
  });
});

describe("blockStackZone.ts — Spec §5.3: reject 0 for either dimension at the model level", () => {
  function baseBlockStackZone(): BlockStackZone {
    const now = nowIsoTimestamp();
    return {
      id: generateId(),
      layoutId: generateId(),
      name: "Block Stack A",
      boundary: [
        { xIn: fromInches(0), yIn: fromInches(0) },
        { xIn: fromInches(50), yIn: fromInches(0) },
        { xIn: fromInches(50), yIn: fromInches(50) },
      ],
      columnsDeep: 3,
      rowsHigh: 2,
      totalPositions: 6,
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  it("accepts a well-formed block stack zone", () => {
    expect(validateBlockStackZone(baseBlockStackZone()).kind).toBe("ok");
  });

  it("rejects 0 columns deep", () => {
    const result = validateBlockStackZone({ ...baseBlockStackZone(), columnsDeep: 0 });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("BLOCK_STACK_ZONE_INVALID_COLUMNS");
  });

  it("rejects 0 rows high", () => {
    const result = validateBlockStackZone({ ...baseBlockStackZone(), rowsHigh: 0 });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("BLOCK_STACK_ZONE_INVALID_ROWS");
  });
});

describe("shareLink.ts — Spec §6.3a: expiry evaluated at access time, not creation time", () => {
  function baseLink(expiresAt: string): ShareLink {
    const now = nowIsoTimestamp();
    return {
      id: generateId(),
      projectId: generateId(),
      token: generateId(),
      sharedLayoutIds: [generateId()],
      expiresAt,
      revoked: false,
      viewTimestamps: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  it("is accessible when checked before expiry", () => {
    const link = baseLink(new Date(Date.now() + 1000 * 60 * 60).toISOString());
    expect(validateShareLink(link).kind).toBe("ok");
    expect(isShareLinkAccessible(link)).toBe(true);
  });

  it("becomes inaccessible once the clock passes its expiry — the same stored link, evaluated at a later access time", () => {
    const link = baseLink(new Date(Date.now() + 1000).toISOString());
    expect(isShareLinkAccessible(link, new Date(Date.now()))).toBe(true);
    expect(isShareLinkAccessible(link, new Date(Date.now() + 2000))).toBe(false);
  });

  it("is inaccessible once revoked, even before its expiry", () => {
    const link = { ...baseLink(new Date(Date.now() + 1000 * 60 * 60).toISOString()), revoked: true };
    expect(isShareLinkAccessible(link)).toBe(false);
  });
});

describe("feedback.ts — Spec §6.3b: anonymous submissions need a generated session identifier", () => {
  it("generates a non-empty, unique session id per call", () => {
    const a = generateFeedbackSessionId();
    const b = generateFeedbackSessionId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("rejects a comment missing its pinned position", () => {
    const now = nowIsoTimestamp();
    const feedback: Feedback = {
      id: generateId(),
      layoutId: generateId(),
      shareLinkId: generateId(),
      sessionId: generateFeedbackSessionId(),
      feedbackType: "comment",
      text: "What about this aisle?",
      createdAt: now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    const result = validateFeedback(feedback);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.code).toBe("FEEDBACK_COMMENT_MISSING_POSITION");
  });
});
