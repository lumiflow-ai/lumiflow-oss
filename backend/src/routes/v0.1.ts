import { RouteGroup } from "@/lib/routeGroup";

import { accountRoutes } from "./account";
import { artifactRoutes } from "./artifacts";
import { configurationRoutes } from "./configuration";
import { dashboardRoutes } from "./dashboards";
import { orgRoutes } from "./org";
import { orgsRoutes } from "./orgs";
import { recipeRoutes } from "./recipe";
import { signupRoutes } from "./signup";

export const v0_1Routes = new RouteGroup("v0.1");
v0_1Routes.install(artifactRoutes);
v0_1Routes.install(dashboardRoutes);
v0_1Routes.install(orgsRoutes);
v0_1Routes.install(orgRoutes);
v0_1Routes.install(accountRoutes);
v0_1Routes.install(configurationRoutes);
v0_1Routes.install(recipeRoutes);
v0_1Routes.install(signupRoutes);
