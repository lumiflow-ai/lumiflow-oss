import { RouteGroup } from "@/lib/routeGroup";

import { cancelEvaluationRoutes } from "./cancelEvaluationRoutes";
import { createJobRoutes } from "./createJobRoutes";
import { healthcheck } from "./healthcheck";

export const apiRoutes = new RouteGroup();

apiRoutes.install(healthcheck);
apiRoutes.install(createJobRoutes);
apiRoutes.install(cancelEvaluationRoutes);
