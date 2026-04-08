import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type WorkflowStepCondition = () => boolean;

export type WorkflowStep = {
  id: string;
  title?: string;
  description?: string;
  icon?: string;
  condition?: WorkflowStepCondition;
};

export type StepWorkflowDoneCallback = () => void;

export type StepWorkflowController = {
  currentStepIndex: number;
  currentStep: WorkflowStep | null;
  isOnLastStep: boolean;
  nextActionLabel: "Next" | "Done";
  hasConditionForStep: (stepIndex?: number) => boolean;
  isConditionMetForStep: (stepIndex?: number) => boolean;
  moveToPreviousStep: () => void;
  moveToNextStep: () => boolean;
  moveToNextStepIfConditionMet: () => boolean;
};

function clampStepIndex(stepIndex: number, stepCount: number): number {
  if (stepCount === 0) return 0;
  return Math.max(0, Math.min(stepCount - 1, stepIndex));
}

function nextStepIndex(currentStepIndex: number, stepCount: number): number {
  return clampStepIndex(currentStepIndex + 1, stepCount);
}

function previousStepIndex(currentStepIndex: number, stepCount: number): number {
  return clampStepIndex(currentStepIndex - 1, stepCount);
}

function isLastStepIndex(stepIndex: number, stepCount: number): boolean {
  if (stepCount === 0) return false;
  return stepIndex >= stepCount - 1;
}

function nextActionLabelForStep(stepIndex: number, stepCount: number): "Next" | "Done" {
  return isLastStepIndex(stepIndex, stepCount) ? "Done" : "Next";
}

export function hasStepCondition(steps: WorkflowStep[], stepIndex: number): boolean {
  return typeof steps.at(stepIndex)?.condition === "function";
}

export function isStepConditionMet(steps: WorkflowStep[], stepIndex: number): boolean {
  const condition = steps.at(stepIndex)?.condition;
  if (!condition) return true;
  return condition();
}

export function createStepWorkflowController({
  steps,
  initialStepIndex = 0,
  onDone,
}: {
  steps: WorkflowStep[];
  initialStepIndex?: number;
  onDone?: StepWorkflowDoneCallback;
}): StepWorkflowController {
  let currentStepIndex = clampStepIndex(initialStepIndex, steps.length);

  return {
    get currentStepIndex() {
      return currentStepIndex;
    },
    get currentStep() {
      return steps.at(currentStepIndex) ?? null;
    },
    get isOnLastStep() {
      return isLastStepIndex(currentStepIndex, steps.length);
    },
    get nextActionLabel() {
      return nextActionLabelForStep(currentStepIndex, steps.length);
    },
    hasConditionForStep(stepIndex = currentStepIndex) {
      return hasStepCondition(steps, stepIndex);
    },
    isConditionMetForStep(stepIndex = currentStepIndex) {
      return isStepConditionMet(steps, stepIndex);
    },
    moveToPreviousStep() {
      currentStepIndex = previousStepIndex(currentStepIndex, steps.length);
    },
    moveToNextStep() {
      if (steps.length === 0) return false;
      if (isLastStepIndex(currentStepIndex, steps.length)) {
        onDone?.();
        return false;
      }
      currentStepIndex = nextStepIndex(currentStepIndex, steps.length);
      return true;
    },
    moveToNextStepIfConditionMet() {
      if (!isStepConditionMet(steps, currentStepIndex)) return false;
      if (steps.length === 0) return false;
      if (isLastStepIndex(currentStepIndex, steps.length)) {
        onDone?.();
        return false;
      }
      currentStepIndex = nextStepIndex(currentStepIndex, steps.length);
      return true;
    },
  };
}

export function useStepWorkflow({
  steps,
  initialStepIndex = 0,
  onDone,
}: {
  steps: WorkflowStep[];
  initialStepIndex?: number;
  onDone?: StepWorkflowDoneCallback;
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(() => clampStepIndex(initialStepIndex, steps.length));
  const currentStepIndexRef = useRef(currentStepIndex);

  useEffect(() => {
    const nextIndex = clampStepIndex(initialStepIndex, steps.length);
    currentStepIndexRef.current = nextIndex;
    setCurrentStepIndex(nextIndex);
  }, [initialStepIndex, steps.length]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const currentStep = useMemo(() => steps.at(currentStepIndex) ?? null, [steps, currentStepIndex]);
  const isOnLastStep = useMemo(() => isLastStepIndex(currentStepIndex, steps.length), [currentStepIndex, steps.length]);
  const nextActionLabel = useMemo(
    () => nextActionLabelForStep(currentStepIndex, steps.length),
    [currentStepIndex, steps.length],
  );

  const hasConditionForStep = useCallback(
    (stepIndex = currentStepIndex) => hasStepCondition(steps, stepIndex),
    [steps, currentStepIndex],
  );

  const isConditionMetForStep = useCallback(
    (stepIndex = currentStepIndex) => isStepConditionMet(steps, stepIndex),
    [steps, currentStepIndex],
  );

  const moveToPreviousStep = useCallback(() => {
    const nextIndex = previousStepIndex(currentStepIndexRef.current, steps.length);
    currentStepIndexRef.current = nextIndex;
    setCurrentStepIndex(nextIndex);
  }, [steps.length]);

  const moveToNextStep = useCallback(() => {
    if (steps.length === 0) return false;
    const stepIndex = currentStepIndexRef.current;
    if (isLastStepIndex(stepIndex, steps.length)) {
      onDone?.();
      return false;
    }
    const nextIndex = nextStepIndex(stepIndex, steps.length);
    currentStepIndexRef.current = nextIndex;
    setCurrentStepIndex(nextIndex);
    return true;
  }, [onDone, steps.length]);

  const moveToNextStepIfConditionMet = useCallback(() => {
    const stepIndex = currentStepIndexRef.current;
    if (!isStepConditionMet(steps, stepIndex)) return false;
    if (steps.length === 0) return false;
    if (isLastStepIndex(stepIndex, steps.length)) {
      onDone?.();
      return false;
    }
    const nextIndex = nextStepIndex(stepIndex, steps.length);
    currentStepIndexRef.current = nextIndex;
    setCurrentStepIndex(nextIndex);
    return true;
  }, [onDone, steps]);

  return {
    currentStepIndex,
    currentStep,
    isOnLastStep,
    nextActionLabel,
    hasConditionForStep,
    isConditionMetForStep,
    moveToPreviousStep,
    moveToNextStep,
    moveToNextStepIfConditionMet,
    canMoveToPreviousStep: currentStepIndex > 0,
    canMoveToNextStep: currentStepIndex < steps.length - 1,
  };
}
