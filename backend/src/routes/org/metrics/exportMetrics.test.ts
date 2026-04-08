import supertest from "supertest";
import { describe, expect, it } from "vitest";

import {
  type ArtifactPath,
  type Recipe,
  RecipeStepInputKind,
  RecipeStepKind,
  RecipeStepOutputKind,
  RecipeStepStatus,
} from "@/types";

import { expectQueryText, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { FakeAuthorizationManager, FakeAuthorizationResults } from "@/lib/authorization.internal";

import { FakeOrganizations, FakeOrgManager } from "@/model/org.internal";
import { FakeUserManager } from "@/model/user.internal";

import { createApp } from "@/app";

const CREATION_TIMESTAMP = "2024-01-01T00:00:00.000Z";
const UPDATE_TIMESTAMP = "2024-01-02T00:00:00.000Z";

const coreSetID = "c1a2b3c4-5678-90ab-cdef-123456789abc";
const supportSetID = "s1a2b3c4-5678-90ab-cdef-123456789def";
const missingSetID = "m1a2b3c4-5678-90ab-cdef-123456789ghi";

const qualityInputStepID = "q1i2n3p4-5678-90ab-cdef-111111111111";
const qualityOutputStepID = "q1o2u3t4-5678-90ab-cdef-222222222222";
const engagementStepID = "e1n2g3a4-5678-90ab-cdef-333333333333";
const retentionInputStepID = "r1i2n3p4-5678-90ab-cdef-444444444444";
const retentionOutputStepID = "r1o2u3t4-5678-90ab-cdef-555555555555";
const datasetStepID = "d1a2t3a4-5678-90ab-cdef-666666666666";

const qualityMetricID = "qm12a3b4-5678-90ab-cdef-aaaaaaaaaaaa";
const engagementMetricID = "em12a3b4-5678-90ab-cdef-bbbbbbbbbbbb";
const retentionMetricID = "rm12a3b4-5678-90ab-cdef-cccccccccccc";
const datasetMetricID = "dm12a3b4-5678-90ab-cdef-dddddddddddd";

function makeEvaluateStep({
  stepID,
  stepName,
  userPrompt,
  inputPath = [],
  outputPath = [],
  status = RecipeStepStatus.enabled,
  metricID,
}: {
  stepID: string;
  stepName: string;
  userPrompt: string;
  inputPath?: ArtifactPath;
  outputPath?: ArtifactPath;
  status?: (typeof RecipeStepStatus)[keyof typeof RecipeStepStatus];
  metricID?: string;
}): Recipe["steps"][number] {
  return {
    id: stepID,
    name: stepName,
    kind: RecipeStepKind.evaluate,
    status,
    creationTimestamp: CREATION_TIMESTAMP,
    updateTimestamp: UPDATE_TIMESTAMP,
    dependencies: [],
    inputs: [
      {
        kind: RecipeStepInputKind.artifact,
        token: "input",
        input: {
          childArtifactPath: inputPath,
          keyPath: "",
        },
      },
    ],
    outputs: [
      {
        kind: RecipeStepOutputKind.metric,
        key: `${stepID}-metric`,
        output: {
          childArtifactPath: outputPath,
          metricID: metricID ?? `${stepID}-metric-id`,
          includeEvidence: true,
        },
      },
    ],
    promptTemplate: "Prompt Template",
    userPrompt,
    model: {
      name: "gpt-4",
      parameters: {},
    },
  };
}

function makeRecipe({
  id,
  name,
  steps,
  isDeleted = false,
}: {
  id: string;
  name: string;
  steps: Recipe["steps"];
  isDeleted?: boolean;
}): Recipe {
  return {
    id,
    name,
    description: "",
    isDeleted: isDeleted ? true : undefined,
    creationTimestamp: CREATION_TIMESTAMP,
    updateTimestamp: UPDATE_TIMESTAMP,
    triggers: [],
    steps,
  };
}

describe("Export Metrics Route", () => {
  it("exports enabled evaluate steps with input/output flags", async () => {
    const recipes = [
      makeRecipe({
        id: coreSetID,
        name: "Core Metrics",
        steps: [
          // Quality metric - both input and output steps
          makeEvaluateStep({
            stepID: qualityInputStepID,
            stepName: "Quality Metric",
            userPrompt: "How would you rate quality?",
            inputPath: [{ id: "input" }],
            metricID: qualityMetricID,
          }),
          makeEvaluateStep({
            stepID: qualityOutputStepID,
            stepName: "Quality Metric",
            userPrompt: "How would you rate quality?",
            inputPath: [{ id: "output" }],
            metricID: qualityMetricID,
          }),
          // Engagement metric - disabled
          makeEvaluateStep({
            stepID: engagementStepID,
            stepName: "Engagement Metric",
            userPrompt: "How engaged is the user?",
            inputPath: [{ id: "input" }],
            status: RecipeStepStatus.disabled,
            metricID: engagementMetricID,
          }),
        ],
      }),
      makeRecipe({
        id: supportSetID,
        name: "Support Metrics",
        steps: [
          // Retention metric - only output step
          makeEvaluateStep({
            stepID: retentionOutputStepID,
            stepName: "Retention Metric",
            userPrompt: "Does the agent retain the customer?",
            inputPath: [{ id: "output" }],
            metricID: retentionMetricID,
          }),
          // Dataset metric - no input/output
          makeEvaluateStep({
            stepID: datasetStepID,
            stepName: "Dataset Metric",
            userPrompt: "Is the dataset valid?",
            inputPath: [],
            metricID: datasetMetricID,
          }),
        ],
      }),
    ];

    const metricDefinitions = [
      { metric_id: qualityMetricID, definition: { name: "Quality Score" } },
      { metric_id: retentionMetricID, definition: { name: "Customer Retention" } },
    ];

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/org/metrics/export")
        .query({
          orgID: FakeOrganizations.medical.id,
        })
        .expect(200);

      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(response.headers["content-disposition"]).toMatch(/attachment; filename="all-metric-sets\.csv"/);

      const lines = response.text.split("\n");
      expect(lines).toEqual([
        "Metric Name,Metric Question,Input,Expected",
        "Customer Retention,Does the agent retain the customer?,false,true",
        "Dataset Metric,Is the dataset valid?,false,false",
        "Quality Score,How would you rate quality?,true,true",
      ]);
    }).expectClient((client) => {
      client.expectQuery(({ text, values }) => {
        expectQueryText(text).toMatch(`
          SELECT *
            FROM public.recipes
            WHERE "org_id" = $1
            ORDER BY "updated_at" ASC, "id" ASC
            LIMIT 5000;
        `);
        expect(values).toEqual([FakeOrganizations.medical.id.toLowerCase()]);
        return {
          rows: recipes.map((recipe, index) => ({
            org_id: FakeOrganizations.medical.id,
            id: recipe.id,
            updated_at: new Date(2024, 1, index + 1),
            recipe,
          })),
        };
      });
      client.expectQuery(({ text, values }) => {
        expectQueryText(text).toMatch(`
          SELECT metric_id, definition
            FROM public.metric_definitions
            WHERE "org_id" = $1;
        `);
        expect(values).toEqual([FakeOrganizations.medical.id.toLowerCase()]);
        return { rows: metricDefinitions };
      });
    });
  });

  it("filters by metricSetID and adjusts filename", async () => {
    const recipes = [
      makeRecipe({
        id: coreSetID,
        name: "Core Metrics",
        steps: [
          makeEvaluateStep({
            stepID: qualityInputStepID,
            stepName: "Quality Metric",
            userPrompt: "How would you rate quality?",
            inputPath: [{ id: "input" }],
            metricID: qualityMetricID,
          }),
          makeEvaluateStep({
            stepID: qualityOutputStepID,
            stepName: "Quality Metric",
            userPrompt: "How would you rate quality?",
            inputPath: [{ id: "output" }],
            metricID: qualityMetricID,
          }),
        ],
      }),
      makeRecipe({
        id: supportSetID,
        name: "Support Metrics",
        steps: [
          makeEvaluateStep({
            stepID: retentionInputStepID,
            stepName: "Retention Metric",
            userPrompt: "Does the agent retain the customer?",
            inputPath: [{ id: "input" }],
            metricID: retentionMetricID,
          }),
          makeEvaluateStep({
            stepID: retentionOutputStepID,
            stepName: "Retention Metric",
            userPrompt: "Does the agent retain the customer?",
            inputPath: [{ id: "output" }],
            metricID: retentionMetricID,
          }),
        ],
      }),
    ];

    const metricDefinitions = [{ metric_id: retentionMetricID, definition: { name: "Retention Score" } }];

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      const response = await supertest(app)
        .get("/v0.1/org/metrics/export")
        .query({
          orgID: FakeOrganizations.medical.id,
          metricSetID: supportSetID,
        })
        .expect(200);

      expect(response.headers["content-disposition"]).toMatch(/attachment; filename="Support-Metrics\.csv"/);

      const lines = response.text.split("\n");
      expect(lines).toEqual([
        "Metric Name,Metric Question,Input,Expected",
        "Retention Score,Does the agent retain the customer?,true,true",
      ]);
    }).expectClient((client) => {
      client.expectQuery(({ text, values }) => {
        expectQueryText(text).toMatch(`
          SELECT *
            FROM public.recipes
            WHERE "org_id" = $1
            ORDER BY "updated_at" ASC, "id" ASC
            LIMIT 5000;
        `);
        expect(values).toEqual([FakeOrganizations.medical.id.toLowerCase()]);
        return {
          rows: recipes.map((recipe, index) => ({
            org_id: FakeOrganizations.medical.id,
            id: recipe.id,
            updated_at: new Date(2024, 3, index + 1),
            recipe,
          })),
        };
      });
      client.expectQuery(({ text, values }) => {
        expectQueryText(text).toMatch(`
          SELECT metric_id, definition
            FROM public.metric_definitions
            WHERE "org_id" = $1;
        `);
        expect(values).toEqual([FakeOrganizations.medical.id.toLowerCase()]);
        return { rows: metricDefinitions };
      });
    });
  });

  it("returns 404 when the metric set is not found", async () => {
    const recipes: Recipe[] = [];
    const metricDefinitions: Array<{ metric_id: string; definition: { name?: string } }> = [];

    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.validMedicalUserSession),
        pgPool,
        logger,
      });

      await supertest(app)
        .get("/v0.1/org/metrics/export")
        .query({
          orgID: FakeOrganizations.medical.id,
          metricSetID: missingSetID,
        })
        .expect(404);
    }).expectClient((client) => {
      client.expectQuery(({ text, values }) => {
        expectQueryText(text).toMatch(`
          SELECT *
            FROM public.recipes
            WHERE "org_id" = $1
            ORDER BY "updated_at" ASC, "id" ASC
            LIMIT 5000;
        `);
        expect(values).toEqual([FakeOrganizations.medical.id.toLowerCase()]);
        return {
          rows: recipes.map((recipe, index) => ({
            org_id: FakeOrganizations.medical.id,
            id: recipe.id,
            updated_at: new Date(2024, 5, index + 1),
            recipe,
          })),
        };
      });
      client.expectQuery(({ text, values }) => {
        expectQueryText(text).toMatch(`
          SELECT metric_id, definition
            FROM public.metric_definitions
            WHERE "org_id" = $1;
        `);
        expect(values).toEqual([FakeOrganizations.medical.id.toLowerCase()]);
        return { rows: metricDefinitions };
      });
    });
  });

  it("requires authorization", async () => {
    await fakePersistence(async (pgPool) => {
      const app = createApp({
        managers: { org: new FakeOrgManager(), user: new FakeUserManager() },
        authorization: new FakeAuthorizationManager(FakeAuthorizationResults.invalidUnverifiedUserSession),
        pgPool,
        logger,
      });

      await supertest(app)
        .get("/v0.1/org/metrics/export")
        .query({
          orgID: FakeOrganizations.medical.id,
        })
        .expect(403);
    });
  });
});
