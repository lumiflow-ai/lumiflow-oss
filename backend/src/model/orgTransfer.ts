import { randomUUID } from "node:crypto";

import type pg from "pg";
import type { Logger } from "pino";

import type {
  AnyRecipeStepInput,
  ArtifactSnapshotStrict,
  MetricDefinition,
  MetricID,
  Organization,
  OrganizationID,
  Recipe,
  RecipeStep,
  RecipeStepMetricInput,
} from "@/types";

import { TemplateOrgIDs } from "@/user";

export async function copyTemplateIntoOrganization({
  organization,
  ...context
}: {
  organization: Organization;
  pgClient: pg.ClientBase;
  logger: Logger;
}) {
  if (!organization.template) return;

  const destinationOrgID = organization.id;
  const templateOrgID = TemplateOrgIDs[organization.template];
  if (!templateOrgID) return;

  const metricIDReplacementMap = await copyMetricDefinitions({ templateOrgID, destinationOrgID, ...context });
  await copyRecipes({ templateOrgID, destinationOrgID, metricIDReplacementMap, ...context });
  await copyArtifactSnapshots({
    templateOrgID,
    destinationOrgID,
    metricIDReplacementMap,
    ...context,
  });
}

export async function copyMetricDefinitions({
  templateOrgID,
  destinationOrgID,
  pgClient,
  logger,
}: {
  templateOrgID: OrganizationID;
  destinationOrgID: OrganizationID;
  pgClient: pg.ClientBase;
  logger: Logger;
}): Promise<Map<MetricID, MetricID>> {
  const metricIDReplacementMap = new Map<MetricID, MetricID>();

  logger.info("Loading metric definitions.");
  const metricDefinitionQueryResults = await pgClient.query<{
    org_id: string;
    metric_id: string;
    updated_at: Date;
    definition: MetricDefinition;
  }>({
    text: `
        SELECT *
          FROM public.metric_definitions
          WHERE "org_id" = $1;
      `,
    values: [templateOrgID],
  });
  logger.info("Loaded metric definitions.");

  if (!metricDefinitionQueryResults.rows.length) return metricIDReplacementMap;

  logger.info("Starting to copy metric definitions.");
  for (const { definition } of metricDefinitionQueryResults.rows) {
    if (definition.isDeleted === true) continue;

    const newID = randomUUID();
    metricIDReplacementMap.set(definition.id, newID);
    const newDefinition: MetricDefinition = {
      ...definition,
      id: newID,
    };
    await pgClient.query({
      text: `
        INSERT INTO public.metric_definitions (
          "org_id",
          "metric_id",
          "updated_at",
          "definition"
        ) VALUES (
          $1,
          $2,
          now(),
          $3
        );
      `,
      values: [destinationOrgID, newDefinition.id, newDefinition],
    });
  }

  return metricIDReplacementMap;
}

export async function copyRecipes({
  templateOrgID,
  destinationOrgID,
  metricIDReplacementMap,
  pgClient,
  logger,
}: {
  templateOrgID: OrganizationID;
  destinationOrgID: OrganizationID;
  metricIDReplacementMap: Map<MetricID, MetricID>;
  pgClient: pg.ClientBase;
  logger: Logger;
}): Promise<void> {
  logger.info(`Getting recipes from template org ${templateOrgID}`);
  const recipeResults = await pgClient.query<{
    id: string;
    recipe: Recipe;
  }>({
    text: `
      SELECT
        "id",
        "recipe"
      FROM public.recipes
      WHERE "org_id" = $1;
    `,
    values: [templateOrgID],
  });

  logger.info({ snapshotCount: recipeResults.rows.length }, "Found recipes to copy.");
  if (recipeResults.rows.length === 0) return;

  logger.info(`Copying recipes to destination org ${destinationOrgID}`);
  for (const { recipe } of recipeResults.rows) {
    if (recipe.isDeleted) continue;

    const activeSteps = replaceMetricIDsInSteps(recipe.steps ?? [], metricIDReplacementMap);
    if (activeSteps.length === 0) continue;

    const remainingStepIDs = new Set(activeSteps.map((step) => step.id));
    const stepsWithNormalizedDependencies = activeSteps.map((step) => ({
      ...step,
      dependencies: step.dependencies.filter((dependency) => remainingStepIDs.has(dependency)),
    }));

    const { isDeleted: _ignored, ...recipeWithoutDeletionFlag } = recipe;
    const recipeBase = recipeWithoutDeletionFlag as Omit<Recipe, "isDeleted">;
    const newRecipeID = randomUUID();
    const sanitizedRecipe: Recipe = {
      ...recipeBase,
      id: newRecipeID,
      steps: stepsWithNormalizedDependencies,
    };

    logger.info(`Inserting recipe ${newRecipeID} (${sanitizedRecipe.name})`);
    await pgClient.query({
      text: `
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
      `,
      values: [destinationOrgID, newRecipeID, sanitizedRecipe],
    });
  }
}

