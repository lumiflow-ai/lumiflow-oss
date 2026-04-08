import { RouteGroup } from "@/lib/routeGroup";

import { loadOrgConfiguration } from "./loadOrgConfiguration";

export const configurationRoutes = new RouteGroup("configuration");
configurationRoutes.install(loadOrgConfiguration);
