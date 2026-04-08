import { RouteGroup } from "@/lib/routeGroup";

import { configurationRoutes } from "./configuration";
import { evaluationModelsRoutes } from "./evaluationModels";
import { metricsRoutes } from "./metrics";
import { usersRoutes } from "./users";

export const orgRoutes = new RouteGroup("org");
orgRoutes.install(metricsRoutes);
orgRoutes.install(configurationRoutes);
orgRoutes.install(evaluationModelsRoutes);
orgRoutes.install(usersRoutes);
