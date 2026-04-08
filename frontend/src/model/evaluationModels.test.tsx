import type { ContextType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/generated/serverEndpoints", () => ({
  useOrgEvaluationModels: vi.fn(),
}));

import { useOrgEvaluationModels } from "@/generated/serverEndpoints";
import type { EvaluationModelConfiguration, Organization, OrgEvaluationModelsResponse } from "@/generated/serverTypes";

import { sortEvaluationModels, useEvaluationModels } from "@/model/evaluationModels";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";

const mockedUseOrgEvaluationModels = vi.mocked(useOrgEvaluationModels);

function organizationContextValue(organization: Organization): ContextType<typeof OrganizationContext> {
  return {
    currentOrganization: organization,
  } as unknown as ContextType<typeof OrganizationContext>;
}

function renderUseEvaluationModels(
  contextValue: ContextType<typeof OrganizationContext> | null = null,
): ReturnType<typeof useEvaluationModels> {
  let hookValue: ReturnType<typeof useEvaluationModels> | undefined;

  const HookReader = () => {
    hookValue = useEvaluationModels();
    return null;
  };

  if (contextValue) {
    renderToStaticMarkup(
      <OrganizationContext.Provider value={contextValue}>
        <HookReader />
      </OrganizationContext.Provider>,
    );
  } else {
    renderToStaticMarkup(<HookReader />);
  }

  if (!hookValue) throw new Error("Hook did not render.");
  return hookValue;
}

describe("evaluationModels", () => {
  beforeEach(() => {
    mockedUseOrgEvaluationModels.mockReset();
  });

  it("sortEvaluationModels sorts by display name, then by id", () => {
    const models: EvaluationModelConfiguration[] = [
      {
        id: "zebra",
        displayName: "GPT-5 mini",
        description: "",
        provider: "openai",
        costMultiplier: "$$$",
      },
      {
        id: "alpha",
        displayName: "GPT-5 mini",
        description: "",
        provider: "openai",
        costMultiplier: "$$$",
      },
      {
        id: "beta",
        displayName: "GPT-5 nano",
        description: "",
        provider: "openai",
        costMultiplier: "$$$",
      },
    ];

    expect(sortEvaluationModels(models).map((model) => model.id)).toEqual(["alpha", "zebra", "beta"]);
  });

  it("requests models for the current organization", () => {
    mockedUseOrgEvaluationModels.mockReturnValue({
      response: undefined,
      error: undefined,
      isLoading: true,
      refresh: vi.fn(),
    });

    renderUseEvaluationModels(
      organizationContextValue({
        id: "org-123",
        name: "Test Organization",
      } as Organization),
    );

    expect(mockedUseOrgEvaluationModels).toHaveBeenCalledWith({ orgID: "org-123" });
  });

  it("returns sorted models and resolves the default model", () => {
    const response: OrgEvaluationModelsResponse = {
      defaultEvaluationModelID: "model-alpha",
      evaluationModels: [
        {
          id: "model-beta",
          displayName: "GPT-5 nano",
          description: "Most cost-efficient model.",
          provider: "openai",
          costMultiplier: "$$$",
        },
        {
          id: "model-alpha",
          displayName: "GPT-5 mini",
          description: "Fast and cost-efficient default model.",
          provider: "openai",
          costMultiplier: "$$$",
        },
      ],
    };

    mockedUseOrgEvaluationModels.mockReturnValue({
      response,
      error: undefined,
      isLoading: false,
      refresh: vi.fn(),
    });

    const result = renderUseEvaluationModels(
      organizationContextValue({
        id: "org-123",
        name: "Test Organization",
      } as Organization),
    );

    expect(result.evaluationModels.map((model) => model.id)).toEqual(["model-alpha", "model-beta"]);
    expect(result.defaultEvaluationModelID).toBe("model-alpha");
    expect(result.defaultEvaluationModel?.id).toBe("model-alpha");
  });

  it("does not request models when there is no selected organization", () => {
    mockedUseOrgEvaluationModels.mockReturnValue({
      response: undefined,
      error: undefined,
      isLoading: true,
      refresh: vi.fn(),
    });

    renderUseEvaluationModels();

    expect(mockedUseOrgEvaluationModels).toHaveBeenCalledWith(undefined);
  });
});
