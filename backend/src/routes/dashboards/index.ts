import { RouteGroup } from "@/lib/routeGroup";

import { loadDefault } from "./loadDefault";

export const dashboardRoutes = new RouteGroup("dashboards");
dashboardRoutes.install(loadDefault);
