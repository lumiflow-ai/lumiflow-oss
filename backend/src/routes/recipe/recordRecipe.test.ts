import { describe, expect, it } from "vitest";

import { RecipeTriggerKind } from "@/types";

import { __visibleForTesting } from "./recordRecipe";

const { mergeItemsByID } = __visibleForTesting;

// Test data constants - complete recipe trigger objects
const FIRST_TRIGGER = {
  id: "trigger-1",
  evaluationGroupID: "group-1",
  name: "First Trigger",
  kind: RecipeTriggerKind.artifactPath,
  creationTimestamp: "2024-01-01T00:00:00.000Z",
  updateTimestamp: "2024-01-01T00:00:00.000Z",
  artifactPathPattern: [{ id: "path1" }],
} as const;

const SECOND_TRIGGER = {
  id: "trigger-2",
  evaluationGroupID: "group-2",
  name: "Second Trigger",
  kind: RecipeTriggerKind.artifactPath,
  creationTimestamp: "2024-01-02T00:00:00.000Z",
  updateTimestamp: "2024-01-02T00:00:00.000Z",
  artifactPathPattern: [{ id: "path2" }],
} as const;

const THIRD_TRIGGER = {
  id: "trigger-3",
  evaluationGroupID: "group-3",
  name: "Third Trigger",
  kind: RecipeTriggerKind.artifactPath,
  creationTimestamp: "2024-01-03T00:00:00.000Z",
  updateTimestamp: "2024-01-03T00:00:00.000Z",
  artifactPathPattern: [{ id: "path3" }],
} as const;

const FOURTH_TRIGGER = {
  id: "trigger-4",
  evaluationGroupID: "group-4",
  name: "Fourth Trigger",
  kind: RecipeTriggerKind.artifactPath,
  creationTimestamp: "2024-01-04T00:00:00.000Z",
  updateTimestamp: "2024-01-04T00:00:00.000Z",
  artifactPathPattern: [{ id: "path4" }],
} as const;

describe("mergeItemsById", () => {
  it("should correctly delete items using string tombstones", () => {
    const existingTriggers = [FIRST_TRIGGER, SECOND_TRIGGER, THIRD_TRIGGER, FOURTH_TRIGGER];
    const sparseUpdates = [SECOND_TRIGGER.id, FOURTH_TRIGGER.id];

    const result = mergeItemsByID(existingTriggers, sparseUpdates);

    expect(result).toEqual([FIRST_TRIGGER, THIRD_TRIGGER]);
  });
});
