import { RouteGroup } from "@/lib/routeGroup";

import { loadAccount } from "./loadAccount";

export const accountRoutes = new RouteGroup("account");
accountRoutes.install(loadAccount);
