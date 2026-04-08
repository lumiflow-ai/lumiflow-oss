import { RouteGroup } from "@/lib/routeGroup";

import { cancelEvaluation } from "./cancelEvaluation";
import { loadRecipes } from "./loadRecipes";
import { previewRecipe } from "./previewRecipe";
import { recordRecipe } from "./recordRecipe";
import { runRecipes } from "./runRecipes";

export const recipeRoutes = new RouteGroup("recipes");
recipeRoutes.install(loadRecipes);
recipeRoutes.install(previewRecipe);
recipeRoutes.install(cancelEvaluation);
recipeRoutes.install(recordRecipe);
recipeRoutes.install(runRecipes);
