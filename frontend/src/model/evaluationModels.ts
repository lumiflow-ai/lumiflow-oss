import { useContext, useMemo } from "react";

import { useOrgEvaluationModels } from "@/generated/serverEndpoints";
import type { EvaluationModelConfiguration, OrgEvaluationModelsResponse } from "@/generated/serverTypes";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";

export type EvaluationModelsLoader = {
  evaluationModels: EvaluationModelConfiguration[];
  defaultEvaluationModelID: string | null;
  defaultEvaluationModel: EvaluationModelConfiguration | null;
  error: Error | undefined;
  isLoading: boolean;
  refresh: () => Promise<OrgEvaluationModelsResponse | undefined>;
};

export function sortEvaluationModels(evaluationModels: EvaluationModelConfiguration[]): EvaluationModelConfiguration[] {
  return evaluationModels.sort((left, right) => {
    const costComparison = left.costMultiplier.length - right.costMultiplier.length;
    if (costComparison !== 0) return costComparison;
    return left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id);
  });
}

export const useEvaluationModels = (): EvaluationModelsLoader => {
  const { currentOrganization } = useContext(OrganizationContext);
  const { response, error, isLoading, refresh } = useOrgEvaluationModels(
    currentOrganization ? { orgID: currentOrganization.id } : undefined,
  );

  const evaluationModels = useMemo(
    () => sortEvaluationModels(response?.evaluationModels ?? []),
    [response?.evaluationModels],
  );

  const defaultEvaluationModelID = response?.defaultEvaluationModelID ?? null;

  const defaultEvaluationModel = useMemo(
    () => evaluationModels.find((model) => model.id === defaultEvaluationModelID) ?? null,
    [evaluationModels, defaultEvaluationModelID],
  );

  return useMemo(
    () => ({
      evaluationModels,
      defaultEvaluationModelID,
      defaultEvaluationModel,
      error,
      isLoading,
      refresh,
    }),
    [evaluationModels, defaultEvaluationModelID, defaultEvaluationModel, error, isLoading, refresh],
  );
};
