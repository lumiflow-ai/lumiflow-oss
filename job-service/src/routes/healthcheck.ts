import { z } from "zod";

import { RouteGroup } from "@/lib/routeGroup";

export const healthcheck = new RouteGroup();
healthcheck.get("healthcheck", { requestType: z.void(), responseType: z.string() }, async () => {
  return "OK";
});
