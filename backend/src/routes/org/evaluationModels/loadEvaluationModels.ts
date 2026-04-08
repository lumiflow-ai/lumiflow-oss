import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { OrgEvaluationModelsRequestSchema, OrgEvaluationModelsResponseSchema } from "./definitions";
import { loadEvaluationModelRegistry } from "./loadEvaluationModelRegistry";

export const loadEvaluationModels = new RouteGroup();
loadEvaluationModels.get(
  null,
  {
    requestSchema: OrgEvaluationModelsRequestSchema,
    responseSchema: OrgEvaluationModelsResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase();
    if (!context.user?.organizations.has(orgID)) {
      throw new AuthorizationError();
    }

    return loadEvaluationModelRegistry();
  },
);
