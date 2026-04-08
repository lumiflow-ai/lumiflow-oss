import { describe, expect, it } from "vitest";

import type { ArtifactSnapshotStrict, Recipe } from "@/types";

import { withPGClient } from "@/server/persistence";
import { expectQueryText, fakeClient, fakePersistence } from "@/server/persistence.internal";
import { logger } from "@/serverInitSetup/logger";

import { copyArtifactSnapshots, copyMetricDefinitions, copyRecipes } from "./orgTransfer";

describe("Copy Metric Definitions", () => {
  it("copyMetricDefinitions() copies definitions with new metric IDs", async () => {
    const receivedIDs = new Map<string, string>();
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        const newIDMap = await copyMetricDefinitions({
          templateOrgID: "template",
          destinationOrgID: "destination",
          ...context,
        });
        expect(newIDMap.size).toEqual(2);
        expect(newIDMap.get("old1")).toEqual(receivedIDs.get("old1"));
        expect(newIDMap.get("old2")).toEqual(receivedIDs.get("old2"));
      });
    }).expectClient(
      fakeClient
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`SELECT * FROM public.metric_definitions WHERE "org_id" = $1;`);
          expect(values?.length).toEqual(1);
          expect(values).toContainEqual("template");

          return {
            rows: [
              {
                org_id: "template",
                metric_id: "old1",
                updated_at: new Date(),
                definition: {
                  id: "old1",
                  name: "Metric 1",
                },
              },
              {
                org_id: "template",
                metric_id: "old2",
                updated_at: new Date(),
                definition: {
                  id: "old2",
                  name: "Metric 2",
                },
              },
            ],
          };
        })
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(
            `INSERT INTO public.metric_definitions ( "org_id", "metric_id", "updated_at", "definition" ) VALUES ( $1, $2, now(), $3 );`,
          );
          expect(values?.length).toEqual(3);
          expect(values?.[0]).toEqual("destination");
          expect(values?.[1]).not.toEqual("old1");
          const newID = values?.[1];
          receivedIDs.set("old1", newID);
          expect(values?.[2]).toEqual({ id: newID, name: "Metric 1" });
        })
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(
            `INSERT INTO public.metric_definitions ( "org_id", "metric_id", "updated_at", "definition" ) VALUES ( $1, $2, now(), $3 );`,
          );
          expect(values?.length).toEqual(3);
          expect(values?.[0]).toEqual("destination");
          expect(values?.[1]).not.toEqual("old2");
          const newID = values?.[1];
          receivedIDs.set("old2", newID);
          expect(values?.[2]).toEqual({ id: newID, name: "Metric 2" });
        }),
    );
  });

  it("copyMetricDefinitions() skips deleted definitions", async () => {
    const receivedIDs = new Map<string, string>();
    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        const newIDMap = await copyMetricDefinitions({
          templateOrgID: "template",
          destinationOrgID: "destination",
          ...context,
        });
        expect(newIDMap.size).toEqual(1);
        expect(newIDMap.get("old2")).toEqual(receivedIDs.get("old2"));
      });
    }).expectClient(
      fakeClient
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`SELECT * FROM public.metric_definitions WHERE "org_id" = $1;`);
          expect(values?.length).toEqual(1);
          expect(values).toContainEqual("template");

          return {
            rows: [
              {
                org_id: "template",
                metric_id: "old1",
                updated_at: new Date(),
                definition: {
                  id: "old1",
                  name: "Metric 1",
                  isDeleted: true,
                },
              },
              {
                org_id: "template",
                metric_id: "old2",
                updated_at: new Date(),
                definition: {
                  id: "old2",
                  name: "Metric 2",
                },
              },
            ],
          };
        })
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(
            `INSERT INTO public.metric_definitions ( "org_id", "metric_id", "updated_at", "definition" ) VALUES ( $1, $2, now(), $3 );`,
          );
          expect(values?.length).toEqual(3);
          expect(values?.[0]).toEqual("destination");
          expect(values?.[1]).not.toEqual("old2");
          const newID = values?.[1];
          receivedIDs.set("old2", newID);
          expect(values?.[2]).toEqual({ id: newID, name: "Metric 2" });
        }),
    );
  });
});

