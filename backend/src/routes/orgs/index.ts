import { RouteGroup } from "@/lib/routeGroup";

import { createOrg } from "./createOrg";
import { loadOrgs } from "./loadOrgs";

export const orgsRoutes = new RouteGroup("orgs");
orgsRoutes.install(loadOrgs);
orgsRoutes.install(createOrg);
