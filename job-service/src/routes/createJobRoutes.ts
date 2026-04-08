import { randomUUID } from "node:crypto";

import { withPGClient } from "@/server/persistence";

import { RouteGroup } from "@/lib/routeGroup";

import { submitJob } from "@/jobQueue/submitJob";

import { CreateJobRequestSchema, JobResponseSchema, ResponseTypeSchema } from "./definitions";

export const createJobRoutes = new RouteGroup();
createJobRoutes.post(
  "create",
  {
    requestType: CreateJobRequestSchema,
    responseType: JobResponseSchema,
  },
  async (request, context) => {
    const generationID = request.generationID ?? randomUUID();
    await withPGClient(context, async ({ pgClient, logger }) => {
      await submitJob({
        pgClient,
        logger,
        kind: request.kind,
        priority: request.priority ?? 0,
        generationID,
        recipeRunID: request.recipeRunID,
        orgID: request.orgID,
        eventSummaryID: request.eventSummaryID,
        callbackURL: request.callbackURL,
        inputs: request.inputs,
      });
    });

    return {
      type: ResponseTypeSchema.enum.success,
      generationID,
    };
  },
);
