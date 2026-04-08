import { RouteGroup } from "@/lib/routeGroup";

import { loadTableConfiguration } from "./loadTableConfiguration";

export const configurationRoutes = new RouteGroup("configuration");
configurationRoutes.install(loadTableConfiguration);
