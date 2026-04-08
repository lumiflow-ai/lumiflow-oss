import { describe, expect, it } from "vitest";

import { type Annotation, type ArtifactSnapshotStrict, type MetricReview, MetricReviewValue } from "@/types";

import { mergeSnapshots, mergeTimestampedRecords } from "./artifactSnapshot";

const NOW = new Date("2024-06-15T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();
const EARLIER = "2024-01-01T00:00:00.000Z";

function makeAnnotation(overrides: Partial<Annotation> & { id: string }): Annotation {
  return {
    location: { start: 0, end: 10 },
    content: "test",
    author: "user-1",
    createdTimestamp: EARLIER,
    modifiedTimestamp: EARLIER,
    isDeleted: false,
    ...overrides,
  };
}

function makeAnnotationRecord(...annotations: Annotation[]): Record<string, Annotation> {
  return Object.fromEntries(annotations.map((a) => [a.id, a]));
}

function makeReviewRecord(...overrides: (Partial<MetricReview> & { id: string })[]): Record<string, MetricReview> {
  return Object.fromEntries(
    overrides.map((o) => [
      o.id,
      {
        metricId: "metric-1",
        recipeRunId: "run-1",
        evaluationGroupId: "eval-group-1",
        value: MetricReviewValue.approved,
        author: "user-1",
        createdTimestamp: EARLIER,
        modifiedTimestamp: EARLIER,
        ...o,
      },
    ]),
  );
}

describe("mergeTimestampedRecords", () => {
  it("sets both timestamps on new entries", () => {
    const id = "new-1";
    const existing: Record<string, Annotation> = {};
    const updated = makeAnnotationRecord(makeAnnotation({ id }));

    const result = mergeTimestampedRecords(existing, updated, NOW, "content");

    expect(result[id].createdTimestamp).toBe(NOW_ISO);
    expect(result[id].modifiedTimestamp).toBe(NOW_ISO);
  });

  it("preserves createdTimestamp when updating existing entry", () => {
    const id = "a1";
    const existing = makeAnnotationRecord(makeAnnotation({ id, createdTimestamp: EARLIER }));
    const updated = makeAnnotationRecord(makeAnnotation({ id, content: "updated content" }));

    const result = mergeTimestampedRecords(existing, updated, NOW, "content");

    expect(result[id].createdTimestamp).toBe(EARLIER);
    expect(result[id].modifiedTimestamp).toBe(NOW_ISO);
    expect(result[id].content).toBe("updated content");
  });

  it("preserves modifiedTimestamp when tracked value unchanged", () => {
    const id = "a1";
    const existing = makeAnnotationRecord(makeAnnotation({ id, content: "same", modifiedTimestamp: EARLIER }));
    const updated = makeAnnotationRecord(makeAnnotation({ id, content: "same" }));

    const result = mergeTimestampedRecords(existing, updated, NOW, "content");

    expect(result[id].modifiedTimestamp).toBe(EARLIER);
  });

  it("does not resurrect deleted entries", () => {
    const id = "a1";
    const existing = makeAnnotationRecord(makeAnnotation({ id, isDeleted: true }));
    const updated = makeAnnotationRecord(makeAnnotation({ id, isDeleted: false, content: "trying to resurrect" }));

    const result = mergeTimestampedRecords(existing, updated, NOW, "content");

    expect(result[id].isDeleted).toBe(true);
    expect(result[id].content).toBe("test");
  });

  it("preserves existing entries not in update list", () => {
    const updatedId = "a1";
    const untouchedId = "a2";
    const existing = makeAnnotationRecord(makeAnnotation({ id: updatedId }), makeAnnotation({ id: untouchedId }));
    const updated = makeAnnotationRecord(makeAnnotation({ id: updatedId, content: "updated" }));

    const result = mergeTimestampedRecords(existing, updated, NOW, "content");

    expect(Object.keys(result)).toHaveLength(2);
    expect(result[untouchedId].modifiedTimestamp).toBe(EARLIER);
  });

  it("tracks changes using specified valueKey", () => {
    const id = "r1";
    const existing = makeReviewRecord({ id, value: MetricReviewValue.approved });
    const updated = makeReviewRecord({ id, value: MetricReviewValue.denied });

    const result = mergeTimestampedRecords(existing, updated, NOW, "value");

    expect(result[id].value).toBe(MetricReviewValue.denied);
    expect(result[id].modifiedTimestamp).toBe(NOW_ISO);
  });

  it("preserves modifiedTimestamp when tracked valueKey unchanged", () => {
    const id = "r1";
    const existing = makeReviewRecord({ id, value: MetricReviewValue.approved, modifiedTimestamp: EARLIER });
    const updated = makeReviewRecord({ id, value: MetricReviewValue.approved, metricId: "different-metric" });

    const result = mergeTimestampedRecords(existing, updated, NOW, "value");

    expect(result[id].modifiedTimestamp).toBe(EARLIER);
    expect(result[id].metricId).toBe("different-metric");
  });
});

describe("mergeSnapshots timestamped record merging", () => {
  const minimalSnapshot: ArtifactSnapshotStrict = {
    artifactPath: [{ id: "test" }],
    sourceArtifactSelectors: [],
    eventSummaryID: "event-1",
    tags: {},
    metadata: {},
    timestamp: EARLIER,
    content: null,
    metrics: [],
    generations: [],
    annotations: {},
    reviews: {},
    dueDates: {},
  };

  it("passes now to mergeTimestampedRecords", () => {
    const id = "a1";
    const existing: ArtifactSnapshotStrict = {
      ...minimalSnapshot,
      annotations: makeAnnotationRecord(makeAnnotation({ id })),
    };
    const updated = { annotations: makeAnnotationRecord(makeAnnotation({ id, content: "changed" })) };

    const result = mergeSnapshots({ existingSnapshot: existing, updatedSnapshot: updated, now: NOW });

    expect(result.annotations[id].modifiedTimestamp).toBe(NOW_ISO);
  });

  it("defaults now when not provided", () => {
    const id = "new-1";
    const before = new Date();
    const existing: ArtifactSnapshotStrict = { ...minimalSnapshot, annotations: {} };
    const updated = { annotations: makeAnnotationRecord(makeAnnotation({ id })) };

    const result = mergeSnapshots({ existingSnapshot: existing, updatedSnapshot: updated });
    const after = new Date();

    const resultTimestamp = new Date(result.annotations[id].createdTimestamp);
    expect(resultTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(resultTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("merges reviews tracking value field", () => {
    const id = "r1";
    const existing: ArtifactSnapshotStrict = {
      ...minimalSnapshot,
      reviews: makeReviewRecord({ id, value: MetricReviewValue.approved }),
    };
    const updated = { reviews: makeReviewRecord({ id, value: MetricReviewValue.denied }) };

    const result = mergeSnapshots({ existingSnapshot: existing, updatedSnapshot: updated, now: NOW });

    expect(result.reviews[id].modifiedTimestamp).toBe(NOW_ISO);
  });

  it("overwrites dueDates while preserving others", () => {
    const overwrittenGroup = "group-1";
    const preservedGroup = "group-2";
    const addedGroup = "group-3";
    const existing: ArtifactSnapshotStrict = {
      ...minimalSnapshot,
      dueDates: { [overwrittenGroup]: EARLIER, [preservedGroup]: EARLIER },
    };
    const updated = { dueDates: { [overwrittenGroup]: NOW_ISO, [addedGroup]: NOW_ISO } };

    const result = mergeSnapshots({ existingSnapshot: existing, updatedSnapshot: updated, now: NOW });

    expect(result.dueDates[overwrittenGroup]).toBe(NOW_ISO);
    expect(result.dueDates[preservedGroup]).toBe(EARLIER);
    expect(result.dueDates[addedGroup]).toBe(NOW_ISO);
  });

  it("preserves existing content when partial updates omit content", () => {
    const existing: ArtifactSnapshotStrict = {
      ...minimalSnapshot,
      content: "original content",
    };

    const result = mergeSnapshots({
      existingSnapshot: existing,
      updatedSnapshot: { dueDates: { "group-1": NOW_ISO } },
      now: NOW,
    });

    expect(result.content).toBe("original content");
  });

  it("preserves explicit null content updates", () => {
    const existing: ArtifactSnapshotStrict = {
      ...minimalSnapshot,
      content: "original content",
    };

    const result = mergeSnapshots({
      existingSnapshot: existing,
      updatedSnapshot: { content: null },
      now: NOW,
    });

    expect(result.content).toBeNull();
  });
});
