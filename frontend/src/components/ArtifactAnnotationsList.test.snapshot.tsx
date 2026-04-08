import { describe, expect, test } from "vitest";

import type { ArtifactSnapshot } from "@/generated/serverTypes";

import { StateObject } from "@/library/StateObject";
import { renderComponent } from "@/library/testing";

import type { TypedArtifactSnapshot } from "@/model/artifactNode";

import { ArtifactAnnotationsList } from "./ArtifactAnnotationsList";
import type { CheckboxState } from "./ui";

const sampleAnnotations: ArtifactSnapshot["annotations"] = {
  "annotation-2": {
    id: "annotation-2",
    location: { start: 12, end: 17 },
    content: "What is the meaning of 'dolor' in this context?",
    author: "user-2",
    createdTimestamp: "2024-02-02T10:15:00.000Z",
    modifiedTimestamp: "2024-02-02T10:15:00.000Z",
    isDeleted: false,
  },
  "annotation-1": {
    id: "annotation-1",
    location: { start: 6, end: 11 },
    content: "'ipsum' means 'itself' in Latin.",
    author: "user-1",
    createdTimestamp: "2024-02-01T09:00:00.000Z",
    modifiedTimestamp: "2024-02-01T09:00:00.000Z",
    isDeleted: false,
  },
  "annotation-3": {
    id: "annotation-3",
    location: { start: 0, end: 1 },
    content: "This one is deleted and should be filtered out.",
    author: "user-3",
    createdTimestamp: "2024-02-03T12:30:00.000Z",
    modifiedTimestamp: "2024-02-03T12:30:00.000Z",
    isDeleted: true,
  },
};

const sampleSnapshot: TypedArtifactSnapshot = {
  content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  annotations: sampleAnnotations,
  timestamp: new Date("2024-02-04T08:00:00.000Z"),
};

const multiArtifactAnnotations1: ArtifactSnapshot["annotations"] = {
  "annotation-1-2": {
    id: "annotation-1-2",
    location: { start: 12, end: 17 },
    content: "What is the meaning of 'dolor' in this context?",
    author: "user-2",
    createdTimestamp: "2024-02-10T15:45:00.000Z",
    modifiedTimestamp: "2024-02-10T15:45:00.000Z",
    isDeleted: false,
  },
  "annotation-1-1": {
    id: "annotation-1-1",
    location: { start: 6, end: 11 },
    content: "'ipsum' means 'itself' in Latin.",
    author: "user-1",
    createdTimestamp: "2024-02-08T10:15:00.000Z",
    modifiedTimestamp: "2024-02-09T18:20:00.000Z",
    isDeleted: false,
  },
  "annotation-1-3": {
    id: "annotation-1-3",
    location: { start: 0, end: 1 },
    content: "Marked for deletion and should not show up.",
    author: "user-3",
    createdTimestamp: "2024-02-12T09:30:00.000Z",
    modifiedTimestamp: "2024-02-12T09:30:00.000Z",
    isDeleted: true,
  },
};

const multiArtifactAnnotations2: ArtifactSnapshot["annotations"] = {
  "annotation-2-1": {
    id: "annotation-2-1",
    location: { start: 0, end: 52 },
    content: "This is a later extract of lorem ipsum.",
    author: "user-2",
    createdTimestamp: "2024-02-10T16:12:00.000Z",
    modifiedTimestamp: "2024-02-10T16:12:00.000Z",
    isDeleted: false,
  },
};

const multiArtifactSnapshot1: TypedArtifactSnapshot = {
  metadata: {
    name: "Artifact Snapshot 1 - Lorem ipsum",
  },
  content:
    "lorem ipsum dolor sit amet, consectetur adipiscing elit. sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  annotations: multiArtifactAnnotations1,
  timestamp: new Date("2024-03-01T12:00:00.000Z"),
};

const multiArtifactSnapshot2: TypedArtifactSnapshot = {
  metadata: {
    name: "Artifact Snapshot 2 - Sed ut",
  },
  content:
    "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
  annotations: multiArtifactAnnotations2,
  timestamp: new Date("2024-03-02T12:00:00.000Z"),
};

const multiArtifactSnapshotWithoutAnnotations: TypedArtifactSnapshot = {
  metadata: {
    name: "Artifact Snapshot 3 - No annotations",
  },
  content: "This artifact snapshot has no annotations.",
  annotations: {},
  timestamp: new Date("2024-03-03T12:00:00.000Z"),
};

describe("ArtifactAnnotationsList", () => {
  test("renders visible annotations sorted by location", async () => {
    const visibilityState = new StateObject<CheckboxState>("on");
    const component = await renderComponent(
      <ArtifactAnnotationsList artifactSnapshots={[sampleSnapshot]} visibilityState={visibilityState} />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders hidden state when toggled off", async () => {
    const visibilityState = new StateObject<CheckboxState>("off");
    const component = await renderComponent(
      <ArtifactAnnotationsList artifactSnapshots={[sampleSnapshot]} visibilityState={visibilityState} />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders annotations list with multiple artifacts", async () => {
    const visibilityState = new StateObject<CheckboxState>("on");
    const component = await renderComponent(
      <ArtifactAnnotationsList
        artifactSnapshots={[multiArtifactSnapshot1, multiArtifactSnapshot2]}
        visibilityState={visibilityState}
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders annotations list with multiple artifacts, one without annotations", async () => {
    const visibilityState = new StateObject<CheckboxState>("on");
    const component = await renderComponent(
      <ArtifactAnnotationsList
        artifactSnapshots={[multiArtifactSnapshot1, multiArtifactSnapshotWithoutAnnotations]}
        visibilityState={visibilityState}
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });
});
