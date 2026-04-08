import { z } from "zod";

import { RouteGroup } from "@/lib/routeGroup";

export const healthcheck = new RouteGroup();
healthcheck.get("healthcheck", { requestSchema: z.void(), responseSchema: z.string() }, async () => {
  return "OK";
});