export async function copyArtifactSnapshots({
  templateOrgID,
  destinationOrgID,
  metricIDReplacementMap,
  pgClient,
  logger,
}: {
  templateOrgID: OrganizationID;
  destinationOrgID: OrganizationID;
  metricIDReplacementMap: Map<MetricID, MetricID>;
  pgClient: pg.ClientBase;
  logger: Logger;
}): Promise<void> {
  logger.info(`Getting artifact snapshots from template org ${templateOrgID}`);
  const artifactSnapshotResults = await pgClient.query<{
    artifact_path: string[][];
    event_summary_id: string;
    timestamp: Date;
    snapshot: ArtifactSnapshotStrict;
  }>({
    text: `
      SELECT
        "artifact_path",
        "event_summary_id",
        "timestamp",
        "snapshot"
      FROM public.artifact_snapshots
      WHERE "org_id" = $1;
    `,
    values: [templateOrgID],
  });

  if (artifactSnapshotResults.rows.length === 0) return;
  logger.info({ snapshotCount: artifactSnapshotResults.rows.length }, "Found artifact snapshots to copy.");

  logger.info("Generating new event summary IDs");
  const eventSummaryIDMap = new Map<string, string>();
  for (const { event_summary_id } of artifactSnapshotResults.rows) {
    eventSummaryIDMap.set(event_summary_id, randomUUID());
  }

  logger.info(`Copying artifact snapshots to destination org ${destinationOrgID}`);
  for (const { artifact_path, event_summary_id, timestamp, snapshot } of artifactSnapshotResults.rows) {
    const newEventSummaryID = eventSummaryIDMap.get(event_summary_id);
    if (!newEventSummaryID) continue;

    const remappedMetrics = snapshot.metrics.reduce<ArtifactSnapshotStrict["metrics"]>((accumulator, metric) => {
      const newMetricID = metricIDReplacementMap.get(metric.id);
      if (!newMetricID) return accumulator;

      accumulator.push({
        ...metric,
        id: newMetricID,
        values: metric.values.map((value) => ({
          ...value,
          eventSummaryID: eventSummaryIDMap.get(value.eventSummaryID) ?? value.eventSummaryID,
        })),
      });

      return accumulator;
    }, []);

    const remappedSourceSelectors = snapshot.sourceArtifactSelectors.map((selector) => ({
      ...selector,
      eventSummaryIDs: selector.eventSummaryIDs?.map(
        (selectorEventSummaryID) => eventSummaryIDMap.get(selectorEventSummaryID) ?? selectorEventSummaryID,
      ),
    }));

    const remappedSnapshot: ArtifactSnapshotStrict = {
      ...snapshot,
      eventSummaryID: newEventSummaryID,
      metrics: remappedMetrics,
      sourceArtifactSelectors: remappedSourceSelectors,
    };

    const normalizedTimestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);

    logger.info(`Inserting artifact snapshot for event summary ID ${newEventSummaryID}`);
    await pgClient.query({
      text: `
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
      `,
      values: [destinationOrgID, artifact_path, newEventSummaryID, normalizedTimestamp, remappedSnapshot],
    });
  }
}

