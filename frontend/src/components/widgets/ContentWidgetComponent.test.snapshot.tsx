import { describe, expect, test } from "vitest";

import type { Annotation, Metric } from "@/generated/serverTypes";

import { renderComponent } from "@/library/testing";

import { ArtifactNode } from "@/model/artifactNode";

import { ArtifactColumn } from "./ContentWidgetComponent";

const createContentRange = ({
  startIndex,
  endIndex,
  content,
  identifiers = [],
  metrics = [],
  annotations = [],
  hasPendingAnnotation = false,
}: {
  startIndex: number;
  endIndex: number;
  content: string;
  identifiers?: string[];
  metrics?: Metric[];
  annotations?: Annotation[];
  hasPendingAnnotation?: boolean;
}) => ({
  startIndex,
  endIndex,
  content,
  identifiers,
  metrics: new Set(metrics),
  annotations: new Set(annotations),
  hasPendingAnnotation,
  targetHighlightRef: { current: null },
  targetHoverRef: { current: null },
  targetTextRef: { current: null },
});

const sampleMetric: Metric = {
  id: "metric-1",
  values: [],
};

const sampleAnnotation: Annotation = {
  id: "annotation-1",
  location: { start: 6, end: 11 },
  content: "This is a note about ipsum",
  author: "user-1",
  createdTimestamp: "2024-02-01T09:00:00.000Z",
  modifiedTimestamp: "2024-02-01T09:00:00.000Z",
  isDeleted: false,
};

const createNode = () =>
  new ArtifactNode({
    id: "test-artifact",
    artifact: {
      artifactPath: [{ kind: "test", id: "test-artifact" }],
      snapshots: [{ content: "Lorem ipsum dolor sit amet" }],
    },
  });

const stubMetricDefinitionForID = () => null;
const stubMetricColorForID = () => "oklch(0.95 0.09 30)";
const stubKindConfigurationForPattern = () => ({
  displayName: "Test",
  otherNames: { one: "Test", other: "Tests" },
  includesID: false,
  pattern: [],
});

describe("ArtifactColumn", () => {
  test("renders plain text without highlights", async () => {
    const component = await renderComponent(
      <ArtifactColumn
        commonArtifactPath={[{ kind: "test", id: "test" }]}
        node={createNode()}
        contentRanges={[createContentRange({ startIndex: 0, endIndex: 26, content: "Lorem ipsum dolor sit amet" })]}
        organizationSlug="test-org"
        metricDefinitionForID={stubMetricDefinitionForID}
        metricColorForID={stubMetricColorForID}
        kindConfigurationForPattern={stubKindConfigurationForPattern}
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders text with metric highlight", async () => {
    const component = await renderComponent(
      <ArtifactColumn
        commonArtifactPath={[{ kind: "test", id: "test" }]}
        node={createNode()}
        contentRanges={[
          createContentRange({ startIndex: 0, endIndex: 6, content: "Lorem " }),
          createContentRange({
            startIndex: 6,
            endIndex: 11,
            content: "ipsum",
            identifiers: ["metric-1-0"],
            metrics: [sampleMetric],
          }),
          createContentRange({ startIndex: 11, endIndex: 26, content: " dolor sit amet" }),
        ]}
        organizationSlug="test-org"
        metricDefinitionForID={stubMetricDefinitionForID}
        metricColorForID={stubMetricColorForID}
        kindConfigurationForPattern={stubKindConfigurationForPattern}
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders text with annotation highlight", async () => {
    const component = await renderComponent(
      <ArtifactColumn
        commonArtifactPath={[{ kind: "test", id: "test" }]}
        node={createNode()}
        contentRanges={[
          createContentRange({ startIndex: 0, endIndex: 6, content: "Lorem " }),
          createContentRange({
            startIndex: 6,
            endIndex: 11,
            content: "ipsum",
            identifiers: ["annotation-1"],
            annotations: [sampleAnnotation],
          }),
          createContentRange({ startIndex: 11, endIndex: 26, content: " dolor sit amet" }),
        ]}
        organizationSlug="test-org"
        metricDefinitionForID={stubMetricDefinitionForID}
        metricColorForID={stubMetricColorForID}
        kindConfigurationForPattern={stubKindConfigurationForPattern}
        showAnnotations={true}
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders text with overlapping metric and annotation highlights", async () => {
    const component = await renderComponent(
      <ArtifactColumn
        commonArtifactPath={[{ kind: "test", id: "test" }]}
        node={createNode()}
        contentRanges={[
          createContentRange({ startIndex: 0, endIndex: 6, content: "Lorem " }),
          createContentRange({
            startIndex: 6,
            endIndex: 11,
            content: "ipsum",
            identifiers: ["metric-1-0", "annotation-1"],
            metrics: [sampleMetric],
            annotations: [sampleAnnotation],
          }),
          createContentRange({ startIndex: 11, endIndex: 26, content: " dolor sit amet" }),
        ]}
        organizationSlug="test-org"
        metricDefinitionForID={stubMetricDefinitionForID}
        metricColorForID={stubMetricColorForID}
        kindConfigurationForPattern={stubKindConfigurationForPattern}
        showAnnotations={true}
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders text with pending annotation highlight", async () => {
    const component = await renderComponent(
      <ArtifactColumn
        commonArtifactPath={[{ kind: "test", id: "test" }]}
        node={createNode()}
        contentRanges={[
          createContentRange({ startIndex: 0, endIndex: 6, content: "Lorem " }),
          createContentRange({
            startIndex: 6,
            endIndex: 11,
            content: "ipsum",
            identifiers: ["pending-annotation"],
            hasPendingAnnotation: true,
          }),
          createContentRange({ startIndex: 11, endIndex: 26, content: " dolor sit amet" }),
        ]}
        organizationSlug="test-org"
        metricDefinitionForID={stubMetricDefinitionForID}
        metricColorForID={stubMetricColorForID}
        kindConfigurationForPattern={stubKindConfigurationForPattern}
        showAnnotations={false}
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });
});
