import { RouteGroup } from "@/lib/routeGroup";

import { exportMetrics } from "./exportMetrics";
import { loadMetrics } from "./loadMetrics";
import { recordMetricDefinition } from "./recordMetricDefinition";

export const metricsRoutes = new RouteGroup("metrics");
metricsRoutes.install(exportMetrics);
metricsRoutes.install(loadMetrics);
metricsRoutes.install(recordMetricDefinition);
