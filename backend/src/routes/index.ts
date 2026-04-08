import { RouteGroup } from "@/lib/routeGroup";

import { healthcheck } from "./healthcheck";
import { v0_1Routes } from "./v0.1";
import { versionRoutes } from "./version";

export const apiRoutes = new RouteGroup();

apiRoutes.install(healthcheck);
apiRoutes.install(versionRoutes);
apiRoutes.install(v0_1Routes);