describe("Copy Recipes", () => {
  it("copyRecipes() copies recipes with new metric IDs", async () => {
    const templateRecipe: Recipe = {
      id: "recipe-template",
      name: "Template Recipe",
      description: "Template Recipe Description",
      creationTimestamp: "2024-01-01T00:00:00.000Z",
      updateTimestamp: "2024-01-02T00:00:00.000Z",
      triggers: [
        {
          id: "trigger",
          evaluationGroupID: "eval-group",
          name: "Trigger",
          kind: "artifactPath",
          creationTimestamp: "2024-01-01T00:00:00.000Z",
          updateTimestamp: "2024-01-02T00:00:00.000Z",
          artifactPathPattern: [{ id: "artifact-root" }],
        },
      ],
      steps: [
        {
          id: "step-evaluate",
          name: "Evaluate Step",
          kind: "evaluate",
          status: "enabled",
          creationTimestamp: "2024-01-01T00:00:00.000Z",
          updateTimestamp: "2024-01-02T00:00:00.000Z",
          dependencies: [],
          inputs: [
            { kind: "constant", token: "PROMPT", input: "Use artifacts" },
            {
              kind: "metric",
              token: "metric-a",
              input: {
                childArtifactPath: [{ id: "path-a" }],
                metricID: "metric-old",
              },
            },
          ],
          outputs: [
            {
              kind: "snapshot",
              key: "snapshot-output",
              output: {
                childArtifactPath: [{ id: "path-d" }],
              },
            },
          ],
          promptTemplate: "Prompt Template",
          userPrompt: "User Prompt",
          model: {
            name: "model",
            parameters: {},
          },
        },
      ],
    };

    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        await copyRecipes({
          templateOrgID: "template",
          destinationOrgID: "destination",
          metricIDReplacementMap: new Map([["metric-old", "metric-new"]]),
          ...context,
        });
      });
    }).expectClient(
      fakeClient
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`
            SELECT
              "id",
              "recipe"
            FROM public.recipes
            WHERE "org_id" = $1;
          `);
          expect(values).toEqual(["template"]);
          return {
            rows: [{ id: templateRecipe.id, recipe: templateRecipe }],
            rowCount: 1,
          };
        })
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`
            INSERT INTO public.recipes (
              "org_id",
              "id",
              "updated_at",
              "recipe"
            ) VALUES (
              $1,
              $2,
              now(),
              $3
            );
          `);
          const [orgID, newRecipeID, insertedRecipe] = values ?? [];
          expect(orgID).toEqual("destination");

          const recipe = insertedRecipe as Recipe;
          expect(newRecipeID).toEqual(recipe.id);
          expect(recipe.id).to.not.equal(templateRecipe.id);

          expect(recipe.steps.map((step) => step.id)).toEqual(["step-evaluate"]);

          expect(
            recipe.steps
              .flatMap((s) => s.inputs ?? [])
              .filter((i) => i.kind === "metric")
              .map((i) => i.input.metricID),
          ).toEqual(["metric-new"]);

          return { rowCount: 1 };
        }),
    );
  });

  it("copyRecipes() skips deleted recipes", async () => {
    const templateRecipe: Recipe = {
      id: "recipe-deleted",
      name: "Deleted Recipe",
      description: "",
      creationTimestamp: "2024-01-01T00:00:00.000Z",
      updateTimestamp: "2024-01-02T00:00:00.000Z",
      isDeleted: true,
      triggers: [],
      steps: [
        {
          id: "step-evaluate",
          name: "Evaluate Step",
          kind: "evaluate",
          status: "enabled",
          creationTimestamp: "2024-01-01T00:00:00.000Z",
          updateTimestamp: "2024-01-02T00:00:00.000Z",
          dependencies: [],
          inputs: [
            { kind: "constant", token: "PROMPT", input: "Use artifacts" },
            {
              kind: "metric",
              token: "metric-a",
              input: {
                childArtifactPath: [{ id: "path-a" }],
                metricID: "metric-old",
              },
            },
          ],
          outputs: [
            {
              kind: "snapshot",
              key: "snapshot-output",
              output: {
                childArtifactPath: [{ id: "path-d" }],
              },
            },
          ],
          promptTemplate: "Prompt Template",
          userPrompt: "User Prompt",
          model: {
            name: "model",
            parameters: {},
          },
        },
      ],
    };

    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        await copyRecipes({
          templateOrgID: "template",
          destinationOrgID: "destination",
          metricIDReplacementMap: new Map([["metric-old", "metric-new"]]),
          ...context,
        });
      });
    }).expectClient(
      fakeClient.expectQuery(() => {
        return {
          rows: [{ id: templateRecipe.id, recipe: templateRecipe }],
          rowCount: 1,
        };
      }),
    );
  });
});

