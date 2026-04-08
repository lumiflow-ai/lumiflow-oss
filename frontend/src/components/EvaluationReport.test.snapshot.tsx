import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";

import type { MetricDefinition, MetricReview } from "@/generated/serverTypes";

import { renderComponent } from "@/library/testing";

import { createTestArtifactNode } from "@/model/artifactNode.internal";
import type { Evaluation } from "@/model/evaluation";

import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";

import { EvaluationReport } from "./EvaluationReport";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateMedia: (options: { media: "print" | "screen" }) => Promise<void>;
  }
}

const fixedTimestamp = new Date("2024-04-05T12:34:56.000Z");

const metricDefinitions: MetricDefinition[] = [
  {
    id: "metric-1",
    name: "Tone",
    description: "Is the tone friendly?",
    order: "1",
    kind: "boolean",
  },
  {
    id: "metric-2",
    name: "Accuracy",
    description: "Is the response accurate?",
    order: "2",
    kind: "boolean",
  },
];

const metricDefinitionForID = (id: string) => metricDefinitions.find((metric) => metric.id === id) ?? null;

const kindConfigurationForPattern: KindConfigurationLookup = () => ({
  displayName: "Test Artifact",
  otherNames: { one: "Test Artifact", other: "Test Artifacts" },
  includesID: false,
  pattern: [],
});

const createReview = (overrides: Partial<MetricReview> = {}): MetricReview => ({
  id: overrides.id ?? "review-1",
  metricId: overrides.metricId ?? "metric-1",
  recipeRunId: overrides.recipeRunId ?? "recipe-1",
  evaluationGroupId: overrides.evaluationGroupId ?? "evaluation-1",
  value: overrides.value ?? "approved",
  author: overrides.author ?? "reviewer-1",
  createdTimestamp: overrides.createdTimestamp ?? "2024-01-01T00:00:00.000Z",
  modifiedTimestamp: overrides.modifiedTimestamp ?? "2024-01-01T00:00:00.000Z",
});

const createMetricRecordings = (metrics: Array<{ id: string; value: boolean }>) =>
  metrics.map((metric) => ({
    id: metric.id,
    values: [{ eventSummaryID: "event-1", value: metric.value, evaluationGroupID: "evaluation-1" }],
  }));

const sampleEvaluation: Evaluation = {
  id: "evaluation-1",
  name: "Product quality review",
  creationTimestamp: new Date("2024-04-01T00:00:00.000Z"),
  artifactPathPatterns: [],
  recipeIDs: ["recipe-1"],
  isCancelled: false,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(fixedTimestamp);
  vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("Apr 5, 2024, 12:34:56 PM");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("EvaluationReport", () => {
  test("renders evaluation report with summary and reviewer columns", async () => {
    const artifacts = [
      createTestArtifactNode({
        name: "Artifact One",
        id: "artifact-1",
        artifactPath: [{ kind: "test", id: "artifact-1" }],
        metadata: { title: "Alpha", description: "First artifact" },
        content: "Sample content",
        metrics: createMetricRecordings([
          { id: "metric-1", value: true },
          { id: "metric-2", value: false },
        ]),
        reviews: {
          "review-1": createReview({
            id: "review-1",
            metricId: "metric-1",
            author: "reviewer-1",
            value: "approved",
          }),
        },
      }),
      createTestArtifactNode({
        name: "Artifact Two",
        id: "artifact-2",
        artifactPath: [{ kind: "test", id: "artifact-2" }],
        metadata: { title: "Beta" },
        content: "Sample content",
        metrics: createMetricRecordings([
          { id: "metric-1", value: false },
          { id: "metric-2", value: true },
        ]),
        reviews: {
          "review-2": createReview({
            id: "review-2",
            metricId: "metric-1",
            author: "reviewer-2",
            value: "denied",
          }),
          "review-3": createReview({
            id: "review-3",
            metricId: "metric-2",
            author: "reviewer-1",
            value: "approved",
          }),
        },
      }),
      createTestArtifactNode({
        name: "Artifact Three",
        id: "artifact-3",
        artifactPath: [{ kind: "test", id: "artifact-3" }],
        content: "Sample content",
        metrics: createMetricRecordings([
          { id: "metric-1", value: true },
          { id: "metric-2", value: true },
        ]),
      }),
    ];

    const component = await renderComponent(
      <EvaluationReport
        evaluation={sampleEvaluation}
        artifacts={artifacts}
        metricDefinitions={metricDefinitions}
        metricDefinitionForID={metricDefinitionForID}
        kindConfigurationForPattern={kindConfigurationForPattern}
        evaluationGroupID="evaluation-1"
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("renders evaluation report in print mode", async () => {
    const artifacts = [
      createTestArtifactNode({
        name: "Artifact One",
        id: "artifact-1",
        artifactPath: [{ kind: "test", id: "artifact-1" }],
        metadata: { title: "Alpha", description: "First artifact" },
        content: "Sample content",
        metrics: createMetricRecordings([
          { id: "metric-1", value: true },
          { id: "metric-2", value: false },
        ]),
        reviews: {
          "review-1": createReview({
            id: "review-1",
            metricId: "metric-1",
            author: "reviewer-1",
            value: "approved",
          }),
        },
      }),
    ];

    await commands.emulateMedia({ media: "print" });
    try {
      const component = await renderComponent(
        <EvaluationReport
          evaluation={sampleEvaluation}
          artifacts={artifacts}
          metricDefinitions={metricDefinitions}
          metricDefinitionForID={metricDefinitionForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
          evaluationGroupID="evaluation-1"
        />,
      );

      await expect(component.baseElement).toMatchScreenshot();
    } finally {
      await commands.emulateMedia({ media: "screen" });
    }
  });
});
