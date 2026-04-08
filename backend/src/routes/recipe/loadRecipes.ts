import type { Recipe } from "@/types";

import { withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { LoadRecipesRequestSchema, LoadRecipesResponseSchema } from "./definitions";

const cancellationEvaluationRunIDPrefix = "cancel:";

type CancellationRow = {
  run: { evaluationGroupID?: string; status?: string };
};

function collectCancelledEvaluationGroupIDs(rows: CancellationRow[]): string[] {
  const cancelledEvaluationGroupIDs = new Set<string>();
  for (const { run } of rows) {
    if (!run.evaluationGroupID || run.status !== "cancelled") continue;
    cancelledEvaluationGroupIDs.add(run.evaluationGroupID);
  }
  return Array.from(cancelledEvaluationGroupIDs);
}

export const loadRecipes = new RouteGroup();
loadRecipes.get(
  null,
  {
    requestSchema: LoadRecipesRequestSchema,
    responseSchema: LoadRecipesResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    if (!context.user?.organizations.has(orgID)) {
      throw new AuthorizationError();
    }

    const [recipeQueryResults, cancelledEvaluationGroupResults] = await Promise.all([
      withPGClient(context, async ({ pgClient }) => {
        return await pgClient.query<{
          org_id: string;
          recipe_id: string;
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
          values: [orgID],
        });
      }),
      withPGClient(context, async ({ pgClient }) => {
        return await pgClient.query<CancellationRow>({
          text: `
            SELECT "run"
              FROM public.evaluation_runs
              WHERE "org_id" = $1
                AND "evaluation_run_id" LIKE $2;
          `,
          values: [orgID, `${cancellationEvaluationRunIDPrefix}%`],
        });
      }),
    ]);

    return {
      recipes: recipeQueryResults.rows.map((row) => row.recipe),
      cancelledEvaluationGroupIDs: collectCancelledEvaluationGroupIDs(cancelledEvaluationGroupResults.rows),
    };
  },
);

export const __visibleForTesting = {
  collectCancelledEvaluationGroupIDs,
  cancellationEvaluationRunIDPrefix,
};
