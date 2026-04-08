import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/model/evaluationModels", () => ({
  useEvaluationModels: vi.fn(),
}));

vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    Label: ({ children }: { children: string }) => <div>{children}</div>,
    LabeledControl: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    PopupButton: ({
      children,
      isEnabled,
    }: {
      children: ReactNode;
      isEnabled: boolean;
      selectionState: unknown;
      size: string;
    }) => <div data-enabled={isEnabled}>{children}</div>,
    PopupDivider: () => <div>----</div>,
    PopupItem: ({ title, value }: { title: string; value: string }) => <div data-value={value}>{title}</div>,
  };
});

import type { EvaluationModelConfiguration } from "@/generated/serverTypes";

import { StateObject } from "@/library/StateObject";

import type { EvaluationModelsLoader } from "@/model/evaluationModels";
import { useEvaluationModels } from "@/model/evaluationModels";

import {
  __visibleForTesting,
  EvaluationModelSelect,
  type EvaluationModelSelectState,
} from "@/components/EvaluationModelSelect";

const mockedUseEvaluationModels = vi.mocked(useEvaluationModels);

function createModelsLoader({
  models = [],
  defaultEvaluationModelID = null,
  isLoading = false,
}: {
  models?: EvaluationModelConfiguration[];
  defaultEvaluationModelID?: string | null;
  isLoading?: boolean;
} = {}): EvaluationModelsLoader {
  const defaultEvaluationModel = defaultEvaluationModelID
    ? (models.find((model) => model.id === defaultEvaluationModelID) ?? null)
    : null;

  return {
    evaluationModels: models,
    defaultEvaluationModelID,
    defaultEvaluationModel,
    error: undefined,
    isLoading,
    refresh: vi.fn(),
  };
}

describe("EvaluationModelSelect", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockedUseEvaluationModels.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("formats option title with description and provider hint", () => {
    const title = __visibleForTesting.formatEvaluationModelOptionTitle({
      model: {
        id: "gpt-5-mini",
        displayName: "GPT-5 mini",
        description: "Fast and cost-efficient default model.",
        provider: "openai",
        costMultiplier: "$$$",
      },
      includeProviderHint: true,
    });

    expect(title).toBe("GPT-5 mini | openai | $$$ | Fast and cost-efficient default model.");
  });

  it("maps selected model id to the full object state", () => {
    const model: EvaluationModelConfiguration = {
      id: "gpt-5-mini",
      displayName: "GPT-5 mini",
      description: "Fast and cost-efficient default model.",
      provider: "openai",
      costMultiplier: "$$$",
    };

    const state = __visibleForTesting.selectionStateForModelID({
      value: "gpt-5-mini",
      modelByID: new Map([[model.id, model]]),
    });

    expect(state).toEqual({
      kind: "valid",
      value: "gpt-5-mini",
      model,
    });
  });

  it("renders label and placeholder when no model is selected", () => {
    mockedUseEvaluationModels.mockReturnValue(
      createModelsLoader({
        models: [
          {
            id: "gpt-5-mini",
            displayName: "GPT-5 mini",
            description: "Fast and cost-efficient default model.",
            provider: "openai",
            costMultiplier: "$$$",
          },
          {
            id: "gpt-5-nano",
            displayName: "GPT-5 nano",
            description: "Most cost-efficient model.",
            provider: "openai",
            costMultiplier: "$$$",
          },
        ],
        defaultEvaluationModelID: "gpt-5-mini",
      }),
    );

    const selectionState = new StateObject<EvaluationModelSelectState>({
      kind: "placeholder",
      value: null,
      model: null,
    });

    const html = renderToStaticMarkup(<EvaluationModelSelect selectionState={selectionState} />);

    expect(html).toContain("Judge Model");
    expect(html).toContain("Choose a Judge Model");
  });

  it("renders placeholder when no model is selected with use-default-model behavior", () => {
    mockedUseEvaluationModels.mockReturnValue(
      createModelsLoader({
        models: [
          {
            id: "gpt-5-mini",
            displayName: "GPT-5 mini",
            description: "Fast and cost-efficient default model.",
            provider: "openai",
            costMultiplier: "$$$",
          },
        ],
        defaultEvaluationModelID: "gpt-5-mini",
      }),
    );

    const selectionState = new StateObject<EvaluationModelSelectState>({
      kind: "placeholder",
      value: null,
      model: null,
    });

    const html = renderToStaticMarkup(<EvaluationModelSelect selectionState={selectionState} />);

    expect(html).toContain("Choose a Judge Model");
  });

  it("renders placeholder when no model is selected", () => {
    mockedUseEvaluationModels.mockReturnValue(
      createModelsLoader({
        models: [
          {
            id: "gpt-5-mini",
            displayName: "GPT-5 mini",
            description: "Fast and cost-efficient default model.",
            provider: "openai",
            costMultiplier: "$$$",
          },
        ],
        defaultEvaluationModelID: null,
      }),
    );

    const selectionState = new StateObject<EvaluationModelSelectState>({
      kind: "placeholder",
      value: null,
      model: null,
    });

    const html = renderToStaticMarkup(<EvaluationModelSelect selectionState={selectionState} />);

    expect(html).toContain("Choose a Judge Model");
  });

  it("renders placeholder when multiple models are available", () => {
    mockedUseEvaluationModels.mockReturnValue(
      createModelsLoader({
        models: [
          {
            id: "nova-micro",
            displayName: "Nova Micro",
            description: "A micro model for lightweight evaluations.",
            provider: "Amazon",
            costMultiplier: "$",
          },
          {
            id: "gpt-oss-20b",
            displayName: "GPT-OSS 20B",
            description: "20B parameter open-source model",
            provider: "OpenAI",
            costMultiplier: "$$",
          },
        ],
      }),
    );

    const selectionState = new StateObject<EvaluationModelSelectState>({
      kind: "placeholder",
      value: null,
      model: null,
    });

    const html = renderToStaticMarkup(<EvaluationModelSelect selectionState={selectionState} />);

    expect(html).toContain("Choose a Judge Model");
  });

  it("renders loading state as disabled control", () => {
    mockedUseEvaluationModels.mockReturnValue(createModelsLoader({ isLoading: true }));
    const selectionState = new StateObject<EvaluationModelSelectState>({
      kind: "placeholder",
      value: null,
      model: null,
    });

    const html = renderToStaticMarkup(<EvaluationModelSelect selectionState={selectionState} />);

    expect(html).toContain("Loading models...");
    expect(html).toContain('disabled=""');
  });
});
