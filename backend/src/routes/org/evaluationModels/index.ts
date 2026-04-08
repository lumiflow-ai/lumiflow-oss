import { RouteGroup } from "@/lib/routeGroup";

import { loadEvaluationModels } from "./loadEvaluationModels";

export const evaluationModelsRoutes = new RouteGroup("evaluation-models");
evaluationModelsRoutes.install(loadEvaluationModels);
