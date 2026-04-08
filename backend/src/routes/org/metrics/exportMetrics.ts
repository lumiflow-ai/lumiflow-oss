import type { ArtifactPath, Recipe } from "@/types";
import { RecipeStepInputKind, RecipeStepKind, RecipeStepOutputKind, RecipeStepStatus } from "@/types";

import { withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { csvRow, sanitizeFilename } from "@/lib/csv";
import { Download, DownloadSchema, HTTPError, RouteGroup } from "@/lib/routeGroup";

import { ExportMetricsRequestSchema } from "./definitions";

export const exportMetrics = new RouteGroup();

exportMetrics.get(
  "export",
  {
    requestSchema: ExportMetricsRequestSchema,
    responseSchema: DownloadSchema,
    auth: AuthorizationRequirement.session,
  },
  async ({ orgID, metricSetID }, context) => {
    const normalizedOrgID = orgID.toLowerCase();
    if (!context.user?.organizations.has(normalizedOrgID)) {
      throw new AuthorizationError();
    }

    const { recipes, metricDefinitions } = await withPGClient(context, async ({ pgClient }) => {
      const recipeQueryResults = await pgClient.query<{
        org_id: string;
        id: string;
        updated_at: Date;
        recipe: Recipe;
      }>({
        text: `
          SELECT *
            FROM public.recipes
            WHERE "org_id" = $1
            ORDER BY "updated_at" ASC, "id" ASC
            LIMIT 5000;
        `,
        values: [normalizedOrgID],
      });

      const metricDefinitionsResult = await pgClient.query<{
        metric_id: string;
        definition: { name?: string; question?: string };
      }>({
        text: `
          SELECT metric_id, definition
            FROM public.metric_definitions
            WHERE "org_id" = $1;
        `,
        values: [normalizedOrgID],
      });

      const metricDefinitionsMap = new Map<string, { name?: string; question?: string }>();
      for (const row of metricDefinitionsResult.rows) {
        metricDefinitionsMap.set(row.metric_id, row.definition);
      }

      return {
        recipes: recipeQueryResults.rows.map(({ recipe }) => recipe),
        metricDefinitions: metricDefinitionsMap,
      };
    });

    const matchingRecipes = metricSetID ? recipes.filter((recipe) => recipe.id === metricSetID) : recipes;
    const metricsForExport = aggregateMetrics({ recipes: matchingRecipes, metricDefinitions });

    if (metricSetID && metricsForExport.length === 0) {
      throw new HTTPError(404, `Metric set ${metricSetID} was not found.`);
    }

    const rows: string[][] = [
      ["Metric Name", "Metric Question", "Input", "Expected"],
      ...metricsForExport.map(({ name, question, input, output }) => [name, question, String(input), String(output)]),
    ];

    const filename = metricSetID ? sanitizeFilename(matchingRecipes[0]?.name || metricSetID) : "all-metric-sets";

    const csvContent = rows.map((row) => csvRow(row)).join("\n");

    return new Download(csvContent, `${filename}.csv`, "text/csv", "attachment");
  },
);

function aggregateMetrics({
  recipes,
  metricDefinitions,
}: {
  recipes: Recipe[];
  metricDefinitions: Map<string, { name?: string; question?: string }>;
}): Array<{ recipeID: string; metricID: string; name: string; question: string; input: boolean; output: boolean }> {
  const metricsByID = new Map<
    string,
    {
      recipeID: string;
      metricID: string;
      name: string;
      question: string;
      input: boolean;
      output: boolean;
    }
  >();

  for (const recipe of recipes) {
    if (recipe.isDeleted) continue;

    for (const step of recipe.steps) {
      if (step.kind !== RecipeStepKind.evaluate) continue;
      if (step.status !== RecipeStepStatus.enabled) continue;

      const metricName = (step.name ?? "").trim() || step.id;
      const metricQuestion = (step.userPrompt ?? "").trim();

      const evaluatesInput = step.inputs.some((input) => {
        if (input.kind !== RecipeStepInputKind.artifact) return false;
        if (input.input.keyPath !== "") return false;
        return matchesArtifactComponent(input.input.childArtifactPath, "input");
      });

      const evaluatesOutput = step.inputs.some((input) => {
        if (input.kind !== RecipeStepInputKind.artifact) return false;
        if (input.input.keyPath !== "") return false;
        return matchesArtifactComponent(input.input.childArtifactPath, "output");
      });

      // Extract metricID from outputs
      const metricID = step.outputs.find((output) => output.kind === RecipeStepOutputKind.metric)?.output.metricID;
      if (!metricID) continue;

      // Get canonical name from metric definitions, fallback to step name
      const definition = metricDefinitions.get(metricID);
      const canonicalName = definition?.name ?? metricName;

      const existingMetric = metricsByID.get(metricID);
      if (existingMetric) {
        // Merge input/output flags
        existingMetric.input = existingMetric.input || evaluatesInput;
        existingMetric.output = existingMetric.output || evaluatesOutput;
      } else {
        metricsByID.set(metricID, {
          recipeID: recipe.id,
          metricID,
          name: canonicalName,
          question: metricQuestion,
          input: evaluatesInput,
          output: evaluatesOutput,
        });
      }
    }
  }

  const metrics = Array.from(metricsByID.values());

  metrics.sort((lhs, rhs) => {
    const nameCompare = lhs.name.localeCompare(rhs.name);
    if (nameCompare !== 0) return nameCompare;
    const questionCompare = lhs.question.localeCompare(rhs.question);
    if (questionCompare !== 0) return questionCompare;
    const idCompare = lhs.metricID.localeCompare(rhs.metricID);
    if (idCompare !== 0) return idCompare;
    return lhs.recipeID.localeCompare(rhs.recipeID);
  });

  return metrics;
}

function matchesArtifactComponent(artifactPath: ArtifactPath | undefined, targetID: string) {
  if (!artifactPath || artifactPath.length === 0) return false;
  const lastComponentID = artifactPath.at(-1)?.id?.toLowerCase();
  return lastComponentID === targetID;
}