describe("Copy Artifact Snapshots", () => {
  it("copyArtifactSnapshots() copies artifacts with new metric IDs", async () => {
    const snapshot: ArtifactSnapshotStrict = {
      artifactPath: [{ id: "artifact-1" }],
      sourceArtifactSelectors: [
        {
          tags: [],
          artifactPath: [{ id: "artifact-2" }],
          eventSummaryIDs: ["event-summary-1"],
          generationIDs: [],
        },
      ],
      eventSummaryID: "event-summary-1",
      tags: {},
      metadata: {},
      timestamp: new Date("2024-01-01T00:00:00.000Z").toISOString(),
      content: { kind: "text", value: "example" },
      metrics: [
        {
          id: "old1",
          values: [
            {
              eventSummaryID: "event-summary-1",
              recipeRunID: "run-1",
              generationID: "generation-1",
              evaluationGroupID: "eval-group-1",
              value: "ok",
            },
          ],
        },
        {
          id: "old2",
          values: [
            {
              eventSummaryID: "event-summary-1",
              recipeRunID: "run-2",
              generationID: "generation-2",
              evaluationGroupID: "eval-group-2",
              value: 42,
            },
          ],
          isMock: true,
        },
      ],
      generations: [],
      annotations: {},
      reviews: {},
      dueDates: {},
    };

    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        await copyArtifactSnapshots({
          templateOrgID: "template",
          destinationOrgID: "destination",
          metricIDReplacementMap: new Map([
            ["old1", "new1"],
            ["old2", "new2"],
          ]),
          ...context,
        });
      });
    }).expectClient(
      fakeClient
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`
            SELECT
              "artifact_path",
              "event_summary_id",
              "timestamp",
              "snapshot"
            FROM public.artifact_snapshots
            WHERE "org_id" = $1;
          `);
          expect(values).toEqual(["template"]);
          return {
            rows: [
              {
                artifact_path: [
                  ["artifact", "artifact-1"],
                  ["snapshot", "latest"],
                ],
                event_summary_id: "event-summary-1",
                timestamp: new Date("2024-01-01T00:00:00.000Z"),
                snapshot,
              },
            ],
            rowCount: 1,
          };
        })
        .expectQuery(({ text, values }) => {
          expectQueryText(text).toMatch(`
            INSERT INTO public.artifact_snapshots (
              "org_id",
              "artifact_path",
              "event_summary_id",
              "timestamp",
              "updated_at",
              "snapshot"
            ) VALUES (
              $1,
              $2,
              $3,
              $4,
              now(),
              $5
            );
          `);
          const [orgID, artifactPath, eventSummaryID, timestamp, insertedSnapshot] = values ?? [];
          expect(orgID).toEqual("destination");
          expect(artifactPath).toEqual([
            ["artifact", "artifact-1"],
            ["snapshot", "latest"],
          ]);
          expect(eventSummaryID).to.not.equal("event-summary-1");
          expect(timestamp).toEqual(new Date("2024-01-01T00:00:00.000Z"));

          const snapshotValue = insertedSnapshot as ArtifactSnapshotStrict;
          expect(snapshotValue.eventSummaryID).toEqual(eventSummaryID);
          expect(snapshotValue.sourceArtifactSelectors[0]?.eventSummaryIDs).toEqual([eventSummaryID]);
          expect(snapshotValue.metrics.at(0)?.id).toEqual("new1");
          expect(snapshotValue.metrics.at(0)?.values.at(0)?.eventSummaryID).toEqual(eventSummaryID);
          expect(snapshotValue.metrics.at(1)?.id).toEqual("new2");
          expect(snapshotValue.metrics.at(1)?.values.at(0)?.eventSummaryID).toEqual(eventSummaryID);
          expect(snapshotValue.metrics.length).toEqual(2);
          return { rowCount: 1 };
        }),
    );
  });

  it("copyArtifactSnapshots() skips metrics without new IDs", async () => {
    const snapshot: ArtifactSnapshotStrict = {
      artifactPath: [{ id: "artifact-1" }],
      sourceArtifactSelectors: [],
      eventSummaryID: "event-summary-1",
      tags: {},
      metadata: {},
      timestamp: new Date("2024-01-01T00:00:00.000Z").toISOString(),
      content: "example",
      metrics: [
        {
          id: "old1",
          values: [
            {
              eventSummaryID: "event-summary-1",
              recipeRunID: "run-1",
              generationID: "generation-1",
              evaluationGroupID: "eval-group-1",
              value: "ok",
            },
          ],
        },
        {
          id: "unmapped",
          values: [
            {
              eventSummaryID: "event-summary-1",
              recipeRunID: "run-3",
              generationID: "generation-3",
              evaluationGroupID: "eval-group-3",
              value: "skip-me",
            },
          ],
        },
      ],
      generations: [],
      annotations: {},
      reviews: {},
      dueDates: {},
    };

    await fakePersistence(async (pgPool) => {
      await withPGClient({ pgPool, logger }, async (context) => {
        await copyArtifactSnapshots({
          templateOrgID: "template",
          destinationOrgID: "destination",
          metricIDReplacementMap: new Map([["old1", "new1"]]),
          ...context,
        });
      });
    }).expectClient(
      fakeClient
        .expectQuery(({ text }) => {
          expectQueryText(text).toMatch(`
            SELECT
              "artifact_path",
              "event_summary_id",
              "timestamp",
              "snapshot"
            FROM public.artifact_snapshots
            WHERE "org_id" = $1;
          `);
          return {
            rows: [
              {
                artifact_path: [
                  ["artifact", "artifact-1"],
                  ["snapshot", "latest"],
                ],
                event_summary_id: "event-summary-1",
                timestamp: new Date("2024-01-01T00:00:00.000Z"),
                snapshot,
              },
            ],
            rowCount: 1,
          };
        })
        .expectQuery(({ values }) => {
          const insertedSnapshot = values?.[4] as ArtifactSnapshotStrict;
          const newEventSummaryID = values?.[2];
          expect(newEventSummaryID).to.not.equal("event-summary-1");
          expect(insertedSnapshot.eventSummaryID).toEqual(newEventSummaryID);
          expect(insertedSnapshot.metrics.length).toEqual(1);
          expect(insertedSnapshot.metrics.at(0)?.id).toEqual("new1");
          expect(insertedSnapshot.metrics.at(0)?.values.at(0)?.eventSummaryID).toEqual(newEventSummaryID);
          return { rowCount: 1 };
        }),
    );
  });
});
