import { z } from "zod";

import { RouteGroup } from "@/lib/routeGroup";

export const versionRoutes = new RouteGroup("version");

versionRoutes.get(
  null,
  {
    requestSchema: z.void(),
    responseSchema: z.object({
      commitSha: z.string(),
    }),
  },
  async () => {
    const commitSha = process.env.COMMIT_SHA?.trim() || "unknown";
    return {
      commitSha,
    };
  },
);
