import type { Recipe, RecipeStep, RecipeTrigger } from "@/types";

import { withIdempotentTransaction, withPGClient } from "@/server/persistence";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { HTTPError, RouteGroup } from "@/lib/routeGroup";
import { pickIfPresent, updateNullish, updateOptional } from "@/lib/validation";

import { RecordRecipeRequestSchema, RecordRecipeResponseSchema } from "./definitions";

/**
 * Merges items by ID, supporting both additions/updates and deletions via tombstones.
 * @param updates Array of items to upsert or string IDs to delete (tombstones)
 * @returns New array with updates applied
 */
function mergeItemsByID<T extends { id: string }>(existingItems: T[], updates: Array<string | T>): T[] {
  const results = new Map(existingItems.map((item) => [item.id, item]));

  for (const update of updates) {
    if (typeof update === "string") {
      // Remove item (tombstone)
      results.delete(update);
    } else {
      // Update existing item or add new one
      results.set(update.id, update);
    }
  }

  return Array.from(results.values());
}

export const recordRecipe = new RouteGroup();

recordRecipe.post(
  null,
  {
    requestSchema: RecordRecipeRequestSchema,
    responseSchema: RecordRecipeResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async ({ orgID, recipe }, context) => {
    if (!context.user?.organizations.has(orgID)) {
      throw new AuthorizationError();
    }

    return await withPGClient(context, async (context) => {
      return await withIdempotentTransaction(context, async ({ pgClient, logger }) => {
        const existingRecipeResults = await pgClient.query<{ recipe: Recipe }>({
          text: `
            SELECT "recipe"
              FROM public.recipes
              WHERE
                "org_id" = $1
                AND "id" = $2
              FOR UPDATE;
          `,
          values: [orgID, recipe.id],
        });
        const existingRecipe = existingRecipeResults.rows.at(0)?.recipe;
        if (!existingRecipe) {
          if (recipe.name === undefined) {
            throw new HTTPError(400, "The recipe was not found, so it must specify a name.");
          }
          if (recipe.creationTimestamp === undefined) {
            throw new HTTPError(400, "The recipe was not found, so it must specify a creation timestamp.");
          }
          if (recipe.updateTimestamp === undefined) {
            throw new HTTPError(400, "The recipe was not found, so it must specify an update timestamp.");
          }
          if (recipe.stepUpdates === undefined) {
            throw new HTTPError(400, "The recipe was not found, so it must specify stepUpdates.");
          }
          if (recipe.triggerUpdates === undefined) {
            throw new HTTPError(400, "The recipe was not found, so it must specify triggerUpdates.");
          }

          const newRecipe: Recipe = {
            id: recipe.id,
            name: recipe.name,
            ...pickIfPresent(recipe, "description"),
            ...pickIfPresent(recipe, "isDeleted"),
            creationTimestamp: recipe.creationTimestamp,
            updateTimestamp: recipe.updateTimestamp,
            triggers: mergeItemsByID([] as RecipeTrigger[], recipe.triggerUpdates),
            steps: mergeItemsByID([] as RecipeStep[], recipe.stepUpdates),
          };

          logger.info("Creating recipe.");
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
            values: [orgID, recipe.id, newRecipe],
          });

          return { status: "success", recipe: newRecipe };
        }

        logger.info("Updating recipe.");

        updateOptional(existingRecipe, "name", recipe);
        updateNullish(existingRecipe, "description", recipe);
        updateNullish(existingRecipe, "isDeleted", recipe);
        updateOptional(existingRecipe, "creationTimestamp", recipe);
        updateOptional(existingRecipe, "updateTimestamp", recipe);

        // Handle triggers
        if (recipe.triggerUpdates !== undefined) {
          existingRecipe.triggers = mergeItemsByID(existingRecipe.triggers, recipe.triggerUpdates);
        }

        // Handle steps
        if (recipe.stepUpdates !== undefined) {
          existingRecipe.steps = mergeItemsByID(existingRecipe.steps, recipe.stepUpdates);
        }

        await pgClient.query({
          text: `
            UPDATE public.recipes
              SET
                "updated_at" = now(),
                "recipe" = $1
              WHERE
                "org_id" = $2
                AND "id" = $3;
          `,
          values: [existingRecipe, orgID, existingRecipe.id],
        });

        return { status: "success", recipe: existingRecipe };
      });
    });
  },
);

export const __visibleForTesting = { mergeItemsByID };