type EvaluateStep = Extract<RecipeStep, { kind: "evaluate" }>;
type CopyStep = Extract<RecipeStep, { kind: "copy" }>;

function replaceMetricIDsInSteps(steps: RecipeStep[], metricIDReplacementMap: Map<MetricID, MetricID>): RecipeStep[] {
  const sanitizedSteps: RecipeStep[] = [];
  for (const step of steps) {
    if (step.status === "migrated" || step.status === "hidden") continue;
    const sanitizedStep = replaceMetricIDsInStep(step, metricIDReplacementMap);
    if (!sanitizedStep) continue;
    sanitizedSteps.push(sanitizedStep);
  }
  return sanitizedSteps;
}

function replaceMetricIDsInStep(step: RecipeStep, metricIDReplacementMap: Map<MetricID, MetricID>): RecipeStep | null {
  switch (step.kind) {
    case "copy":
      return replaceMetricIDsInCopyStep(step, metricIDReplacementMap);
    case "evaluate":
      return replaceMetricIDsInEvaluateStep(step, metricIDReplacementMap);
    default:
      return null;
  }
}

function replaceMetricIDsInCopyStep(step: CopyStep, metricIDReplacementMap: Map<MetricID, MetricID>): CopyStep | null {
  const inputs = step.inputs.flatMap((input) => {
    const sanitized = replaceMetricIDsInMetricInput(input, metricIDReplacementMap);
    return sanitized ? [sanitized] : [];
  });

  if (inputs.length === 0) return null;

  return {
    ...step,
    inputs,
  };
}

function replaceMetricIDsInEvaluateStep(
  step: EvaluateStep,
  metricIDReplacementMap: Map<MetricID, MetricID>,
): EvaluateStep {
  return {
    ...step,
    inputs: replaceMetricIDsInEvaluateStepInputs(step.inputs, metricIDReplacementMap),
    outputs: replaceMetricIDsInEvaluateStepOutputs(step.outputs, metricIDReplacementMap),
    dependencies: [...step.dependencies],
  };
}

function replaceMetricIDsInEvaluateStepInputs(
  inputs: AnyRecipeStepInput[],
  metricIDReplacementMap: Map<MetricID, MetricID>,
): AnyRecipeStepInput[] {
  const sanitized: AnyRecipeStepInput[] = [];
  for (const input of inputs) {
    if (input.kind === "metric") {
      const remappedInput = replaceMetricIDsInMetricInput(input, metricIDReplacementMap);
      if (remappedInput) sanitized.push(remappedInput);
      continue;
    }
    sanitized.push({ ...input });
  }
  return sanitized;
}

function replaceMetricIDsInEvaluateStepOutputs(
  stepOutputs: EvaluateStep["outputs"],
  metricIDReplacementMap: Map<MetricID, MetricID>,
): EvaluateStep["outputs"] {
  const updatedStepOutputs: EvaluateStep["outputs"] = [];
  for (const stepOutput of stepOutputs) {
    if (stepOutput.kind === "metric") {
      const newMetricID = metricIDReplacementMap.get(stepOutput.output.metricID);
      updatedStepOutputs.push({
        ...stepOutput,
        output: {
          ...stepOutput.output,
          metricID: newMetricID ?? stepOutput.output.metricID,
        },
      });
      continue;
    }
    updatedStepOutputs.push(stepOutput);
  }
  return updatedStepOutputs;
}

function replaceMetricIDsInMetricInput<
  T extends RecipeStepMetricInput | Extract<AnyRecipeStepInput, { kind: "metric" }>,
>(input: T, metricIDReplacementMap: Map<MetricID, MetricID>): T | null {
  const newMetricID = metricIDReplacementMap.get(input.input.metricID);
  if (!newMetricID) return null;
  return {
    ...input,
    input: {
      ...input.input,
      metricID: newMetricID,
    },
  };
}
