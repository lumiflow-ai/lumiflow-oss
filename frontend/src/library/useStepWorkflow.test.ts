import { describe, expect, it } from "vitest";

import { createStepWorkflowController } from "./useStepWorkflow";

describe("createStepWorkflowController", () => {
  it("returns the current step index", () => {
    const controller = createStepWorkflowController({
      steps: [{ id: "name" }, { id: "dataset" }, { id: "metrics" }],
    });

    expect(controller.currentStepIndex).toBe(0);
    expect(controller.currentStep?.id).toBe("name");
    expect(controller.isOnLastStep).toBe(false);
    expect(controller.nextActionLabel).toBe("Next");
  });

  it("clamps the initial step index", () => {
    const controller = createStepWorkflowController({
      steps: [{ id: "name" }, { id: "dataset" }],
      initialStepIndex: 99,
    });

    expect(controller.currentStepIndex).toBe(1);
    expect(controller.currentStep?.id).toBe("dataset");
    expect(controller.isOnLastStep).toBe(true);
    expect(controller.nextActionLabel).toBe("Done");
  });

  it("detects if a condition is attached to a step", () => {
    const controller = createStepWorkflowController({
      steps: [{ id: "name" }, { id: "dataset", condition: () => true }],
    });

    expect(controller.hasConditionForStep(0)).toBe(false);
    expect(controller.hasConditionForStep(1)).toBe(true);
  });

  it("evaluates whether a step condition is met", () => {
    const state = { ready: false };
    const controller = createStepWorkflowController({
      steps: [{ id: "name" }, { id: "dataset", condition: () => state.ready }],
    });

    expect(controller.isConditionMetForStep(0)).toBe(true);
    expect(controller.isConditionMetForStep(1)).toBe(false);

    state.ready = true;

    expect(controller.isConditionMetForStep(1)).toBe(true);
  });

  it("moves backward and forward regardless of conditions", () => {
    const controller = createStepWorkflowController({
      steps: [{ id: "name" }, { id: "dataset", condition: () => false }, { id: "metrics" }],
    });

    expect(controller.moveToNextStep()).toBe(true);
    expect(controller.currentStepIndex).toBe(1);

    expect(controller.moveToNextStep()).toBe(true);
    expect(controller.currentStepIndex).toBe(2);

    expect(controller.moveToNextStep()).toBe(false);
    expect(controller.currentStepIndex).toBe(2);

    controller.moveToPreviousStep();
    expect(controller.currentStepIndex).toBe(1);

    controller.moveToPreviousStep();
    expect(controller.currentStepIndex).toBe(0);

    controller.moveToPreviousStep();
    expect(controller.currentStepIndex).toBe(0);
  });

  it("calls onDone when moving forward from the last step", () => {
    let doneCount = 0;
    const controller = createStepWorkflowController({
      steps: [{ id: "name" }],
      onDone: () => {
        doneCount += 1;
      },
    });

    expect(controller.moveToNextStep()).toBe(false);
    expect(controller.moveToNextStep()).toBe(false);

    expect(controller.currentStepIndex).toBe(0);
    expect(doneCount).toBe(2);
  });

  it("only moves forward conditionally when the current condition is met", () => {
    const state = { ready: false };
    const controller = createStepWorkflowController({
      steps: [{ id: "name" }, { id: "dataset", condition: () => state.ready }, { id: "metrics" }],
      initialStepIndex: 1,
    });

    expect(controller.moveToNextStepIfConditionMet()).toBe(false);
    expect(controller.currentStepIndex).toBe(1);

    state.ready = true;

    expect(controller.moveToNextStepIfConditionMet()).toBe(true);
    expect(controller.currentStepIndex).toBe(2);

    expect(controller.moveToNextStepIfConditionMet()).toBe(false);
    expect(controller.currentStepIndex).toBe(2);
  });

  it("calls onDone only when last-step condition is met", () => {
    const state = { ready: false };
    let doneCount = 0;
    const controller = createStepWorkflowController({
      steps: [{ id: "report", condition: () => state.ready }],
      onDone: () => {
        doneCount += 1;
      },
    });

    expect(controller.moveToNextStepIfConditionMet()).toBe(false);
    expect(doneCount).toBe(0);

    state.ready = true;
    expect(controller.moveToNextStepIfConditionMet()).toBe(false);
    expect(doneCount).toBe(1);
  });

  it("handles empty step lists safely", () => {
    const controller = createStepWorkflowController({ steps: [] });

    expect(controller.currentStep).toBeNull();
    expect(controller.hasConditionForStep()).toBe(false);
    expect(controller.isConditionMetForStep()).toBe(true);

    controller.moveToPreviousStep();
    expect(controller.moveToNextStep()).toBe(false);
    expect(controller.moveToNextStepIfConditionMet()).toBe(false);

    expect(controller.currentStepIndex).toBe(0);
  });
});
