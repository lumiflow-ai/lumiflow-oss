import { RouteGroup } from "@/lib/routeGroup";

import { loadOrgUsers } from "./loadOrgUsers";

export const usersRoutes = new RouteGroup("users");
usersRoutes.install(loadOrgUsers);
